import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock obsidian module before importing the plugin
vi.mock('obsidian', () => ({
	Plugin: class {
		app = {
			workspace: {
				onLayoutReady: vi.fn(),
				on: vi.fn(),
				getLeavesOfType: vi.fn(() => []),
			},
			vault: {
				getFiles: vi.fn(() => []),
				on: vi.fn(),
			},
			metadataCache: {
				getFileCache: vi.fn(),
				on: vi.fn(),
			},
		};
		registerEvent = vi.fn();
	},
}));

import GraphViewFileHeadingPlugin from './main';

// Helper to create a mock file
function mockFile(opts: {
	path: string;
	name: string;
	basename: string;
	parent?: { name: string } | null;
}) {
	return {
		path: opts.path,
		name: opts.name,
		basename: opts.basename,
		parent: opts.parent ?? null,
	};
}

// Helper to create a mock graph node with a shared prototype
function createNodesWithProto(ids: string[]) {
	const proto = {
		getDisplayText() {
			return 'original';
		},
	};
	return ids.map((id) => {
		const node = Object.create(proto);
		node.id = id;
		node.text = { text: id };
		return node;
	});
}

// Helper to create a mock leaf with a renderer
function mockLeaf(nodes: unknown[], opts?: { useDataEngine?: boolean }) {
	const renderer = {
		nodes: new Map(
			(nodes as Array<{ id: string }>).map((n) => [n.id, n]),
		),
		changed: vi.fn(),
	};
	return {
		leaf: {
			view: opts?.useDataEngine
				? { dataEngine: renderer }
				: { renderer },
		},
		renderer,
	};
}

