import { batch, createSignal } from 'solid-js';
function cloneMetadata(metadata) {
    if (Array.isArray(metadata)) {
        return [...metadata];
    }
    if (metadata != null &&
        typeof metadata === 'object' &&
        (Object.getPrototypeOf(metadata) === Object.prototype || Object.getPrototypeOf(metadata) === null)) {
        return { ...metadata };
    }
    return metadata;
}
function snapshotValue(value) {
    if (value == null || typeof value !== 'object' || !('parts' in value) || !Array.isArray(value.parts)) {
        return value;
    }
    const message = value;
    const snapshot = {
        ...message,
        parts: message.parts.map((part) => ({ ...part })),
    };
    if ('metadata' in message) {
        snapshot.metadata = cloneMetadata(message.metadata);
    }
    return snapshot;
}
/**
 * The chat's state as `AbstractChat` sees it, published to Solid signals.
 *
 * `AbstractChat` mutates the streaming message in place. Each publication hands the signals a
 * new array in which only the changed messages are fresh snapshots: unchanged messages keep their
 * object, so a `<For>` or `mapArray` over them doesn't re-run. With `throttleWaitMs`, the first
 * change publishes at once and later ones coalesce to one publication per interval; `ready` and
 * `error` flush the latest messages before the status changes.
 */
export class SolidChatState {
    messagesValue;
    publishedMessages = [];
    publishedMessageSources = [];
    dirtyMessageIndices = new Set();
    statusValue = 'ready';
    errorValue;
    throttleWaitMs;
    timeout;
    hasPendingPublication = false;
    isActive = true;
    setMessagesSignal;
    setStatusSignal;
    setErrorSignal;
    messagesSignal;
    statusSignal;
    errorSignal;
    constructor({ initialMessages, throttleWaitMs }) {
        this.messagesValue = [...initialMessages];
        this.throttleWaitMs =
            throttleWaitMs != null && Number.isFinite(throttleWaitMs) && throttleWaitMs > 0 ? throttleWaitMs : undefined;
        // Equality is by reference: a publication always hands over a new array.
        [this.messagesSignal, this.setMessagesSignal] = createSignal([]);
        [this.statusSignal, this.setStatusSignal] = createSignal(this.statusValue);
        [this.errorSignal, this.setErrorSignal] = createSignal(this.errorValue);
        this.publishMessages();
    }
    get messages() {
        return this.messagesValue;
    }
    set messages(messages) {
        const previousMessages = this.messagesValue;
        this.messagesValue = messages;
        for (let index = 0; index < messages.length; index++) {
            if (messages[index] !== previousMessages[index]) {
                this.dirtyMessageIndices.add(index);
            }
        }
        this.schedulePublication();
    }
    get status() {
        return this.statusValue;
    }
    set status(status) {
        this.statusValue = status;
        if (!this.isActive) {
            return;
        }
        batch(() => {
            if (status === 'ready' || status === 'error') {
                // Terminal states must never become observable before the final message.
                this.flushPublication();
            }
            this.setStatusSignal(status);
        });
    }
    get error() {
        return this.errorValue;
    }
    set error(error) {
        this.errorValue = error;
        if (this.isActive) {
            this.setErrorSignal(() => error);
        }
    }
    pushMessage = (message) => {
        this.messagesValue.push(message);
        this.dirtyMessageIndices.add(this.messagesValue.length - 1);
        this.schedulePublication();
    };
    popMessage = () => {
        this.messagesValue.pop();
        this.schedulePublication();
    };
    replaceMessage = (index, message) => {
        this.messagesValue[index] = message;
        this.dirtyMessageIndices.add(index);
        this.schedulePublication();
    };
    snapshot = snapshotValue;
    /** Stops publishing: pending throttled updates are dropped and the signals keep their values. */
    dispose() {
        this.isActive = false;
        this.hasPendingPublication = false;
        this.dirtyMessageIndices.clear();
        this.publishedMessages = [];
        this.publishedMessageSources = [];
        if (this.timeout != null) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }
    }
    schedulePublication() {
        if (!this.isActive) {
            return;
        }
        if (this.throttleWaitMs == null) {
            this.publishMessages();
            return;
        }
        if (this.timeout == null) {
            // Publish the leading update immediately, then coalesce updates until
            // the next interval boundary.
            this.publishMessages();
            this.timeout = setTimeout(this.handleIntervalEnd, this.throttleWaitMs);
        }
        else {
            this.hasPendingPublication = true;
        }
    }
    handleIntervalEnd = () => {
        this.timeout = undefined;
        if (!this.isActive || !this.hasPendingPublication) {
            return;
        }
        this.hasPendingPublication = false;
        this.publishMessages();
        this.timeout = setTimeout(this.handleIntervalEnd, this.throttleWaitMs);
    };
    flushPublication() {
        if (this.timeout != null) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }
        this.hasPendingPublication = false;
        this.publishMessages();
    }
    publishMessages() {
        if (!this.isActive) {
            return;
        }
        const publishedMessages = this.messagesValue.map((message, index) => this.dirtyMessageIndices.has(index) || this.publishedMessageSources[index] !== message
            ? snapshotValue(message)
            : this.publishedMessages[index]);
        this.publishedMessages = publishedMessages;
        this.publishedMessageSources = [...this.messagesValue];
        this.dirtyMessageIndices.clear();
        this.setMessagesSignal(publishedMessages);
    }
}
//# sourceMappingURL=chat-state.js.map