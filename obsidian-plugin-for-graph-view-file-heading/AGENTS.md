# Obsidian Plugin: Graph View File Heading

## Overview

An Obsidian plugin that improves how files are displayed in the **Graph View**:
shows each file's first heading (H1, H2, etc.), falling back to the parent
folder name for `index.md` files or the filename (without extension) for all
other files.

## Commands

Use pnpm not npm.

Build:

```sh
pnpm run build
```

Lint with eslint:

```sh
pnpm dlx eslint
```

Test with vitest not jest:

```sh
pnpm run test
```

## Architecture

Single source file: `src/main.ts`

### Type Definitions

Three interfaces model the untyped Obsidian graph internals:

- `GraphNode` — a graph node with `id`, `text.text`, and `getDisplayText()`.
- `GraphNodePrototype` — the prototype with `getDisplayText` (typed with `this: GraphNode`) and the `_graphViewFileHeadingPatched` flag.
- `GraphRenderer` — the renderer with `nodes` (typed as `unknown` since it varies) and optional `changed()` method.

These are cast from `Object.getPrototypeOf()`, `view.renderer`, etc. to satisfy strict ESLint rules (`@typescript-eslint/no-unsafe-*`).

### Graph View Patching

- Graph labels are PIXI.js text objects on a WebGL canvas (not DOM elements).
- Monkey-patches `getDisplayText()` on the graph node prototype via `Object.getPrototypeOf(node)`, cast to `GraphNodePrototype`.
- The patched function captures `displayNameMap` and `originalGetDisplayText` directly (not `this` alias) to avoid the `@typescript-eslint/no-this-alias` rule.
- Sets `node.text.text` for each existing node, then calls `renderer.changed()` to trigger re-draw.
- Restores the original prototype method on unload.
- Node ids include the `.md` extension (e.g. `folder/index.md`), so the display name map stores both with and without `.md`.
- The patched `getDisplayText` uses try/catch to prevent errors from breaking the graph renderer.

### Display Name Resolution

`rebuildMap()` iterates all vault markdown files and resolves display names via:

1. First heading from `app.metadataCache.getFileCache(file)?.headings?.[0]?.heading`
2. Fallback for `index.md`: parent folder name
3. Fallback for all other files: filename without extension (`file.basename`)

The map is cached and rebuilt on vault changes and metadata resolution.

### Node Collection Handling

`getNodes()` accepts a `GraphRenderer` and handles `renderer.nodes` being a `Map`, `Set`, `Array`, or Obsidian's custom collection type. Returns typed `GraphNode[]`.

## Testing

Tests are in `src/main.test.ts` using Vitest. Run with `pnpm run test`.

The test suite mocks the `obsidian` module (the `Plugin` base class and its `app` object) so all tests run without Obsidian. Coverage areas:

- **onload**: Verifies all event listener registrations (onLayoutReady, resolved, create, rename, delete, layout-change).
- **onunload**: Safe when nothing was patched, safe to call multiple times.
- **rebuildMap**: First heading, index.md parent folder fallback, basename fallback, skips non-markdown files, stores both with/without `.md`, uses any heading level, clears and rebuilds.
- **getNodes**: Handles `Map`, `Array`, `Set`, `null`, and non-iterable node collections.
- **patchGraphViews**: Patches prototype, falls back to original for unknown ids, prevents double-patching, skips/calls `renderer.changed()` appropriately, uses `dataEngine` fallback, patches both graph and localgraph.
- **unpatchPrototype**: Restores original `getDisplayText`, removes patched flag.

Helper functions (`mockFile`, `createNodesWithProto`, `mockLeaf`) create mock graph nodes with shared prototypes to test the monkey-patching behavior.

## Linting

ESLint config is in `eslint.config.mts`. Uses three layers:

1. **typescript-eslint** — strict type-checked rules including `no-unsafe-*` and `no-this-alias`.
2. **eslint-plugin-obsidianmd** `recommended` config plus all individual rules enabled explicitly:
   - Error level: `commands/no-command-in-command-id`, `commands/no-command-in-command-name`, `commands/no-plugin-id-in-command-id`, `commands/no-plugin-name-in-command-name`, `detach-leaves`, `no-forbidden-elements`, `no-plugin-as-component`, `no-sample-code`, `no-tfile-tfolder-cast`, `no-view-references-in-plugin`, `platform`, `prefer-abstract-input-suggest`, `prefer-file-manager-trash-file`, `regex-lookbehind`, `settings-tab/no-manual-html-headings`, `settings-tab/no-problematic-settings-headings`, `vault/iterate`.
   - Warn level: `commands/no-default-hotkeys`, `hardcoded-config-path`, `no-static-styles-assignment`, `object-assign`, `sample-names`, `ui/sentence-case`.
3. **Test file overrides** (`src/**/*.test.ts`) — disables `no-unsafe-*`, `no-unsafe-argument`, and `unbound-method` since test mocks require loose typing.

Test files are excluded from `tsconfig.json` (build) but included in ESLint via `allowDefaultProject`.

## Key Implementation Details

- Graph view requires a `setTimeout` delay (2000ms on load, 500ms on layout change) because the renderer populates nodes asynchronously.
- The `_graphViewFileHeadingPatched` flag on the prototype prevents double-patching.
- `renderer.changed()` is only called when node text was actually modified, avoiding unnecessary re-render cycles.
- `onunload()` restores the original `getDisplayText` prototype method.
- `onload()` is synchronous (not `async`) since no `await` expressions are needed.

## License

SPDX: `MIT OR GPL-2.0-only OR GPL-3.0-only OR Apache-2.0`

## Author

Joel Parker Henderson (joel@joelparkerhenderson.com)
