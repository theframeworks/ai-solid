import { createRenderEffect, createRoot, createSignal, mapArray } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createChat } from '../src/index.js';
import { controlledStream, mockTransport, sequentialIds, textOf, until } from './mock-transport.js';

function inRoot<T>(fn: () => T) {
  return createRoot((dispose) => ({ value: fn(), dispose }));
}

describe('createChat', () => {
  it('streams an assistant reply into messages and ends ready', async () => {
    const mock = mockTransport();
    const { value: chat, dispose } = inRoot(() =>
      createChat({ transport: mock.transport, generateId: sequentialIds() }),
    );

    const request = chat.sendMessage({ text: 'hi' });
    await until(() => chat.status() === 'submitted');
    expect(chat.messages().map((m) => m.role)).toEqual(['user']);

    mock.stream.push({ type: 'text-start', id: 't' }, { type: 'text-delta', id: 't', delta: 'Hel' });
    await until(() => textOf(chat.messages()[1]) === 'Hel');
    expect(chat.status()).toBe('streaming');

    mock.stream.push({ type: 'text-delta', id: 't', delta: 'lo' }, { type: 'text-end', id: 't' });
    mock.stream.close();
    await request;

    expect(chat.status()).toBe('ready');
    expect(chat.messages()).toEqual([
      { id: 'id-2', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
      { id: 'id-3', role: 'assistant', parts: [{ type: 'text', text: 'Hello', state: 'done' }] },
    ]);
    dispose();
  });

  it("doesn't replace the other messages' objects while a part streams in", async () => {
    const mock = mockTransport();
    const stored = [
      { id: 'h-1', role: 'user' as const, parts: [{ type: 'text' as const, text: 'first' }] },
      { id: 'h-2', role: 'assistant' as const, parts: [{ type: 'text' as const, text: 'second' }] },
    ];
    const rowRuns = new Map<string, number>();
    const { value, dispose } = inRoot(() => {
      const chat = createChat({ transport: mock.transport, generateId: sequentialIds(), messages: stored });
      // mapArray is what <For> uses: a row re-runs only when its message object is replaced.
      const rows = mapArray(chat.messages, (message) => {
        rowRuns.set(message.id, (rowRuns.get(message.id) ?? 0) + 1);
        return message.id;
      });
      createRenderEffect(rows);
      return chat;
    });
    const chat = value;
    const [first, second] = chat.messages();

    const request = chat.sendMessage({ text: 'hi' });
    await until(() => mock.sent.length === 1);
    mock.stream.push({ type: 'text-start', id: 't' }, { type: 'text-delta', id: 't', delta: 'Hel' });
    await until(() => textOf(chat.messages()[3]) === 'Hel');
    mock.stream.push({ type: 'text-delta', id: 't', delta: 'lo' });
    await until(() => textOf(chat.messages()[3]) === 'Hello');
    const user = chat.messages()[2];
    mock.stream.push({ type: 'text-delta', id: 't', delta: '!' });
    await until(() => textOf(chat.messages()[3]) === 'Hello!');
    mock.stream.close();
    await request;

    expect(chat.messages()[0]).toBe(first);
    expect(chat.messages()[1]).toBe(second);
    expect(chat.messages()[2]).toBe(user);
    expect(rowRuns.get('h-1')).toBe(1);
    expect(rowRuns.get('h-2')).toBe(1);
    expect(rowRuns.get(user?.id ?? '')).toBe(1);
    // The streaming message is a new snapshot per update, so its row re-ran.
    expect(rowRuns.get(chat.messages()[3]?.id ?? '')).toBeGreaterThan(1);
    dispose();
  });

  it('stops a streaming reply, keeping what has arrived, and ends ready', async () => {
    const mock = mockTransport();
    const { value: chat, dispose } = inRoot(() =>
      createChat({ transport: mock.transport, generateId: sequentialIds() }),
    );

    const request = chat.sendMessage({ text: 'hi' });
    await until(() => mock.sent.length === 1);
    mock.stream.push({ type: 'text-start', id: 't' }, { type: 'text-delta', id: 't', delta: 'Partial' });
    await until(() => chat.status() === 'streaming' && textOf(chat.messages()[1]) === 'Partial');

    await chat.stop();
    await request;

    expect(mock.sent[0]?.abortSignal?.aborted).toBe(true);
    expect(chat.status()).toBe('ready');
    expect(chat.error()).toBeUndefined();
    expect(textOf(chat.messages()[1])).toBe('Partial');
    dispose();
  });

  it('surfaces a stream error, and clearError returns to ready', async () => {
    const mock = mockTransport();
    const errors: Error[] = [];
    const { value: chat, dispose } = inRoot(() =>
      createChat({ transport: mock.transport, generateId: sequentialIds(), onError: (e) => errors.push(e) }),
    );

    const request = chat.sendMessage({ text: 'hi' });
    await until(() => mock.sent.length === 1);
    mock.stream.push({ type: 'text-start', id: 't' }, { type: 'text-delta', id: 't', delta: 'Half' });
    mock.stream.push({ type: 'error', errorText: 'model overloaded' });
    mock.stream.close();
    await request;

    expect(chat.status()).toBe('error');
    expect(chat.error()?.message).toBe('model overloaded');
    expect(errors.map((e) => e.message)).toEqual(['model overloaded']);
    expect(textOf(chat.messages()[1])).toBe('Half');

    chat.clearError();
    expect(chat.status()).toBe('ready');
    expect(chat.error()).toBeUndefined();
    dispose();
  });

  it('surfaces a transport failure as an error', async () => {
    const mock = mockTransport();
    mock.failNextWith(new Error('Too many requests'));
    const { value: chat, dispose } = inRoot(() => createChat({ transport: mock.transport, onError: () => {} }));

    await chat.sendMessage({ text: 'hi' });

    expect(chat.status()).toBe('error');
    expect(chat.error()?.message).toBe('Too many requests');
    expect(chat.messages().map((m) => m.role)).toEqual(['user']);
    dispose();
  });

  describe('resuming a stored conversation', () => {
    const stored = [
      { id: 's-1', role: 'user' as const, parts: [{ type: 'text' as const, text: 'What is Solid?' }] },
      { id: 's-2', role: 'assistant' as const, parts: [{ type: 'text' as const, text: 'A UI library.' }] },
    ];

    it('shows the stored messages and sends them with the next message', async () => {
      const mock = mockTransport();
      const { value: chat, dispose } = inRoot(() =>
        createChat({ id: 'conversation-7', transport: mock.transport, messages: stored, generateId: sequentialIds() }),
      );
      expect(chat.id()).toBe('conversation-7');
      expect(chat.messages()).toEqual(stored);

      const request = chat.sendMessage({ text: 'And Astro?' });
      await until(() => mock.sent.length === 1);
      mock.stream.push({ type: 'text-start', id: 't' }, { type: 'text-delta', id: 't', delta: 'A site builder.' });
      mock.stream.close();
      await request;

      expect(mock.sent[0]?.chatId).toBe('conversation-7');
      expect(mock.sent[0]?.messages.map((m) => textOf(m))).toEqual(['What is Solid?', 'A UI library.', 'And Astro?']);
      expect(chat.messages().map((m) => textOf(m))).toEqual([
        'What is Solid?',
        'A UI library.',
        'And Astro?',
        'A site builder.',
      ]);
      dispose();
    });

    it('resumes a reply that was still streaming when the page reloaded', async () => {
      const mock = mockTransport();
      const pending = [...stored, { id: 's-3', role: 'user' as const, parts: [{ type: 'text' as const, text: 'More?' }] }];
      const live = controlledStream();
      mock.setReconnect(live.stream);
      const { value: chat, dispose } = inRoot(() =>
        createChat({ id: 'conversation-7', transport: mock.transport, messages: pending, generateId: sequentialIds() }),
      );

      const resumed = chat.resumeStream();
      live.push({ type: 'start', messageId: 's-4' }, { type: 'text-start', id: 't' });
      live.push({ type: 'text-delta', id: 't', delta: 'Yes, ' }, { type: 'text-delta', id: 't', delta: 'signals.' });
      live.close();
      await resumed;

      expect(chat.status()).toBe('ready');
      expect(chat.messages().at(-1)).toMatchObject({ id: 's-4', role: 'assistant' });
      expect(textOf(chat.messages().at(-1))).toBe('Yes, signals.');
      expect(chat.messages()).toHaveLength(4);
      dispose();
    });

    it('stays ready when there is no reply to resume', async () => {
      const mock = mockTransport();
      const { value: chat, dispose } = inRoot(() => createChat({ transport: mock.transport, messages: stored }));

      await chat.resumeStream();

      expect(chat.status()).toBe('ready');
      expect(chat.messages()).toEqual(stored);
      dispose();
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('publishes the first update at once, then at most once per interval', async () => {
      const mock = mockTransport();
      const publications: string[] = [];
      const { value: chat, dispose } = inRoot(() => {
        const chat = createChat({ transport: mock.transport, generateId: sequentialIds(), throttle: 50 });
        createRenderEffect(() => publications.push(chat.messages().map((m) => textOf(m)).join('|')));
        return chat;
      });

      const request = chat.sendMessage({ text: 'hi' });
      await until(() => mock.sent.length === 1);
      expect(publications).toEqual(['', 'hi']);

      mock.stream.push({ type: 'text-start', id: 't' }, { type: 'text-delta', id: 't', delta: 'a' });
      mock.stream.push({ type: 'text-delta', id: 't', delta: 'b' }, { type: 'text-delta', id: 't', delta: 'c' });
      await until(() => chat.status() === 'streaming');
      await vi.advanceTimersByTimeAsync(0);
      // The user message opened an interval, so the assistant's deltas wait for it to end.
      expect(textOf(chat.messages()[1])).toBeUndefined();

      await vi.advanceTimersByTimeAsync(50);
      expect(textOf(chat.messages()[1])).toBe('abc');
      const afterInterval = publications.length;

      mock.stream.push({ type: 'text-delta', id: 't', delta: 'd' }, { type: 'text-delta', id: 't', delta: 'e' });
      await vi.advanceTimersByTimeAsync(10);
      expect(textOf(chat.messages()[1])).toBe('abc');

      await vi.advanceTimersByTimeAsync(40);
      expect(textOf(chat.messages()[1])).toBe('abcde');
      expect(publications.length).toBe(afterInterval + 1);

      mock.stream.push({ type: 'text-delta', id: 't', delta: 'f' });
      mock.stream.close();
      await request;
      // Ending flushes the last update without waiting for the interval.
      expect(chat.status()).toBe('ready');
      expect(textOf(chat.messages()[1])).toBe('abcdef');
      dispose();
    });

    it('flushes the latest messages before an error status shows', async () => {
      const mock = mockTransport();
      const { value: chat, dispose } = inRoot(() =>
        createChat({ transport: mock.transport, throttle: 50, onError: () => {} }),
      );

      const request = chat.sendMessage({ text: 'hi' });
      await until(() => mock.sent.length === 1);
      mock.stream.push({ type: 'text-start', id: 't' }, { type: 'text-delta', id: 't', delta: 'Hello' });
      mock.stream.push({ type: 'error', errorText: 'stream failed' });
      mock.stream.close();
      await request;

      expect(chat.status()).toBe('error');
      expect(textOf(chat.messages()[1])).toBe('Hello');
      dispose();
    });

    it('stops publishing once its owner is disposed', async () => {
      const mock = mockTransport();
      const { value: chat, dispose } = inRoot(() => createChat({ transport: mock.transport, throttle: 50 }));

      const request = chat.sendMessage({ text: 'hi' });
      await until(() => mock.sent.length === 1);
      mock.stream.push({ type: 'text-start', id: 't' }, { type: 'text-delta', id: 't', delta: 'Hello' });
      await until(() => chat.status() === 'streaming');

      dispose();
      await vi.advanceTimersByTimeAsync(50);
      mock.stream.close();
      await request;

      expect(chat.messages()).toHaveLength(1);
      expect(chat.status()).toBe('streaming');
    });
  });

  it('recreates the chat when an accessor of options changes', async () => {
    const mock = mockTransport();
    const { value, dispose } = inRoot(() => {
      const [id, setId] = createSignal('a');
      const chat = createChat(() => ({
        id: id(),
        transport: mock.transport,
        messages:
          id() === 'a' ? [{ id: 'm-1', role: 'user' as const, parts: [{ type: 'text' as const, text: 'first' }] }] : [],
      }));
      return { chat, setId };
    });

    expect(value.chat.id()).toBe('a');
    expect(value.chat.messages()).toHaveLength(1);

    value.setId('b');

    expect(value.chat.id()).toBe('b');
    expect(value.chat.messages()).toEqual([]);
    dispose();
  });

  it('replaces the messages with setMessages', () => {
    const { value: chat, dispose } = inRoot(() => createChat());
    chat.setMessages([{ id: 'x', role: 'user', parts: [{ type: 'text', text: 'restored' }] }]);
    chat.setMessages((previous) => [...previous, { id: 'y', role: 'assistant', parts: [] }]);
    expect(chat.messages().map((m) => m.id)).toEqual(['x', 'y']);
    dispose();
  });
});
