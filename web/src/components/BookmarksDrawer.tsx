'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { IconX, IconTrash, IconBookmarkOff } from '@tabler/icons-react';
import { db, type Bookmark, BOOKMARKS_CHANGED_EVENT } from '@/lib/client-db';

export default function BookmarksDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
	const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

	const refresh = useCallback(() => {
		db.bookmarks.orderBy('createdAt').reverse().toArray().then(setBookmarks);
	}, []);

	useEffect(() => {
		refresh();
		window.addEventListener(BOOKMARKS_CHANGED_EVENT, refresh);
		return () => window.removeEventListener(BOOKMARKS_CHANGED_EVENT, refresh);
	}, [refresh]);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [open, onClose]);

	const remove = async (id: number | undefined) => {
		if (id == null) return;
		await db.bookmarks.delete(id);
		refresh();
	};

	return (
		<>
			<div
				onClick={onClose}
				aria-hidden="true"
				className={[
					'fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300 print:hidden',
					open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
				].join(' ')}
			/>
			<aside
				className={[
					'fixed top-0 right-0 z-50 h-full w-[min(24rem,100vw)] flex flex-col border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl transition-transform duration-300 ease-in-out print:hidden',
					open ? 'translate-x-0' : 'translate-x-full',
				].join(' ')}
			>
				<div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
					<div>
						<p className="text-xs font-bold tracking-widest uppercase text-accent">Bookmarks</p>
						<p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Saved locally on this device</p>
					</div>
					<button
						onClick={onClose}
						className="p-2 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
						aria-label="Close bookmarks"
					>
						<IconX size={18} />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
					{bookmarks.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-full text-center px-6 text-slate-400 dark:text-slate-600">
							<IconBookmarkOff size={28} className="mb-2 opacity-60" />
							<p className="text-sm">No bookmarks yet.</p>
							<p className="text-xs mt-1">Highlight any text on a page and tap Bookmark to save it here.</p>
						</div>
					) : (
						bookmarks.map(b => (
							<div key={b.id} className="group rounded-xl border border-slate-200 dark:border-slate-800 p-3 hover:border-accent transition-colors">
								<Link href={`/${b.slug}`} onClick={onClose} className="block">
									<p className="text-[10px] font-bold tracking-wide uppercase text-accent">{b.volumeLabel}</p>
									<p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{b.pageTitle}</p>
									<p className="text-sm text-slate-800 dark:text-slate-200 mt-1.5 line-clamp-4">&ldquo;{b.text}&rdquo;</p>
								</Link>
								<div className="flex items-center justify-between mt-2">
									<p className="text-[10px] text-slate-400 dark:text-slate-600">
										{new Date(b.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
									</p>
									<button
										onClick={() => remove(b.id)}
										className="p-1 rounded text-slate-400 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
										aria-label="Remove bookmark"
									>
										<IconTrash size={14} />
									</button>
								</div>
							</div>
						))
					)}
				</div>
			</aside>
		</>
	);
}
