import fs from 'node:fs';
import path from 'node:path';
import navData from '../../content/nav.json';

export interface NavNode {
	title: string;
	slug: string;
	url: string;
	children: NavNode[];
}

export interface NavVolume {
	key: string;
	label: string;
	entrySlug?: string;
	tree?: NavNode;
	external?: { key: string; label: string; note: string; sourceUrl: string };
}

export interface PageContent {
	slug: string;
	title: string;
	volume: string;
	sourceUrl: string;
	html: string;
}

export function getNav(): { volumes: NavVolume[] } {
	return navData as { volumes: NavVolume[] };
}

/** Flattens the nav tree into a slug -> {title, breadcrumb, volumeLabel} lookup. */
export function flattenNav(): Map<string, { title: string; breadcrumb: string[]; volumeLabel: string }> {
	const map = new Map<string, { title: string; breadcrumb: string[]; volumeLabel: string }>();
	const { volumes } = getNav();
	for (const vol of volumes) {
		if (!vol.tree) continue;
		const walk = (node: NavNode, breadcrumb: string[]) => {
			map.set(node.slug, { title: node.title, breadcrumb, volumeLabel: vol.label });
			for (const child of node.children) walk(child, [...breadcrumb, node.title]);
		};
		walk(vol.tree, []);
	}
	return map;
}

const CONTENT_DIR = path.join(process.cwd(), 'content', 'pages');

export function slugToFile(slug: string): string {
	return path.join(CONTENT_DIR, `${slug.replace(/\//g, '__')}.json`);
}

export function loadPage(slug: string): PageContent | null {
	const file = slugToFile(slug);
	if (!fs.existsSync(file)) return null;
	return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

export function allSlugs(): string[] {
	return fs.readdirSync(CONTENT_DIR)
		.filter(f => f.endsWith('.json'))
		.map(f => f.replace(/\.json$/, '').replace(/__/g, '/'));
}
