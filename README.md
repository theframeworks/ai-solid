# @theframeworks/ai-solid

A Solid adapter for the chat in Vercel's [`ai`](https://ai-sdk.dev) SDK, v7. It's a port of the official `@ai-sdk/vue` adapter's chat files to Solid signals: `ai`'s `AbstractChat` does the work, and this package publishes its state as accessors.

Chat only: it exports `createChat()` and `Chat`, with no completion or object helpers.

## Install

It isn't on npm. Install it from GitHub by tag range; the tagged commits carry the built `dist/`, so there's no build step:

```sh
pnpm add github:theframeworks/ai-solid#semver:^0.1.0
```

Peer dependencies: `ai` `^7` and `solid-js` `^1.9` (below 2.0).

## Use

```tsx
import { createChat } from '@theframeworks/ai-solid';
import { DefaultChatTransport } from 'ai';
import { createSignal, Index, Show } from 'solid-js';

export default function Assistant() {
  const chat = createChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    throttle: 50,
  });
  const [input, setInput] = createSignal('');

  return (
    <div>
      <Index each={chat.messages()}>
        {(message) => (
          <p>
            {message().role}:{' '}
            {message().parts.map((part) => (part.type === 'text' ? part.text : '')).join('')}
          </p>
        )}
      </Index>
      <Show when={chat.error()}>{(error) => <p role="alert">{error().message}</p>}</Show>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void chat.sendMessage({ text: input() });
          setInput('');
        }}
      >
        <input value={input()} onInput={(event) => setInput(event.currentTarget.value)} />
        <Show when={chat.status() === 'ready' || chat.status() === 'error'} fallback={<button type="button" onClick={() => void chat.stop()}>Stop</button>}>
          <button type="submit">Send</button>
        </Show>
      </form>
    </div>
  );
}
```

### `createChat(options?)`

`options` is `ai`'s `ChatInit` (`id`, `messages`, `transport`, `generateId`, `onError`, `onFinish`, `onToolCall`, `onData`, `sendAutomaticallyWhen`, schemas) plus `throttle`, in milliseconds. Pass an accessor instead of an object to recreate the chat when it changes, for example `createChat(() => ({ id: props.id, transport }))`.

It returns:

- `messages()`, `status()`, `error()`, `id()`: accessors.
- `setMessages(messages | (previous) => messages)`.
- `sendMessage`, `regenerate`, `stop`, `resumeStream`, `addToolOutput`, `addToolApprovalResponse`, `clearError`: `AbstractChat`'s methods.

Created under an owner (a component or a root), the chat stops publishing when the owner is disposed. That doesn't abort a running request or close the transport: whoever created the transport owns it.

### `Chat`

The class `createChat` builds on: an `AbstractChat` whose state lives in signals. Create one at module level to share a chat between islands, and read `chat.signals.messages()`, `chat.signals.status()` and `chat.signals.error()` in JSX. Its inherited `messages`, `status` and `error` are the live values and aren't tracked.

### Reactivity

`AbstractChat` mutates the streaming message in place. Each update publishes a new messages array in which only the changed message is a fresh object; every other message keeps its object. So `<For>` or `mapArray` re-runs only the streaming message's row. With `<Index>`, no row re-runs: the streaming row's `message()` accessor updates instead, which suits a markdown renderer that streams.

With `throttle`, the first update publishes at once and later ones at most once per interval. A reply that ends, stops or fails publishes its last update before `status()` changes.

## Upkeep

This package follows `@ai-sdk/vue`. **Each `ai` upgrade compares `@ai-sdk/vue`'s chat files (`src/use-chat.ts`, `src/chat.vue.ts`) between the previously ported version and the new one, and ports the changes.** Last ported from `@ai-sdk/vue@4.0.139` (`ai@7.0.139`).

```sh
npm pack @ai-sdk/vue@<old> @ai-sdk/vue@<new>   # each tarball has src/
diff -u <old>/package/src/use-chat.ts <new>/package/src/use-chat.ts
```

Then update the version above, the `ai` dev dependency and, if `ai` changed `AbstractChat` or `ChatState`, the tests. The CI's weekly `latest-ai` job runs the tests against the latest `ai`, so a break shows there first.

## Develop and release

- `pnpm check` type checks, runs the tests (Vitest with a mock transport) and builds `dist/`.
- To release, bump `version` in `package.json` on `main`, then run the **Release** workflow (`gh workflow run release.yml`). It builds `dist/`, commits it on a release commit only the tag points at, tags `v<version>`, and creates the GitHub release. `main` never carries `dist/`.

## Licence

MIT. The chat files are ported from `@ai-sdk/vue`, Copyright 2023 Vercel, Inc., under the Apache License 2.0: see `NOTICE` and `licenses/`.
