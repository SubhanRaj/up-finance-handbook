import Link from 'next/link';
import { notFound } from 'next/navigation';
import { IconExternalLink, IconChevronRight, IconChevronLeft, IconDownload, IconFileDownload } from '@tabler/icons-react';
import { loadPage, flattenNav, getPrevNext } from '@/lib/content';
import type { Metadata } from 'next';

async function resolve(slugParts: string[]) {
	const slug = slugParts.join('/');
	const page = await loadPage(slug);
	if (!page) return null;
	const nav = flattenNav().get(slug);
	return { page, nav };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
	const { slug } = await params;
	const resolved = await resolve(slug);
	if (!resolved) return {};
	const { page, nav } = resolved;
	const description = nav
		? `${nav.volumeLabel}${nav.breadcrumb.length ? ' — ' + nav.breadcrumb.map(c => c.title).join(' › ') : ''}`
		: undefined;
	return {
		title: page.title,
		description,
		openGraph: { title: page.title, description, type: 'article' },
		twitter: { card: 'summary', title: page.title, description },
	};
}

export default async function ContentPage({ params }: { params: Promise<{ slug: string[] }> }) {
	const { slug } = await params;
	const resolved = await resolve(slug);
	if (!resolved) notFound();
	const { page, nav } = resolved;
	const { prev, next } = getPrevNext(page.slug);

	return (
		<div className="mx-auto px-4 sm:px-6 md:px-10 py-6 sm:py-10 page-transition" style={{ maxWidth: 'var(--reading-width, 48rem)' }}>
			<header className="mb-6 sm:mb-8 pb-5 sm:pb-6 border-b border-slate-200 dark:border-slate-800">
				<nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mb-3">
					<Link href={`/${nav?.volumeEntrySlug ?? ''}`} className="text-accent font-medium hover:underline">
						{nav?.volumeLabel ?? 'Handbook'}
					</Link>
					{nav?.breadcrumb.map((crumb) => (
						<span key={crumb.slug} className="flex items-center gap-1 min-w-0">
							<IconChevronRight size={11} className="shrink-0" />
							<Link href={`/${crumb.slug}`} className="truncate max-w-[9rem] sm:max-w-[10rem] hover:text-accent hover:underline">
								{crumb.title}
							</Link>
						</span>
					))}
				</nav>
				<h1 className="font-serif text-2xl sm:text-3xl md:text-4xl text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
					{page.title}
				</h1>
				<div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3">
					<a
						href={page.sourceUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500 hover:text-accent transition-colors"
					>
						<IconExternalLink size={13} />
						View original on budget.up.nic.in
					</a>
					<a
						href={`/api/download/${page.slug}`}
						className="inline-flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500 hover:text-accent transition-colors"
					>
						<IconDownload size={13} />
						Download this page
					</a>
					{nav?.hasChildren && (
						<a
							href={`/api/download/${page.slug}?scope=section`}
							className="inline-flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500 hover:text-accent transition-colors"
						>
							<IconFileDownload size={13} />
							Download this whole chapter
						</a>
					)}
				</div>
			</header>

			<div
				className="handbook-content prose dark:prose-invert prose-slate prose-sm sm:prose-base max-w-none
					prose-headings:font-serif prose-headings:text-slate-900 dark:prose-headings:text-slate-100
					prose-p:text-slate-700 dark:prose-p:text-slate-300
					prose-td:text-slate-700 dark:prose-td:text-slate-300
					prose-a:text-accent"
				dangerouslySetInnerHTML={{ __html: page.html }}
			/>

			{(prev || next) && (
				<nav aria-label="Chapter navigation" className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-3">
					{prev ? (
						<Link
							href={`/${prev.slug}`}
							className="flex flex-col items-start gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 hover:border-accent transition-colors min-w-0"
						>
							<span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-600">
								<IconChevronLeft size={12} />
								Previous
							</span>
							<span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate w-full">{prev.title}</span>
						</Link>
					) : <div />}
					{next ? (
						<Link
							href={`/${next.slug}`}
							className="flex flex-col items-end gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 hover:border-accent transition-colors min-w-0 text-right"
						>
							<span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-600">
								Next
								<IconChevronRight size={12} />
							</span>
							<span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate w-full">{next.title}</span>
						</Link>
					) : <div />}
				</nav>
			)}
		</div>
	);
}
