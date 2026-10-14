import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai';

type SendOptions = Parameters<ChatTransport<UIMessage>['sendMessages']>[0];

/** A stream the test writes chunks into by hand. */
export function controlledStream() {
  let controller!: ReadableStreamDefaultController<UIMessageChunk>;
  const stream = new ReadableStream<UIMessageChunk>({
    start(c) {
      controller = c;
    },
  });
  return {
    stream,
    push: (...chunks: UIMessageChunk[]) => {
      for (const chunk of chunks) controller.enqueue(chunk);
    },
    close: () => controller.close(),
  };
}

/**
 * A transport whose every request gets a fresh controlled stream. `sent` records each request,
 * `reconnect` is what `reconnectToStream` answers.
 */
export function mockTransport() {
  const sent: SendOptions[] = [];
  const streams: ReturnType<typeof controlledStream>[] = [];
  let reconnect: ReadableStream<UIMessageChunk> | null = null;
  let failWith: Error | undefined;

  const transport: ChatTransport<UIMessage> = {
    sendMessages: async (options) => {
      sent.push({ ...options, messages: structuredClone(options.messages) });
      if (failWith) throw failWith;
      const s = controlledStream();
      streams.push(s);
      options.abortSignal?.addEventListener('abort', () => {
        try {
          s.close();
        } catch {
          // already closed
        }
      });
      return s.stream;
    },
    reconnectToStream: async () => reconnect,
  };

  return {
    transport,
    sent,
    /** The stream of the latest request. */
    get stream() {
      const s = streams.at(-1);
      if (!s) throw new Error('No request has been sent');
      return s;
    },
    setReconnect(stream: ReadableStream<UIMessageChunk> | null) {
      reconnect = stream;
    },
    failNextWith(error: Error) {
      failWith = error;
    },
  };
}

export function sequentialIds() {
  let n = 0;
  return () => `id-${++n}`;
}

export function textOf(message: UIMessage | undefined) {
  return message?.parts.map((p) => (p.type === 'text' ? p.text : '')).join('');
}

/** Lets queued microtasks (stream reads, job executor) run until `condition` holds. */
export async function until(condition: () => boolean) {
  for (let i = 0; i < 200; i++) {
    if (condition()) return;
    await new Promise<void>((resolve) => queueMicrotask(resolve));
  }
  throw new Error('Condition was not met');
}
