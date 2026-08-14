import type { NavNode, NavVolume } from './content';

export interface PageContext {
	slug: string;
	title: string;
	volumeLabel: string;
}

function findNode(node: NavNode, slug: string): NavNode | null {
	if (node.slug === slug) return node;
	for (const child of node.children) {
		const found = findNode(child, slug);
		if (found) return found;
	}
	return null;
}

/** Client-safe (types-only import from content.ts, no server code pulled in). */
export function findPageContext(volumes: NavVolume[], slug: string): PageContext | null {
	for (const vol of volumes) {
		if (!vol.tree) continue;
		const found = findNode(vol.tree, slug);
		if (found) return { slug, title: found.title, volumeLabel: vol.label };
	}
	return null;
}
