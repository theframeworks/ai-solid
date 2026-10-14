import type { AbstractChat, ChatStatus, UIMessage } from 'ai';
import { type Accessor } from 'solid-js';
import { type ChatOptions } from './chat.js';
/** What {@link createChat} returns: the chat's methods, and accessors for its state. */
export interface ChatHelpers<UI_MESSAGE extends UIMessage> extends Pick<AbstractChat<UI_MESSAGE>, 'sendMessage' | 'regenerate' | 'stop' | 'resumeStream' | 'addToolOutput' | 'addToolApprovalResponse' | 'clearError'> {
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
export declare function createChat<UI_MESSAGE extends UIMessage = UIMessage>(options?: ChatOptions<UI_MESSAGE> | Accessor<ChatOptions<UI_MESSAGE>>): ChatHelpers<UI_MESSAGE>;
//# sourceMappingURL=create-chat.d.ts.map