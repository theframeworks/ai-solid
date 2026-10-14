// Ported from @ai-sdk/vue's src/use-chat.ts (useChat), Apache-2.0, Copyright 2023 Vercel, Inc.
// Changes: refs became accessors, the writable messages ref became setMessages, and a reactive
// init is an accessor rather than a Vue getter or ref.
import type { AbstractChat, ChatStatus, UIMessage } from 'ai';
import { type Accessor, createComputed, createSignal, getOwner, onCleanup, untrack } from 'solid-js';
import { Chat, type ChatOptions, detachChat } from './chat.js';

/** What {@link createChat} returns: the chat's methods, and accessors for its state. */
export interface ChatHelpers<UI_MESSAGE extends UIMessage>
  extends Pick<
    AbstractChat<UI_MESSAGE>,
    'sendMessage' | 'regenerate' | 'stop' | 'resumeStream' | 'addToolOutput' | 'addToolApprovalResponse' | 'clearError'
  > {
  /** The id of the chat. */
  id: Accessor<string>;
  /** The messages; a streaming message never replaces the other messages' objects. */
  messages: Accessor<UI_MESSAGE[]>;
  /** Replaces the messages, for example to restore or trim a conversation. */
  setMessages: (messages: UI_MESSAGE[] | ((previous: UI_MESSAGE[]) => UI_MESSAGE[])) => void;
  /** 'submitted', 'streaming', 'ready' or 'error'. */
  status: Accessor<ChatStatus>;
  /** The current error, if any. */
  error: Accessor<Error | undefined>;
}

/**
 * Creates a chat whose messages, status and error are Solid accessors.
 *
 * Pass an accessor instead of an options object to recreate the chat whenever the accessor's
 * value changes, for example when the chat `id` comes from a prop. When created under an owner
 * (a component or root), the chat stops publishing when the owner is disposed; a running request
 * isn't aborted and the transport isn't closed, since the caller owns the transport.
 *
 * @example
 * const chat = createChat({ transport: new DefaultChatTransport({ api: '/api/chat' }) });
 * <Index each={chat.messages()}>{(message) => <Message message={message()} />}</Index>
 */
export function createChat<UI_MESSAGE extends UIMessage = UIMessage>(
  options?: ChatOptions<UI_MESSAGE> | Accessor<ChatOptions<UI_MESSAGE>>,
): ChatHelpers<UI_MESSAGE> {
  const build = (init: ChatOptions<UI_MESSAGE> | undefined) => untrack(() => new Chat<UI_MESSAGE>(init));

  let current: Accessor<Chat<UI_MESSAGE>>;
  if (typeof options === 'function') {
    const [chat, setChat] = createSignal<Chat<UI_MESSAGE>>(build(untrack(options)));
    let first = true;
    createComputed(() => {
      const init = options();
      if (first) {
        first = false;
        return;
      }
      detachChat(untrack(chat));
      setChat(build(init));
    });
    current = chat;
  } else {
    const chat = build(options);
    current = () => chat;
  }

  if (getOwner() != null) {
    onCleanup(() => detachChat(untrack(current)));
  }

  const chat = () => untrack(current);

  return {
    id: () => current().id,
    messages: () => current().signals.messages(),
    status: () => current().signals.status(),
    error: () => current().signals.error(),
    setMessages: (messages) => {
      const target = chat();
      target.messages = typeof messages === 'function' ? messages(target.messages) : messages;
    },
    sendMessage: (...args) => chat().sendMessage(...args),
    regenerate: (...args) => chat().regenerate(...args),
    stop: () => chat().stop(),
    resumeStream: (...args) => chat().resumeStream(...args),
    addToolOutput: (...args) => chat().addToolOutput(...args),
    addToolApprovalResponse: (...args) => chat().addToolApprovalResponse(...args),
    clearError: () => chat().clearError(),
  };
}
