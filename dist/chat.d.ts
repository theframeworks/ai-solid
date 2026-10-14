import { AbstractChat, type ChatInit, type ChatStatus, type UIMessage } from 'ai';
import type { Accessor } from 'solid-js';
export type ChatOptions<UI_MESSAGE extends UIMessage> = ChatInit<UI_MESSAGE> & {
    /**
     * Throttle wait time in milliseconds for reactive message updates. Positive values enable
     * throttling. Defaults to undefined, which publishes every update.
     */
    throttle?: number;
};
/**
 * An `ai` chat whose state lives in Solid signals.
 *
 * `messages`, `status` and `error` (inherited from `AbstractChat`) are the chat's live, untracked
 * values. Read `signals` in JSX and effects instead: they're tracked, and a streaming message
 * never replaces the other messages' objects.
 */
export declare class Chat<UI_MESSAGE extends UIMessage = UIMessage> extends AbstractChat<UI_MESSAGE> {
    /** Tracked reads of the chat's published messages, status and error. */
    readonly signals: {
        readonly messages: Accessor<UI_MESSAGE[]>;
        readonly status: Accessor<ChatStatus>;
        readonly error: Accessor<Error | undefined>;
    };
    constructor({ messages, throttle, ...init }?: ChatOptions<UI_MESSAGE>);
}
/** Stops `chat` publishing to its signals, without stopping its request or closing its transport. */
export declare function detachChat(chat: object): void;
//# sourceMappingURL=chat.d.ts.map