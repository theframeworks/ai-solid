import { createComputed, createSignal, getOwner, onCleanup, untrack } from 'solid-js';
import { Chat, detachChat } from './chat.js';
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
export function createChat(options) {
    const build = (init) => untrack(() => new Chat(init));
    let current;
    if (typeof options === 'function') {
        const [chat, setChat] = createSignal(build(untrack(options)));
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
    }
    else {
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
//# sourceMappingURL=create-chat.js.map