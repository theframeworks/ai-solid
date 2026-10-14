// Ported from @ai-sdk/vue's src/use-chat.ts (VueChat), Apache-2.0, Copyright 2023 Vercel, Inc.
import { AbstractChat } from 'ai';
import { SolidChatState } from './chat-state.js';
const states = new WeakMap();
/**
 * An `ai` chat whose state lives in Solid signals.
 *
 * `messages`, `status` and `error` (inherited from `AbstractChat`) are the chat's live, untracked
 * values. Read `signals` in JSX and effects instead: they're tracked, and a streaming message
 * never replaces the other messages' objects.
 */
export class Chat extends AbstractChat {
    /** Tracked reads of the chat's published messages, status and error. */
    signals;
    constructor({ messages, throttle, ...init } = {}) {
        const state = new SolidChatState({ initialMessages: messages ?? [], throttleWaitMs: throttle });
        super({ ...init, state });
        this.signals = { messages: state.messagesSignal, status: state.statusSignal, error: state.errorSignal };
        states.set(this, state);
    }
}
/** Stops `chat` publishing to its signals, without stopping its request or closing its transport. */
export function detachChat(chat) {
    states.get(chat)?.dispose();
}
//# sourceMappingURL=chat.js.map