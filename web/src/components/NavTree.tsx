'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IconChevronRight } from '@tabler/icons-react';
import type { NavNode } from '@/lib/content';

interface Props {
	node: NavNode;
	depth: number;
	activeSlug: string | null;
	onNavigate: () => void;
}

export default function NavTree({ node, depth, activeSlug, onNavigate }: Props) {
	const isActive = node.slug === activeSlug;
	const containsActive = activeSlug !== null && activeSlug.startsWith(node.slug + '/');
	const [open, setOpen] = useState(depth < 1 || containsActive);
	const hasChildren = node.children.length > 0;

	return (
		<div>
			<div
				className={[
					'flex items-center rounded-lg group',
					isActive ? 'bg-amber-50 dark:bg-amber-500/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800/60',
				].join(' ')}
				style={{ paddingLeft: `${depth * 0.85}rem` }}
			>
				{hasChildren ? (
					<button
						onClick={() => setOpen(o => !o)}
						className="p-1.5 shrink-0 text-slate-400 dark:text-slate-600"
						aria-label={open ? 'Collapse' : 'Expand'}
					>
						<IconChevronRight size={13} className={['transition-transform duration-150', open ? 'rotate-90' : ''].join(' ')} />
					</button>
				) : (
					<span className="w-[26px] shrink-0" />
				)}
				<Link
					href={`/${node.slug}`}
					onClick={onNavigate}
					className={[
						'flex-1 min-w-0 text-left py-1.5 pr-2 text-sm leading-snug truncate',
						isActive
							? 'text-accent font-medium'
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
