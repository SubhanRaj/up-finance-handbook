'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { IconCopy, IconBookmark, IconCheck, IconShare2 } from '@tabler/icons-react';
import { db, notifyBookmarksChanged } from '@/lib/client-db';
import { findPageContext } from '@/lib/page-context';
import type { NavVolume } from '@/lib/content';

interface MenuState {
	top: number;
	left: number;
	text: string;
}

export default function SelectionMenu({ volumes }: { volumes: NavVolume[] }) {
	const [menu, setMenu] = useState<MenuState | null>(null);
	const [feedback, setFeedback] = useState<'copied' | 'saved' | 'shared' | null>(null);
	const [canShare, setCanShare] = useState(false);
	const pathname = usePathname();
	const menuRef = useRef<HTMLDivElement>(null);

	const hide = useCallback(() => { setMenu(null); setFeedback(null); }, []);

	useEffect(() => { setCanShare(!!navigator.share); }, []);
	useEffect(() => { hide(); }, [pathname, hide]);

	useEffect(() => {
		const onSelect = () => {
			const sel = window.getSelection();
			if (!sel || sel.isCollapsed || sel.rangeCount === 0) { hide(); return; }
			const text = sel.toString().trim();
			if (!text) { hide(); return; }
			const anchor = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
			if (!anchor || !anchor.closest('.handbook-content')) { hide(); return; }

			const rect = sel.getRangeAt(0).getBoundingClientRect();
			if (rect.width === 0 && rect.height === 0) { hide(); return; }
			const MENU_WIDTH = canShare ? 148 : 96;
			const left = Math.min(Math.max(rect.left + rect.width / 2 - MENU_WIDTH / 2, 8), window.innerWidth - MENU_WIDTH - 8);
			const top = Math.max(rect.top - 44, 8);
			setFeedback(null);
			setMenu({ top, left, text });
		};

		document.addEventListener('mouseup', onSelect);
		document.addEventListener('touchend', onSelect);
		return () => {
			document.removeEventListener('mouseup', onSelect);
			document.removeEventListener('touchend', onSelect);
		};
	}, [hide, canShare]);

	useEffect(() => {
		if (!menu) return;
		const el = document.getElementById('main-scroll');
		el?.addEventListener('scroll', hide, { passive: true });
		const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
		document.addEventListener('keydown', onKey);
		return () => {
			el?.removeEventListener('scroll', hide);
			document.removeEventListener('keydown', onKey);
		};
	}, [menu, hide]);

	if (!menu) return null;

	// mousedown+preventDefault keeps the browser selection alive through the click
	// (a plain click on the popup would otherwise collapse the selection first).
	const guard = (e: React.MouseEvent) => e.preventDefault();

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(menu.text);
			setFeedback('copied');
			setTimeout(hide, 700);
		} catch { /* clipboard unavailable */ }
	};

	const handleShare = async () => {
		const ctx = findPageContext(volumes, pathname.replace(/^\//, ''));
		try {
			await navigator.share({ text: menu.text, title: ctx?.title, url: window.location.href });
		} catch { /* user cancelled */ return; }
		setFeedback('shared');
		setTimeout(hide, 700);
	};

	const handleBookmark = async () => {
		const ctx = findPageContext(volumes, pathname.replace(/^\//, ''));
		await db.bookmarks.add({
			text: menu.text,
			slug: ctx?.slug ?? pathname.replace(/^\//, ''),
			pageTitle: ctx?.title ?? 'Untitled page',
			volumeLabel: ctx?.volumeLabel ?? '',
			createdAt: Date.now(),
		});
		notifyBookmarksChanged();
		setFeedback('saved');
		setTimeout(hide, 700);
	};

	return (
		<div
			ref={menuRef}
			style={{ top: menu.top, left: menu.left }}
			className="fixed z-40 flex items-center gap-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl px-1 py-1 print:hidden"
		>
			{feedback ? (
				<span className="flex items-center gap-1 px-2 py-1 text-xs text-emerald-600 dark:text-emerald-400">
					<IconCheck size={13} />
					{feedback === 'copied' ? 'Copied' : feedback === 'shared' ? 'Shared' : 'Saved'}
				</span>
			) : (
				<>
					<button
						onMouseDown={guard}
						onClick={handleCopy}
						className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
					>
						<IconCopy size={13} /> Copy
					</button>
					<div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
					<button
						onMouseDown={guard}
						onClick={handleBookmark}
						className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
					>
						<IconBookmark size={13} /> Bookmark
					</button>
					{canShare && (
						<>
							<div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
							<button
								onMouseDown={guard}
								onClick={handleShare}
								className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
							>
								<IconShare2 size={13} /> Share
							</button>
						</>
					)}
				</>
			)}
		</div>
	);
}
