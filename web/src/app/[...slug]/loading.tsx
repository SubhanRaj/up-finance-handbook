export default function Loading() {
	return (
		<div className="mx-auto px-4 sm:px-6 md:px-10 py-6 sm:py-10 animate-pulse" style={{ maxWidth: 'var(--reading-width, 48rem)' }}>
			<div className="mb-6 sm:mb-8 pb-5 sm:pb-6 border-b border-slate-200 dark:border-slate-800">
				<div className="h-3 w-40 rounded bg-slate-200 dark:bg-slate-800 mb-4" />
				<div className="h-8 sm:h-10 w-3/4 rounded bg-slate-200 dark:bg-slate-800 mb-3" />
				<div className="h-4 w-56 rounded bg-slate-200 dark:bg-slate-800" />
			</div>
			<div className="space-y-3">
				{Array.from({ length: 8 }).map((_, i) => (
					<div key={i} className="h-4 rounded bg-slate-200 dark:bg-slate-800" style={{ width: `${85 - (i % 4) * 12}%` }} />
				))}
			</div>
		</div>
	);
}
