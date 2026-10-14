// Ported from @ai-sdk/vue's src/use-chat.ts (VueChat), Apache-2.0, Copyright 2023 Vercel, Inc.
import { AbstractChat, type ChatInit, type ChatStatus, type UIMessage } from 'ai';
import type { Accessor } from 'solid-js';
import { SolidChatState } from './chat-state.js';

export type ChatOptions<UI_MESSAGE extends UIMessage> = ChatInit<UI_MESSAGE> & {
  /**
   * Throttle wait time in milliseconds for reactive message updates. Positive values enable
   * throttling. Defaults to undefined, which publishes every update.
   */
  throttle?: number;
};

const states = new WeakMap<object, { dispose(): void }>();

/**
 * An `ai` chat whose state lives in Solid signals.
 *
 * `messages`, `status` and `error` (inherited from `AbstractChat`) are the chat's live, untracked
 * values. Read `signals` in JSX and effects instead: they're tracked, and a streaming message
 * never replaces the other messages' objects.
 */
export class Chat<UI_MESSAGE extends UIMessage = UIMessage> extends AbstractChat<UI_MESSAGE> {
  /** Tracked reads of the chat's published messages, status and error. */
  readonly signals: {
    readonly messages: Accessor<UI_MESSAGE[]>;
    readonly status: Accessor<ChatStatus>;
    readonly error: Accessor<Error | undefined>;
  };

  constructor({ messages, throttle, ...init }: ChatOptions<UI_MESSAGE> = {}) {
    const state = new SolidChatState<UI_MESSAGE>({ initialMessages: messages ?? [], throttleWaitMs: throttle });
    super({ ...init, state });
    this.signals = { messages: state.messagesSignal, status: state.statusSignal, error: state.errorSignal };
    states.set(this, state);
  }
}

/** Stops `chat` publishing to its signals, without stopping its request or closing its transport. */
export function detachChat(chat: object) {
  states.get(chat)?.dispose();
}
