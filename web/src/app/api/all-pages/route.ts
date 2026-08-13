import { loadAllPages } from '@/lib/content';

/**
 * Full corpus dump, fetched once by the client (src/components/CorpusSync.tsx) and
 * cached into IndexedDB (Dexie) — powers full-text search and, once cached, means
 * the client never needs this route again this browser. Strips HTML down to plain
 * text server-side so the client doesn't have to parse every page's HTML just to
 * index it.
 */
export async function GET() {
	const rows = await loadAllPages();
	const out = rows.map(r => ({
		...r,
		text: r.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
	}));
	return Response.json(out);
}
