'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
	IconMenu2,
	IconX,
	IconSearch,
	IconBook2,
	IconExternalLink,
	IconBrandGithub,
} from '@tabler/icons-react';
import ThemeToggle from './ThemeToggle';
import NavTree from './NavTree';
import type { NavVolume } from '@/lib/content';

const CustomizationPanel = dynamic(() => import('./CustomizationPanel'), { ssr: false });

export default function Shell({ volumes, children }: { volumes: NavVolume[]; children: React.ReactNode }) {
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const pathname = usePathname();
	const activeSlug = pathname === '/' ? null : pathname.replace(/^\//, '');

	const closeSidebarMobile = () => { if (window.innerWidth < 768) setSidebarOpen(false); };

	const sidebar = (
		<>
			<div
				onClick={() => setSidebarOpen(false)}
				className={[
					'fixed inset-0 z-20 bg-black/40 md:hidden transition-opacity duration-300 print:hidden',
					sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
				].join(' ')}
			/>
			<aside className={[
				'fixed md:relative inset-y-0 left-0 z-30 w-80 shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 print:hidden transition-transform duration-300 ease-in-out md:translate-x-0',
				sidebarOpen ? 'translate-x-0' : '-translate-x-full',
			].join(' ')}>
				<div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between">
					<Link href="/" onClick={() => setSidebarOpen(false)}>
						<p className="text-xs font-bold tracking-widest uppercase text-accent mb-1 flex items-center gap-1.5">
							<IconBook2 size={13} />
							UP Finance Handbook
						</p>
						<h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 leading-snug tracking-tight">
							Archive
						</h1>
					</Link>
					<div className="flex items-center gap-1">
						<ThemeToggle />
						<button
							onClick={() => setSidebarOpen(false)}
							className="mt-1 p-2 rounded-md text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors md:hidden"
							aria-label="Close sidebar"
						>
							<IconX size={18} />
						</button>
					</div>
				</div>

				<div className="shrink-0 px-3 pt-3">
					<Link
						href="/search"
						onClick={closeSidebarMobile}
						className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:border-accent transition-colors"
					>
						<IconSearch size={14} />
						Search the handbook…
					</Link>
				</div>

				<nav className="flex-1 overflow-y-auto py-3 px-2 min-h-0">
					{volumes.map(vol => (
						<div key={vol.key} className="mb-3">
							{vol.tree ? (
								<NavTree node={vol.tree} depth={0} activeSlug={activeSlug} onNavigate={closeSidebarMobile} />
							) : vol.external ? (
								<a
									href={vol.external.sourceUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
									title={vol.external.note}
								>
									<IconExternalLink size={14} className="shrink-0 mt-0.5" />
									<span>
										{vol.label}
										<span className="block text-xs text-slate-400 dark:text-slate-600 mt-0.5">Source PDF chapters ↗</span>
									</span>
								</a>
							) : null}
						</div>
					))}
				</nav>

				<div className="shrink-0 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
					<p className="text-xs text-slate-400 dark:text-slate-600">
						Mirrored from budget.up.nic.in
					</p>
					<a
						href="https://github.com/SubhanRaj/up-finance-handbook"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
						title="View on GitHub"
					>
						<IconBrandGithub size={14} />
					</a>
				</div>
			</aside>
		</>
	);

	const mobileTopBar = (
		<div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 print:hidden">
			<button
				onClick={() => setSidebarOpen(true)}
				className="p-2 rounded-md text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
				aria-label="Open sidebar"
			>
				<IconMenu2 size={20} />
			</button>
			<div className="flex-1 min-w-0">
				<p className="text-xs font-bold tracking-widest uppercase text-accent leading-none mb-0.5">
					UP Finance Handbook
				</p>
				<p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">Archive</p>
			</div>
			<Link href="/search" className="p-2 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Search">
				<IconSearch size={18} />
			</Link>
		</div>
	);

	return (
		<div className="flex h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden page-transition">
			{sidebar}
			<main className="flex-1 flex flex-col overflow-hidden md:overflow-y-auto print:overflow-visible print:h-auto">
				{mobileTopBar}
				<div id="main-scroll" className="flex-1 overflow-y-auto reading-content">
					{children}
				</div>
			</main>
			<CustomizationPanel drawerOpen={false} />
		</div>
	);
}
