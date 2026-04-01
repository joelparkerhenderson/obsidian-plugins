# Graph View File Heading

An [Obsidian](https://obsidian.md) plugin that replaces filenames with headings in the **Graph View**. Instead of seeing raw filenames like `my-note.md`, you see each file's first heading (H1, H2, etc.), making the graph more readable and meaningful.

## Features

- **Heading display**: Shows each file's first heading (any level: H1, H2, H3, etc.) as the graph node label.
- **Smart fallbacks**: If a file has no heading, the plugin falls back gracefully:
  - For `index.md` files: shows the parent folder name.
  - For all other files: shows the filename without the `.md` extension.
- **Automatic updates**: The graph updates when you create, rename, or delete files, and when metadata changes.
- **Both graph types**: Works with both the global Graph View and the local graph.
- **Clean unload**: Restores original graph behavior when the plugin is disabled.

## Examples

| File | First Heading | Graph Label |
|------|---------------|-------------|
| `projects/index.md` | `# My Projects` | My Projects |
| `projects/index.md` | *(none)* | projects |
| `daily/2024-01-15.md` | `# Monday Standup` | Monday Standup |
| `daily/2024-01-15.md` | *(none)* | 2024-01-15 |
| `ideas.md` | `## Brainstorm` | Brainstorm |
| `ideas.md` | *(none)* | ideas |

## Installation

### From Obsidian Community Plugins

1. Open **Settings** > **Community plugins** > **Browse**.
2. Search for **Graph View File Heading**.
3. Click **Install**, then **Enable**.

### Manual Installation

1. Download `main.js` and `manifest.json` from the latest release.
2. Create a folder in your vault: `.obsidian/plugins/graph-view-file-heading/`.
3. Copy `main.js` and `manifest.json` into that folder.
4. Open **Settings** > **Community plugins** and enable **Graph View File Heading**.

## How It Works

The plugin monkey-patches the `getDisplayText()` method on graph node prototypes. Graph labels in Obsidian are PIXI.js text objects rendered on a WebGL canvas (not DOM elements), so the plugin directly sets `node.text.text` for each node and calls `renderer.changed()` to trigger a re-draw.

### Display Name Resolution

For each markdown file in the vault, the plugin resolves a display name using this priority:

1. **First heading** from the file's metadata cache (`headings[0].heading`).
2. **Parent folder name** if the file is `index.md` and has no heading.
3. **Filename** (without `.md` extension) for all other files without a heading.

The resolved names are cached in a map and rebuilt automatically when vault contents or metadata change.

### Event Handling

The plugin listens for several events to keep the graph labels in sync:

- `metadataCache.resolved` -- heading content changed.
- `vault.create` -- new file added.
- `vault.rename` -- file renamed or moved.
- `vault.delete` -- file removed.
- `workspace.layout-change` -- graph view opened or layout changed.

## Building from Source

```sh
pnpm install
pnpm run build
```

This runs TypeScript type checking followed by an esbuild production build, producing `main.js` in the project root.

### Development

```sh
pnpm run dev
```

Runs esbuild in watch mode for rapid iteration.

### Linting

```sh
pnpm run lint
```

Runs ESLint with [typescript-eslint](https://typescript-eslint.io/) strict type-checking and the [obsidianmd ESLint plugin](https://github.com/obsidianmd/eslint-plugin) with all rules enabled. Obsidian-specific rules enforce best practices for commands, settings tabs, DOM usage, platform compatibility, and more.

### Testing

```sh
pnpm run test
```

Runs the Vitest test suite covering display name resolution, node collection handling, prototype patching/unpatching, and event listener registration.

## Compatibility

- **Minimum Obsidian version**: 0.15.0
- **Platforms**: Desktop and mobile

## License

[MIT OR GPL-2.0-only OR GPL-3.0-only OR Apache-2.0](LICENSE.md)

## Author

Joel Parker Henderson (joel@joelparkerhenderson.com)
