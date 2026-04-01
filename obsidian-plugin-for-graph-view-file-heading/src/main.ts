import { Plugin } from 'obsidian';

interface GraphNode {
	id: string;
	text: { text: string };
	getDisplayText: () => string;
}

interface GraphNodePrototype {
	getDisplayText: (this: GraphNode) => string;
	_graphViewFileHeadingPatched?: boolean;
}

interface GraphRenderer {
	nodes: unknown;
	changed?: () => void;
}

export default class GraphViewFileHeadingPlugin extends Plugin {
	private originalGetDisplayText: (() => string) | null = null;
	private patched = false;
	private displayNameMap: Map<string, string> = new Map();

	onload() {
		this.app.workspace.onLayoutReady(() => {
			this.rebuildMap();
			setTimeout(() => this.patchGraphViews(), 2000);
		});

		this.registerEvent(this.app.metadataCache.on('resolved', () => {
			this.rebuildMap();
			this.patchGraphViews();
		}));
		this.registerEvent(this.app.vault.on('create', () => {
			this.rebuildMap();
			this.patchGraphViews();
		}));
		this.registerEvent(this.app.vault.on('rename', () => {
			this.rebuildMap();
			this.patchGraphViews();
		}));
		this.registerEvent(this.app.vault.on('delete', () => {
			this.rebuildMap();
			this.patchGraphViews();
		}));
		this.registerEvent(this.app.workspace.on('layout-change', () => {
			setTimeout(() => this.patchGraphViews(), 500);
		}));
	}

	onunload() {
		this.unpatchPrototype();
	}

	private rebuildMap() {
		this.displayNameMap.clear();
		for (const file of this.app.vault.getFiles()) {
			if (!file.path.endsWith('.md')) continue;
			const cache = this.app.metadataCache.getFileCache(file);
			const heading = cache?.headings?.[0]?.heading;
			let displayName: string;
			if (heading) {
				displayName = heading;
			} else if (file.name === 'index.md' && file.parent) {
				displayName = file.parent.name;
			} else {
				displayName = file.basename;
			}
			this.displayNameMap.set(file.path, displayName);
			this.displayNameMap.set(file.path.replace(/\.md$/, ''), displayName);
		}
	}

	private getNodes(renderer: GraphRenderer): GraphNode[] {
		if (!renderer.nodes) return [];
		if (renderer.nodes instanceof Map) {
			return Array.from(renderer.nodes.values() as Iterable<GraphNode>);
		}
		const nodes = renderer.nodes as Iterable<GraphNode>;
		if (typeof (nodes as unknown as Record<symbol, unknown>)[Symbol.iterator] === 'function') {
			return Array.from(nodes);
		}
		return [];
	}

	patchGraphViews() {
		const graphLeaves = [
			...this.app.workspace.getLeavesOfType('graph'),
			...this.app.workspace.getLeavesOfType('localgraph'),
		];

		for (const leaf of graphLeaves) {
			const view = leaf.view as unknown as Record<string, unknown>;
			const renderer = (view?.renderer ?? view?.dataEngine) as GraphRenderer | undefined;
			if (!renderer) continue;

			const nodes = this.getNodes(renderer);
			if (nodes.length === 0) continue;

			const sampleNode = nodes[0];
			const proto = Object.getPrototypeOf(sampleNode) as GraphNodePrototype | null;
			if (proto && typeof proto.getDisplayText === 'function' && !proto._graphViewFileHeadingPatched) {
				this.originalGetDisplayText = proto.getDisplayText;
				const displayNameMap = this.displayNameMap;
				const originalGetDisplayText = this.originalGetDisplayText;

				proto.getDisplayText = function (this: GraphNode) {
					try {
						const id: string = this.id ?? '';
						const displayName = displayNameMap.get(id);
						if (displayName) return displayName;
					} catch {
						// Fall through to original
					}
					if (originalGetDisplayText) {
						return originalGetDisplayText.call(this);
					}
					return this.id ?? '';
				};

				proto._graphViewFileHeadingPatched = true;
				this.patched = true;
			}

			let changed = false;
			for (const node of nodes) {
				if (!node) continue;
				const displayName = this.displayNameMap.get(node.id ?? '');
				if (displayName && node.text && node.text.text !== displayName) {
					node.text.text = displayName;
					changed = true;
				}
			}

			if (changed && typeof renderer.changed === 'function') {
				renderer.changed();
			}
		}
	}

	private unpatchPrototype() {
		if (!this.patched || !this.originalGetDisplayText) return;

		const graphLeaves = [
			...this.app.workspace.getLeavesOfType('graph'),
			...this.app.workspace.getLeavesOfType('localgraph'),
		];

		for (const leaf of graphLeaves) {
			const view = leaf.view as unknown as Record<string, unknown>;
			const renderer = (view?.renderer ?? view?.dataEngine) as GraphRenderer | undefined;
			if (!renderer) continue;

			const nodes = this.getNodes(renderer);
			if (nodes.length === 0) continue;

			const proto = Object.getPrototypeOf(nodes[0]) as GraphNodePrototype | null;
			if (proto?._graphViewFileHeadingPatched) {
				proto.getDisplayText = this.originalGetDisplayText!;
				delete proto._graphViewFileHeadingPatched;
			}
		}

		this.patched = false;
		this.originalGetDisplayText = null;
	}
}
