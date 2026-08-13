'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { IconChevronRight } from '@tabler/icons-react';
import type { NavNode } from '@/lib/content';

interface Props {
	node: NavNode;
	depth: number;
	activeSlug: string | null;
	onNavigate: () => void;
	/** Only set at depth 0, by Shell — makes this node's expand state an
	 * accordion (opening one volume collapses whichever other one was open)
	 * instead of each node managing its own independent open/closed state. */
	controlled?: { open: boolean; onToggle: () => void };
}

export default function NavTree({ node, depth, activeSlug, onNavigate, controlled }: Props) {
	const isActive = node.slug === activeSlug;
	const containsActive = activeSlug !== null && activeSlug.startsWith(node.slug + '/');
	// Collapsed by default — only the chain leading to the current page auto-expands,
	// so the sidebar starts as just a list of volume names, not a wall of chapters.
	const [uncontrolledOpen, setUncontrolledOpen] = useState(containsActive);
	const open = controlled ? controlled.open : uncontrolledOpen;
	const toggle = controlled ? controlled.onToggle : () => setUncontrolledOpen(o => !o);
	const hasChildren = node.children.length > 0;
	const itemRef = useRef<HTMLAnchorElement>(null);

	useEffect(() => {
		if (isActive) itemRef.current?.scrollIntoView({ block: 'center' });
	}, [isActive]);

	return (
		<div>
			<div
				className={[
					'flex items-center rounded-lg group border-l-2',
					isActive
						? 'bg-amber-50 dark:bg-amber-500/10 border-accent'
						: 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60',
				].join(' ')}
				style={{ paddingLeft: `${depth * 0.85}rem` }}
			>
				{hasChildren ? (
					<button
						onClick={toggle}
						className="p-2.5 sm:p-1.5 shrink-0 text-slate-400 dark:text-slate-600"
						aria-label={open ? 'Collapse' : 'Expand'}
					>
						<IconChevronRight size={13} className={['transition-transform duration-150', open ? 'rotate-90' : ''].join(' ')} />
					</button>
				) : (
					<span className="w-[26px] shrink-0" />
				)}
				<Link
					ref={itemRef}
					href={`/${node.slug}`}
					onClick={onNavigate}
					aria-current={isActive ? 'page' : undefined}
					className={[
						'flex-1 min-w-0 text-left py-2 sm:py-1.5 pr-2 text-sm leading-snug truncate',
						isActive
							? 'text-accent font-semibold'
							: 'text-slate-700 dark:text-slate-300',
					].join(' ')}
					title={node.title}
				>
					{node.title}
				</Link>
			</div>
			{hasChildren && open && (
				<div>
					{node.children.map(child => (
						<NavTree key={child.slug} node={child} depth={depth + 1} activeSlug={activeSlug} onNavigate={onNavigate} />
					))}
				</div>
			)}
		</div>
	);
}
