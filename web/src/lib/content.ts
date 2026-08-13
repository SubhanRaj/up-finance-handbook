import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { eq, or, like } from 'drizzle-orm';
import { pages } from '@/db/schema';
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

export interface Crumb {
	title: string;
	slug: string;
}

export interface FlatNavEntry {
	title: string;
	breadcrumb: Crumb[];
	volumeLabel: string;
	volumeEntrySlug: string;
	ancestorSlugs: string[];
	hasChildren: boolean;
}

/** Flattens the nav tree into a slug -> {title, breadcrumb, volumeLabel, ancestorSlugs, hasChildren} lookup. */
export function flattenNav(): Map<string, FlatNavEntry> {
	const map = new Map<string, FlatNavEntry>();
	const { volumes } = getNav();
	for (const vol of volumes) {
		if (!vol.tree) continue;
		const walk = (node: NavNode, breadcrumb: Crumb[], ancestorSlugs: string[]) => {
			map.set(node.slug, {
				title: node.title, breadcrumb, volumeLabel: vol.label,
				volumeEntrySlug: vol.entrySlug ?? vol.tree!.slug, ancestorSlugs,
				hasChildren: node.children.length > 0,
			});
			for (const child of node.children) {
				walk(child, [...breadcrumb, { title: node.title, slug: node.slug }], [...ancestorSlugs, node.slug]);
			}
		};
		walk(vol.tree, [], []);
	}
	return map;
}

async function getDb() {
	const { env } = await getCloudflareContext({ async: true });
	return drizzle(env.DB);
}

export async function loadPage(slug: string): Promise<PageContent | null> {
	const db = await getDb();
	const rows = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1);
	return rows[0] ?? null;
}

/**
 * Every content slug across all volumes, in reading order (DFS over each
 * volume's tree, volumes in their fixed build_content.py order). Cheap —
 * nav.json is already bundled — and is the one source of truth for "what
 * order do pages read in", reused for prev/next and for ordering a
 * section's pages when downloaded together.
 */
export function orderedSlugs(): string[] {
	const out: string[] = [];
	const { volumes } = getNav();
	for (const vol of volumes) {
		if (!vol.tree) continue;
		const walk = (node: NavNode) => {
			out.push(node.slug);
			for (const child of node.children) walk(child);
		};
		walk(vol.tree);
	}
	return out;
}

export interface AdjacentPage {
	slug: string;
	title: string;
	volumeLabel: string;
}

export function getPrevNext(slug: string): { prev: AdjacentPage | null; next: AdjacentPage | null } {
	const order = orderedSlugs();
	const nav = flattenNav();
	const idx = order.indexOf(slug);
	const toAdjacent = (s: string | undefined): AdjacentPage | null => {
		if (!s) return null;
		const entry = nav.get(s);
		return entry ? { slug: s, title: entry.title, volumeLabel: entry.volumeLabel } : null;
	};
	if (idx === -1) return { prev: null, next: null };
	return { prev: toAdjacent(order[idx - 1]), next: toAdjacent(order[idx + 1]) };
}

/** The page itself plus every descendant under it (slug-prefix match) — powers "download this section". */
export async function loadSection(slug: string): Promise<PageContent[]> {
	const db = await getDb();
	const rows = await db.select().from(pages)
		.where(or(eq(pages.slug, slug), like(pages.slug, `${slug}/%`)));
	const order = orderedSlugs();
	return rows.sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
}

/** The whole corpus — powers the client-side full-corpus cache (src/lib/client-db.ts). */
export async function loadAllPages(): Promise<PageContent[]> {
	const db = await getDb();
	return db.select().from(pages);
}