describe('GraphViewFileHeadingPlugin', () => {
	let plugin: GraphViewFileHeadingPlugin;

	beforeEach(() => {
		plugin = new GraphViewFileHeadingPlugin();
	});

	describe('onload', () => {
		it('registers onLayoutReady callback', () => {
			plugin.onload();
			expect(plugin.app.workspace.onLayoutReady).toHaveBeenCalledOnce();
		});

		it('registers five event listeners', () => {
			plugin.onload();
			expect(plugin.registerEvent).toHaveBeenCalledTimes(5);
		});

		it('registers metadata resolved event', () => {
			plugin.onload();
			expect(plugin.app.metadataCache.on).toHaveBeenCalledWith(
				'resolved',
				expect.any(Function),
			);
		});

		it('registers vault create event', () => {
			plugin.onload();
			expect(plugin.app.vault.on).toHaveBeenCalledWith(
				'create',
				expect.any(Function),
			);
		});

		it('registers vault rename event', () => {
			plugin.onload();
			expect(plugin.app.vault.on).toHaveBeenCalledWith(
				'rename',
				expect.any(Function),
			);
		});

		it('registers vault delete event', () => {
			plugin.onload();
			expect(plugin.app.vault.on).toHaveBeenCalledWith(
				'delete',
				expect.any(Function),
			);
		});

		it('registers layout-change event', () => {
			plugin.onload();
			expect(plugin.app.workspace.on).toHaveBeenCalledWith(
				'layout-change',
				expect.any(Function),
			);
		});
	});

	describe('onunload', () => {
		it('does not throw when nothing was patched', () => {
			expect(() => plugin.onunload()).not.toThrow();
		});
	});

	describe('rebuildMap (via onload + layoutReady callback)', () => {
		function triggerRebuild(files: ReturnType<typeof mockFile>[], cacheMap: Map<string, unknown>) {
			vi.mocked(plugin.app.vault.getFiles).mockReturnValue(files as never);
			vi.mocked(plugin.app.metadataCache.getFileCache).mockImplementation(
				(f: unknown) => cacheMap.get((f as { path: string }).path) as never,
			);

			plugin.onload();

			// Trigger the onLayoutReady callback
			const layoutReadyCb = vi.mocked(plugin.app.workspace.onLayoutReady).mock.calls[0]![0] as () => void;
			layoutReadyCb();
		}

		it('uses first heading as display name', () => {
			const file = mockFile({ path: 'notes/hello.md', name: 'hello.md', basename: 'hello' });
			const cacheMap = new Map([
				['notes/hello.md', { headings: [{ heading: 'My Title', level: 1 }] }],
			]);

			const nodes = createNodesWithProto(['notes/hello.md']);
			const { leaf, renderer } = mockLeaf(nodes);
			vi.mocked(plugin.app.workspace.getLeavesOfType).mockReturnValue([leaf] as never);

			triggerRebuild([file], cacheMap);

			// Trigger patchGraphViews directly (skip setTimeout)
			plugin.patchGraphViews();

			expect(nodes[0]!.text.text).toBe('My Title');
			expect(renderer.changed).toHaveBeenCalled();
		});

		it('falls back to parent folder name for index.md', () => {
			const file = mockFile({
				path: 'projects/index.md',
				name: 'index.md',
				basename: 'index',
				parent: { name: 'projects' },
			});
			const cacheMap = new Map<string, unknown>();

			const nodes = createNodesWithProto(['projects/index.md']);
			const { leaf } = mockLeaf(nodes);
			vi.mocked(plugin.app.workspace.getLeavesOfType).mockReturnValue([leaf] as never);

			triggerRebuild([file], cacheMap);
			plugin.patchGraphViews();

			expect(nodes[0]!.text.text).toBe('projects');
		});

		it('falls back to basename for non-index files without headings', () => {
			const file = mockFile({ path: 'notes/readme.md', name: 'readme.md', basename: 'readme' });
			const cacheMap = new Map<string, unknown>();

			const nodes = createNodesWithProto(['notes/readme.md']);
			const { leaf } = mockLeaf(nodes);
			vi.mocked(plugin.app.workspace.getLeavesOfType).mockReturnValue([leaf] as never);

			triggerRebuild([file], cacheMap);
			plugin.patchGraphViews();

			expect(nodes[0]!.text.text).toBe('readme');
		});

		it('skips non-markdown files', () => {
			const mdFile = mockFile({ path: 'a.md', name: 'a.md', basename: 'a' });
			const pngFile = mockFile({ path: 'b.png', name: 'b.png', basename: 'b' });
			const cacheMap = new Map<string, unknown>();

			const nodes = createNodesWithProto(['a.md', 'b.png']);
			const { leaf } = mockLeaf(nodes);
			vi.mocked(plugin.app.workspace.getLeavesOfType).mockReturnValue([leaf] as never);

			triggerRebuild([mdFile, pngFile], cacheMap);
			plugin.patchGraphViews();

			// a.md gets basename fallback; b.png keeps original text
			expect(nodes[0]!.text.text).toBe('a');
			expect(nodes[1]!.text.text).toBe('b.png');
		});

		it('stores display names with and without .md extension', () => {
			const file = mockFile({ path: 'note.md', name: 'note.md', basename: 'note' });
			const cacheMap = new Map([
				['note.md', { headings: [{ heading: 'Note Title', level: 1 }] }],
			]);

			// Node with id without .md extension
			const nodes = createNodesWithProto(['note']);
			const { leaf } = mockLeaf(nodes);
			vi.mocked(plugin.app.workspace.getLeavesOfType).mockReturnValue([leaf] as never);

			triggerRebuild([file], cacheMap);
			plugin.patchGraphViews();

			expect(nodes[0]!.text.text).toBe('Note Title');
		});

		it('uses second-level heading when no H1 exists', () => {
			const file = mockFile({ path: 'doc.md', name: 'doc.md', basename: 'doc' });
			const cacheMap = new Map([
				['doc.md', { headings: [{ heading: 'Sub Heading', level: 2 }] }],
			]);

			const nodes = createNodesWithProto(['doc.md']);
			const { leaf } = mockLeaf(nodes);
			vi.mocked(plugin.app.workspace.getLeavesOfType).mockReturnValue([leaf] as never);

			triggerRebuild([file], cacheMap);
			plugin.patchGraphViews();

			expect(nodes[0]!.text.text).toBe('Sub Heading');
		});

		it('clears map and rebuilds on subsequent calls', () => {
			const file1 = mockFile({ path: 'a.md', name: 'a.md', basename: 'a' });
			const cacheMap1 = new Map([
				['a.md', { headings: [{ heading: 'First', level: 1 }] }],
			]);

			const nodes = createNodesWithProto(['a.md']);
			const { leaf } = mockLeaf(nodes);
			vi.mocked(plugin.app.workspace.getLeavesOfType).mockReturnValue([leaf] as never);

			triggerRebuild([file1], cacheMap1);
			plugin.patchGraphViews();
			expect(nodes[0]!.text.text).toBe('First');

			// Rebuild with updated heading
			const cacheMap2 = new Map([
				['a.md', { headings: [{ heading: 'Updated', level: 1 }] }],
			]);
			vi.mocked(plugin.app.metadataCache.getFileCache).mockImplementation(
				(f: unknown) => cacheMap2.get((f as { path: string }).path) as never,
			);

			// Simulate the resolved callback triggering rebuild+patch
			const resolvedCb = vi.mocked(plugin.app.metadataCache.on).mock.calls
				.find((c) => c[0] === 'resolved')![1] as () => void;
			resolvedCb();

			expect(nodes[0]!.text.text).toBe('Updated');
		});
	});

	describe('getNodes (via patchGraphViews)', () => {
		function setupPlugin(files: ReturnType<typeof mockFile>[], cacheMap: Map<string, unknown>) {
			vi.mocked(plugin.app.vault.getFiles).mockReturnValue(files as never);
			vi.mocked(plugin.app.metadataCache.getFileCache).mockImplementation(
				(f: unknown) => cacheMap.get((f as { path: string }).path) as never,
			);
			plugin.onload();
			const layoutReadyCb = vi.mocked(plugin.app.workspace.onLayoutReady).mock.calls[0]![0] as () => void;
			layoutReadyCb();
		}

		it('handles nodes as a Map', () => {
			const file = mockFile({ path: 'a.md', name: 'a.md', basename: 'a' });
			setupPlugin([file], new Map());

			const nodes = createNodesWithProto(['a.md']);
			const renderer = {
				nodes: new Map(nodes.map((n) => [n.id, n])),
				changed: vi.fn(),
			};
			vi.mocked(plugin.app.workspace.getLeavesOfType).mockReturnValue([
				{ view: { renderer } },
			] as never);

			plugin.patchGraphViews();
			expect(nodes[0]!.text.text).toBe('a');
		});

		it('handles nodes as an Array', () => {
			const file = mockFile({ path: 'b.md', name: 'b.md', basename: 'b' });
			setupPlugin([file], new Map());

			const nodes = createNodesWithProto(['b.md']);
			const renderer = {
				nodes: nodes,
				changed: vi.fn(),
			};
			vi.mocked(plugin.app.workspace.getLeavesOfType).mockReturnValue([
				{ view: { renderer } },
			] as never);

			plugin.patchGraphViews();
			expect(nodes[0]!.text.text).toBe('b');
		});

		it('handles nodes as a Set', () => {
			const file = mockFile({ path: 'c.md', name: 'c.md', basename: 'c' });
			setupPlugin([file], new Map());

			const nodes = createNodesWithProto(['c.md']);
			const renderer = {
				nodes: new Set(nodes),
				changed: vi.fn(),
			};
			vi.mocked(plugin.app.workspace.getLeavesOfType).mockReturnValue([
				{ view: { renderer } },
			] as never);

			plugin.patchGraphViews();
			expect(nodes[0]!.text.text).toBe('c');
		});

		it('returns empty for null nodes', () => {
			const file = mockFile({ path: 'd.md', name: 'd.md', basename: 'd' });
			setupPlugin([file], new Map());

			const renderer = {
				nodes: null,
				changed: vi.fn(),
			};
			vi.mocked(plugin.app.workspace.getLeavesOfType).mockReturnValue([
				{ view: { renderer } },
			] as never);

			// Should not throw
			expect(() => plugin.patchGraphViews()).not.toThrow();
			expect(renderer.changed).not.toHaveBeenCalled();
		});

		it('returns empty for non-iterable nodes', () => {
			const file = mockFile({ path: 'e.md', name: 'e.md', basename: 'e' });
			setupPlugin([file], new Map());

			const renderer = {
				nodes: 42,
				changed: vi.fn(),
			};
			vi.mocked(plugin.app.workspace.getLeavesOfType).mockReturnValue([
				{ view: { renderer } },
			] as never);

			expect(() => plugin.patchGraphViews()).not.toThrow();
			expect(renderer.changed).not.toHaveBeenCalled();
		});
	});

	describe('patchGraphViews', () => {
		function setupWithFiles(files: ReturnType<typeof mockFile>[], cacheMap: Map<string, unknown>) {
			vi.mocked(plugin.app.vault.getFiles).mockReturnValue(files as never);
			vi.mocked(plugin.app.metadataCache.getFileCache).mockImplementation(
				(f: unknown) => cacheMap.get((f as { path: string }).path) as never,
			);
			plugin.onload();
			const layoutReadyCb = vi.mocked(plugin.app.workspace.onLayoutReady).mock.calls[0]![0] as () => void;
			layoutReadyCb();
		}

		it('patches getDisplayText on the prototype', () => {
			const file = mockFile({ path: 'x.md', name: 'x.md', basename: 'x' });
			const cacheMap = new Map([
				['x.md', { headings: [{ heading: 'Title X', level: 1 }] }],
			]);
			setupWithFiles([file], cacheMap);

			const nodes = createNodesWithProto(['x.md']);
			const { leaf } = mockLeaf(nodes);
			vi.mocked(plugin.app.workspace.getLeavesOfType).mockReturnValue([leaf] as never);

			plugin.patchGraphViews();

			// The patched getDisplayText should return the heading
			const result = nodes[0]!.getDisplayText();
			expect(result).toBe('Title X');
		});

		it('patched getDisplayText falls back to original for unknown ids', () => {
			const file = mockFile({ path: 'known.md', name: 'known.md', basename: 'known' });
			setupWithFiles([file], new Map());

			const nodes = createNodesWithProto(['known.md']);
			const { leaf } = mockLeaf(nodes);
			vi.mocked(plugin.app.workspace.getLeavesOfType).mockReturnValue([leaf] as never);

			plugin.patchGraphViews();

			// Create a new node with an unknown id sharing the same prototype
			const unknownNode = Object.create(Object.getPrototypeOf(nodes[0]));
			unknownNode.id = 'unknown.md';
			unknownNode.text = { text: 'unknown.md' };

			// Should fall back to original getDisplayText
			const result = unknownNode.getDisplayText();
			expect(result).toBe('original');
		});

		it('does not double-patch the prototype', () => {
			const file = mockFile({ path: 'f.md', name: 'f.md', basename: 'f' });
			setupWithFiles([file], new Map());

			const nodes = createNodesWithProto(['f.md']);
			const { leaf } = mockLeaf(nodes);
			vi.mocked(plugin.app.workspace.getLeavesOfType).mockReturnValue([leaf] as never);

			plugin.patchGraphViews();
			const firstPatch = nodes[0]!.getDisplayText;

			plugin.patchGraphViews();
			const secondPatch = nodes[0]!.getDisplayText;

			// Should be the same function reference (not re-patched)
			expect(firstPatch).toBe(secondPatch);
		});

		it('does not call renderer.changed when no text was modified', () => {
			const file = mockFile({ path: 'g.md', name: 'g.md', basename: 'g' });
			setupWithFiles([file], new Map());

			const nodes = createNodesWithProto(['g.md']);
			// Pre-set text to the expected display name
			nodes[0]!.text.text = 'g';

			const { leaf, renderer } = mockLeaf(nodes);
			vi.mocked(plugin.app.workspace.getLeavesOfType).mockReturnValue([leaf] as never);

			plugin.patchGraphViews();

			expect(renderer.changed).not.toHaveBeenCalled();
		});

		it('calls renderer.changed when text was modified', () => {
			const file = mockFile({ path: 'h.md', name: 'h.md', basename: 'h' });
			const cacheMap = new Map([
				['h.md', { headings: [{ heading: 'Heading H', level: 1 }] }],
			]);
			setupWithFiles([file], cacheMap);

			const nodes = createNodesWithProto(['h.md']);
			const { leaf, renderer } = mockLeaf(nodes);
			vi.mocked(plugin.app.workspace.getLeavesOfType).mockReturnValue([leaf] as never);

			plugin.patchGraphViews();

			expect(renderer.changed).toHaveBeenCalledOnce();
		});

		it('uses dataEngine when renderer is absent', () => {
			const file = mockFile({ path: 'de.md', name: 'de.md', basename: 'de' });
			setupWithFiles([file], new Map());

			const nodes = createNodesWithProto(['de.md']);
			const { leaf, renderer } = mockLeaf(nodes, { useDataEngine: true });
			vi.mocked(plugin.app.workspace.getLeavesOfType).mockReturnValue([leaf] as never);

			plugin.patchGraphViews();

			expect(nodes[0]!.text.text).toBe('de');
			expect(renderer.changed).toHaveBeenCalled();
		});

		it('skips leaves with no renderer or dataEngine', () => {
			setupWithFiles([], new Map());

			vi.mocked(plugin.app.workspace.getLeavesOfType).mockReturnValue([
				{ view: {} },
			] as never);

			expect(() => plugin.patchGraphViews()).not.toThrow();
		});

		it('patches both graph and localgraph leaves', () => {
			const file = mockFile({ path: 'multi.md', name: 'multi.md', basename: 'multi' });
			const cacheMap = new Map([
				['multi.md', { headings: [{ heading: 'Multi', level: 1 }] }],
			]);
			setupWithFiles([file], cacheMap);

			const graphNodes = createNodesWithProto(['multi.md']);
			const localNodes = createNodesWithProto(['multi.md']);
			const graphLeaf = mockLeaf(graphNodes);
			const localLeaf = mockLeaf(localNodes);

			vi.mocked(plugin.app.workspace.getLeavesOfType).mockImplementation((type: string) => {
				if (type === 'graph') return [graphLeaf.leaf] as never;
				if (type === 'localgraph') return [localLeaf.leaf] as never;
				return [] as never;
			});

			plugin.patchGraphViews();

			expect(graphNodes[0]!.text.text).toBe('Multi');
			expect(localNodes[0]!.text.text).toBe('Multi');
		});
	});

	describe('unpatchPrototype (via onunload)', () => {
		function setupAndPatch() {
			const file = mockFile({ path: 'z.md', name: 'z.md', basename: 'z' });
			vi.mocked(plugin.app.vault.getFiles).mockReturnValue([file] as never);
			vi.mocked(plugin.app.metadataCache.getFileCache).mockReturnValue(null as never);

			plugin.onload();
			const layoutReadyCb = vi.mocked(plugin.app.workspace.onLayoutReady).mock.calls[0]![0] as () => void;
			layoutReadyCb();

			const nodes = createNodesWithProto(['z.md']);
			const { leaf } = mockLeaf(nodes);
			vi.mocked(plugin.app.workspace.getLeavesOfType).mockReturnValue([leaf] as never);

			plugin.patchGraphViews();
			return { nodes };
		}

		it('restores the original getDisplayText on unload', () => {
			const { nodes } = setupAndPatch();

			// Before unload: patched
			expect(nodes[0]!.getDisplayText()).toBe('z');

			plugin.onunload();

			// After unload: restored to original
			expect(nodes[0]!.getDisplayText()).toBe('original');
		});

		it('removes the _graphViewFileHeadingPatched flag', () => {
			const { nodes } = setupAndPatch();
			const proto = Object.getPrototypeOf(nodes[0]);

			expect(proto._graphViewFileHeadingPatched).toBe(true);

			plugin.onunload();

			expect(proto._graphViewFileHeadingPatched).toBeUndefined();
		});

		it('is safe to call onunload multiple times', () => {
			setupAndPatch();
			plugin.onunload();
			expect(() => plugin.onunload()).not.toThrow();
		});
	});
});
