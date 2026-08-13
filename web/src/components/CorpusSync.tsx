'use client';

import { useEffect } from 'react';
import { db, type CachedPage } from '@/lib/client-db';

/**
 * Background full-corpus cache: after first paint, if IndexedDB doesn't have
 * the handbook cached yet, fetch it once (/api/all-pages) and store it — every
 * page's HTML + plain text, ~9 MB. Powers full-text search (search/page.tsx
 * prefers this over the smaller prebuilt search-index.json once it's ready)
 * and means a repeat visitor's browser already has the whole corpus locally.
 * Doesn't change how content pages themselves render — those stay
 * server-rendered from D1 for SEO/no-JS baseline; this only feeds search.
 */
export default function CorpusSync() {
	useEffect(() => {
		const idle = (cb: () => void) =>
			'requestIdleCallback' in window ? requestIdleCallback(cb) : setTimeout(cb, 1500);

		idle(async () => {
			try {
				const count = await db.pages.count();
				if (count > 0) return;
				const res = await fetch('/api/all-pages');
				if (!res.ok) return;
				const rows = await res.json() as CachedPage[];
				await db.pages.bulkPut(rows);
			} catch {
				// offline, storage quota, or private-browsing IndexedDB block — silent,
				// search just keeps using the smaller prebuilt index instead.
			}
		});
	}, []);

	return null;
}
