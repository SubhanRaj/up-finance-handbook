import { notFound } from 'next/navigation';
import { IconExternalLink, IconChevronRight } from '@tabler/icons-react';
import { allSlugs, loadPage, flattenNav } from '@/lib/content';
import type { Metadata } from 'next';

export async function generateStaticParams() {
	return allSlugs().map(slug => ({ slug: slug.split('/') }));
}

async function resolve(slugParts: string[]) {
	const slug = slugParts.join('/');
	const page = loadPage(slug);
	if (!page) return null;
	const nav = flattenNav().get(slug);
	return { page, nav };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
	const { slug } = await params;
	const resolved = await resolve(slug);
	if (!resolved) return {};
	return { title: resolved.page.title };
}

export default async function ContentPage({ params }: { params: Promise<{ slug: string[] }> }) {
	const { slug } = await params;
	const resolved = await resolve(slug);
	if (!resolved) notFound();
	const { page, nav } = resolved;

	return (
		<div className="mx-auto px-4 sm:px-10 py-10" style={{ maxWidth: 'var(--reading-width, 48rem)' }}>
			<header className="mb-8 pb-6 border-b border-slate-200 dark:border-slate-800">
				{nav && nav.breadcrumb.length > 0 && (
					<nav className="flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mb-3">
						<span className="text-accent font-medium">{nav.volumeLabel}</span>
						{nav.breadcrumb.map((crumb, i) => (
							<span key={i} className="flex items-center gap-1">
								<IconChevronRight size={11} className="shrink-0" />
								<span className="truncate max-w-[10rem]">{crumb}</span>
							</span>
						))}
					</nav>
				)}
				<h1 className="font-serif text-3xl sm:text-4xl text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
					{page.title}
				</h1>
				<a
					href={page.sourceUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500 hover:text-accent transition-colors mt-3"
				>
					<IconExternalLink size={13} />
					View original on budget.up.nic.in
				</a>
			</header>

			<div
				className="handbook-content prose dark:prose-invert prose-slate max-w-none
					prose-headings:font-serif prose-headings:text-slate-900 dark:prose-headings:text-slate-100
					prose-p:text-slate-700 dark:prose-p:text-slate-300
					prose-td:text-slate-700 dark:prose-td:text-slate-300
					prose-a:text-accent"
				dangerouslySetInnerHTML={{ __html: page.html }}
			/>
		</div>
	);
}
