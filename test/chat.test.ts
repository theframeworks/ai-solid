import { createRenderEffect, createRoot } from 'solid-js';
import { expect, it } from 'vitest';
import { Chat } from '../src/index.js';
import { mockTransport, textOf, until } from './mock-transport.js';

it('a Chat instance publishes to tracked signals, so islands can share one', async () => {
  const mock = mockTransport();
  const chat = new Chat({ transport: mock.transport });
  const seen: string[][] = [];
  const dispose = createRoot((dispose) => {
    createRenderEffect(() => seen.push(chat.signals.messages().map((m) => textOf(m) ?? '')));
    return dispose;
  });

  const request = chat.sendMessage({ text: 'hi' });
  await until(() => mock.sent.length === 1);
  mock.stream.push({ type: 'text-start', id: 't' }, { type: 'text-delta', id: 't', delta: 'Hello' });
  mock.stream.close();
  await request;

  expect(chat.signals.status()).toBe('ready');
  expect(seen.at(-1)).toEqual(['hi', 'Hello']);
  dispose();
});
