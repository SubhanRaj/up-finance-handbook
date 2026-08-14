'use client';

import { useState } from 'react';
import { IconShare2, IconCheck } from '@tabler/icons-react';

/**
 * PWA-installed users have no address bar to copy from, so every content page
 * (chapter, volume index, note page — all the same [...slug] route) needs an
 * explicit way to hand the URL to someone else. Prefers the native share sheet
 * (Web Share API) where available (mobile/PWA), falls back to copying the URL.
 */
export default function ShareButton({ title, path }: { title: string; path: string }) {
	const [copied, setCopied] = useState(false);

	const handleShare = async () => {
		const url = `${window.location.origin}/${path}`;
		if (navigator.share) {
			try { await navigator.share({ title, url }); } catch { /* user cancelled */ }
			return;
		}
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch { /* clipboard unavailable */ }
	};

	return (
		<button
			onClick={handleShare}
			className="inline-flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500 hover:text-accent transition-colors"
		>
			{copied ? <IconCheck size={13} /> : <IconShare2 size={13} />}
			{copied ? 'Link copied' : 'Share'}
		</button>
	);
}
