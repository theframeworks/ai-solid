import type { ChatState, ChatStatus, UIMessage } from 'ai';
import { type Accessor } from 'solid-js';
declare function snapshotValue<T>(value: T): T;
/**
 * The chat's state as `AbstractChat` sees it, published to Solid signals.
 *
 * `AbstractChat` mutates the streaming message in place. Each publication hands the signals a
 * new array in which only the changed messages are fresh snapshots: unchanged messages keep their
 * object, so a `<For>` or `mapArray` over them doesn't re-run. With `throttleWaitMs`, the first
 * change publishes at once and later ones coalesce to one publication per interval; `ready` and
 * `error` flush the latest messages before the status changes.
 */
export declare class SolidChatState<UI_MESSAGE extends UIMessage> implements ChatState<UI_MESSAGE> {
    private messagesValue;
    private publishedMessages;
    private publishedMessageSources;
    private readonly dirtyMessageIndices;
    private statusValue;
    private errorValue;
    private readonly throttleWaitMs;
    private timeout;
    private hasPendingPublication;
    private isActive;
    private readonly setMessagesSignal;
    private readonly setStatusSignal;
    private readonly setErrorSignal;
    readonly messagesSignal: Accessor<UI_MESSAGE[]>;
    readonly statusSignal: Accessor<ChatStatus>;
    readonly errorSignal: Accessor<Error | undefined>;
    constructor({ initialMessages, throttleWaitMs }: {
        initialMessages: UI_MESSAGE[];
        throttleWaitMs?: number | undefined;
    });
    get messages(): UI_MESSAGE[];
    set messages(messages: UI_MESSAGE[]);
    get status(): ChatStatus;
    set status(status: ChatStatus);
    get error(): Error | undefined;
    set error(error: Error | undefined);
    pushMessage: (message: UI_MESSAGE) => void;
    popMessage: () => void;
    replaceMessage: (index: number, message: UI_MESSAGE) => void;
    snapshot: typeof snapshotValue;
    /** Stops publishing: pending throttled updates are dropped and the signals keep their values. */
    dispose(): void;
    private schedulePublication;
    private readonly handleIntervalEnd;
    private flushPublication;
    private publishMessages;
}
export {};
//# sourceMappingURL=chat-state.d.ts.map