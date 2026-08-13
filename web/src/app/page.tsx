import Link from 'next/link';
import { IconBook2, IconExternalLink, IconArrowRight } from '@tabler/icons-react';
import { getNav } from '@/lib/content';

export default function HomePage() {
	const { volumes } = getNav();

	return (
		<div className="mx-auto px-4 sm:px-10 py-10" style={{ maxWidth: 'var(--reading-width, 48rem)' }}>
			<header className="mb-10 pb-6 border-b border-slate-200 dark:border-slate-800">
				<p className="text-xs font-bold tracking-widest uppercase text-accent mb-2 flex items-center gap-1.5">
					<IconBook2 size={13} />
					Uttar Pradesh Finance Department
				</p>
				<h1 className="font-serif text-4xl sm:text-5xl text-slate-900 dark:text-slate-100 tracking-tight">
					Financial Handbook Archive
				</h1>
				<p className="text-base text-slate-600 dark:text-slate-400 mt-4 leading-relaxed">
					A clean, searchable mirror of the Financial Handbook (Volumes I–VII + Civil
					Service Regulations), originally published as thousands of table-based HTML
					pages at{' '}
					<a href="https://budget.up.nic.in/finhando.htm" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
						budget.up.nic.in
					</a>.
				</p>
			</header>

			<div className="space-y-3">
				{volumes.map(vol => (
					vol.tree ? (
						<Link
							key={vol.key}
							href={`/${vol.entrySlug}`}
							className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 hover:border-accent transition-colors group"
						>
							<span className="font-serif text-lg text-slate-900 dark:text-slate-100">{vol.label}</span>
							<IconArrowRight size={18} className="shrink-0 text-slate-400 group-hover:text-accent transition-colors" />
						</Link>
					) : vol.external ? (
						<a
							key={vol.key}
							href={vol.external.sourceUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 hover:border-accent transition-colors group"
						>
							<div>
								<span className="font-serif text-lg text-slate-900 dark:text-slate-100">{vol.label}</span>
								<p className="text-xs text-slate-400 dark:text-slate-600 mt-1">{vol.external.note}</p>
							</div>
							<IconExternalLink size={18} className="shrink-0 text-slate-400 group-hover:text-accent transition-colors" />
						</a>
					) : null
				))}
			</div>
		</div>
	);
}
