'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Document, type DocumentValue } from 'flexsearch';
import { IconSearch, IconLoader2, IconFileText, IconDatabase } from '@tabler/icons-react';
import { db } from '@/lib/client-db';

interface Row {
	slug: string;
	volume: string;
	title: string;
	text: string;
	[key: string]: DocumentValue | DocumentValue[];
}

export default function SearchPage() {
	const [rows, setRows] = useState<Row[] | null>(null);
	const [fullText, setFullText] = useState(false);
	const [query, setQuery] = useState('');
	const [results, setResults] = useState<Row[]>([]);
	const indexRef = useRef<Document<Row, true> | null>(null);
	const rowsBySlug = useMemo(() => {
		const m = new Map<string, Row>();
		rows?.forEach(r => m.set(r.slug, r));
		return m;
	}, [rows]);

	const buildIndex = (data: Row[], isFullText: boolean) => {
		const index = new Document<Row, true>({
			document: {
				id: 'slug',
				index: ['title', 'text'],
				store: true,
			},
			tokenize: 'forward',
		});
		data.forEach((row, i) => index.add({ ...row, slug: row.slug || String(i) }));
		indexRef.current = index;
		setRows(data);
		setFullText(isFullText);
	};

	useEffect(() => {
		// Prefer the full-corpus IndexedDB cache (CorpusSync.tsx) — full page text,
		// not the ~4000-char excerpts in the prebuilt index. Falls back to that
		// smaller prebuilt index (fetched immediately, no IndexedDB wait) if the
		// background cache hasn't finished yet, or storage is unavailable.
		(async () => {
			try {
				const cached = await db.pages.toArray();
				if (cached.length > 0) {
					buildIndex(cached, true);
					return;
				}
			} catch { /* IndexedDB unavailable (private browsing etc.) */ }

			const res = await fetch('/search-index.json');
			buildIndex(await res.json(), false);
		})();
	}, []);

	useEffect(() => {
		if (!indexRef.current || !query.trim()) { setResults([]); return; }
		let cancelled = false;
		(async () => {
			const hits = await indexRef.current!.search(query, { limit: 40, enrich: true });
			if (cancelled) return;
			const seen = new Set<string>();
			const out: Row[] = [];
			for (const fieldResult of hits) {
				for (const r of fieldResult.result) {
					const doc = (r as { doc?: Row }).doc ?? rowsBySlug.get(String((r as { id: string }).id));
					if (doc && !seen.has(doc.slug)) { seen.add(doc.slug); out.push(doc); }
				}
			}
			setResults(out);
		})();
		return () => { cancelled = true; };
	}, [query, rowsBySlug]);

	return (
		<div className="mx-auto px-4 sm:px-10 py-10 page-transition" style={{ maxWidth: 'var(--reading-width, 48rem)' }}>
			<header className="mb-8 pb-6 border-b border-slate-200 dark:border-slate-800">
				<p className="text-xs font-bold tracking-widest uppercase text-accent mb-2 flex items-center gap-1.5">
					<IconSearch size={13} />
					Search
				</p>
				<div className="flex items-center gap-3 mb-4">
					<h1 className="font-serif text-4xl text-slate-900 dark:text-slate-100 tracking-tight">
						Search the Handbook
					</h1>
					{fullText && (
						<span
							className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
							title="Searching the full text of every page, cached on your device"
						>
							<IconDatabase size={11} />
							Full text
						</span>
					)}
				</div>
				<div className="relative">
					<IconSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
					<input
						autoFocus
						type="text"
						value={query}
						onChange={e => setQuery(e.target.value)}
						placeholder={rows ? 'Search across all volumes…' : 'Loading search index…'}
						disabled={!rows}
						className="w-full pl-10 pr-4 py-3 text-base rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 ring-accent focus:border-accent transition-colors"
					/>
					{!rows && (
						<IconLoader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
					)}
				</div>
			</header>

			{query.trim() && (
				<p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
					{results.length} result{results.length !== 1 ? 's' : ''}
				</p>
			)}

			<div className="space-y-3">
				{results.map(r => (
					<Link
						key={r.slug}
						href={`/${r.slug}`}
						className="block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 hover:border-accent transition-colors"
					>
						<div className="flex items-start gap-2.5">
							<IconFileText size={16} className="shrink-0 mt-0.5 text-slate-400" />
							<div className="min-w-0">
								<p className="text-xs text-slate-400 dark:text-slate-600 font-mono mb-0.5">{r.volume}</p>
								<p className="font-serif text-lg text-slate-900 dark:text-slate-100 leading-snug">{r.title}</p>
								<p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{r.text}</p>
							</div>
						</div>
					</Link>
				))}
			</div>
		</div>
	);
}
