// Ported from @ai-sdk/vue's src/use-chat.ts (VueChatState), Apache-2.0, Copyright 2023 Vercel, Inc.
// Changes: Vue shallow refs became Solid signals, and each state owns its own signals.
import type { ChatState, ChatStatus, UIMessage } from 'ai';
import { type Accessor, batch, createSignal, type Setter } from 'solid-js';

function cloneMetadata<METADATA>(metadata: METADATA): METADATA {
  if (Array.isArray(metadata)) {
    return [...metadata] as METADATA;
  }

  if (
    metadata != null &&
    typeof metadata === 'object' &&
    (Object.getPrototypeOf(metadata) === Object.prototype || Object.getPrototypeOf(metadata) === null)
  ) {
    return { ...metadata } as METADATA;
  }

  return metadata;
}

function snapshotValue<T>(value: T): T {
  if (value == null || typeof value !== 'object' || !('parts' in value) || !Array.isArray(value.parts)) {
    return value;
  }

  const message = value as unknown as UIMessage;
  const snapshot = {
    ...message,
    parts: message.parts.map((part) => ({ ...part })),
  };

  if ('metadata' in message) {
    snapshot.metadata = cloneMetadata(message.metadata);
  }

  return snapshot as T;
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
export class SolidChatState<UI_MESSAGE extends UIMessage> implements ChatState<UI_MESSAGE> {
  private messagesValue: UI_MESSAGE[];
  private publishedMessages: UI_MESSAGE[] = [];
  private publishedMessageSources: UI_MESSAGE[] = [];
  private readonly dirtyMessageIndices = new Set<number>();
  private statusValue: ChatStatus = 'ready';
  private errorValue: Error | undefined;
  private readonly throttleWaitMs: number | undefined;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private hasPendingPublication = false;
  private isActive = true;

  private readonly setMessagesSignal: Setter<UI_MESSAGE[]>;
  private readonly setStatusSignal: Setter<ChatStatus>;
  private readonly setErrorSignal: Setter<Error | undefined>;

  readonly messagesSignal: Accessor<UI_MESSAGE[]>;
  readonly statusSignal: Accessor<ChatStatus>;
  readonly errorSignal: Accessor<Error | undefined>;

  constructor({ initialMessages, throttleWaitMs }: { initialMessages: UI_MESSAGE[]; throttleWaitMs?: number | undefined }) {
    this.messagesValue = [...initialMessages];
    this.throttleWaitMs =
      throttleWaitMs != null && Number.isFinite(throttleWaitMs) && throttleWaitMs > 0 ? throttleWaitMs : undefined;

    // Equality is by reference: a publication always hands over a new array.
    [this.messagesSignal, this.setMessagesSignal] = createSignal<UI_MESSAGE[]>([]);
    [this.statusSignal, this.setStatusSignal] = createSignal<ChatStatus>(this.statusValue);
    [this.errorSignal, this.setErrorSignal] = createSignal<Error | undefined>(this.errorValue);

    this.publishMessages();
  }

  get messages(): UI_MESSAGE[] {
    return this.messagesValue;
  }

  set messages(messages: UI_MESSAGE[]) {
    const previousMessages = this.messagesValue;
    this.messagesValue = messages;

    for (let index = 0; index < messages.length; index++) {
      if (messages[index] !== previousMessages[index]) {
        this.dirtyMessageIndices.add(index);
      }
    }

    this.schedulePublication();
  }

  get status(): ChatStatus {
    return this.statusValue;
  }

  set status(status: ChatStatus) {
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

  get error(): Error | undefined {
    return this.errorValue;
  }

  set error(error: Error | undefined) {
    this.errorValue = error;

    if (this.isActive) {
      this.setErrorSignal(() => error);
    }
  }

  pushMessage = (message: UI_MESSAGE) => {
    this.messagesValue.push(message);
    this.dirtyMessageIndices.add(this.messagesValue.length - 1);
    this.schedulePublication();
  };

  popMessage = () => {
    this.messagesValue.pop();
    this.schedulePublication();
  };

  replaceMessage = (index: number, message: UI_MESSAGE) => {
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

  private schedulePublication() {
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
    } else {
      this.hasPendingPublication = true;
    }
  }

  private readonly handleIntervalEnd = () => {
    this.timeout = undefined;

    if (!this.isActive || !this.hasPendingPublication) {
      return;
    }

    this.hasPendingPublication = false;
    this.publishMessages();
    this.timeout = setTimeout(this.handleIntervalEnd, this.throttleWaitMs);
  };

  private flushPublication() {
    if (this.timeout != null) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }

    this.hasPendingPublication = false;
    this.publishMessages();
  }

  private publishMessages() {
    if (!this.isActive) {
      return;
    }

    const publishedMessages = this.messagesValue.map((message, index) =>
      this.dirtyMessageIndices.has(index) || this.publishedMessageSources[index] !== message
        ? snapshotValue(message)
        : (this.publishedMessages[index] as UI_MESSAGE),
    );

    this.publishedMessages = publishedMessages;
    this.publishedMessageSources = [...this.messagesValue];
    this.dirtyMessageIndices.clear();

    this.setMessagesSignal(publishedMessages);
  }
}
