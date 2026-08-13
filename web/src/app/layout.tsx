import type { Metadata, Viewport } from "next";
import Script from "next/script";
import Shell from "@/components/Shell";
import { getNav } from "@/lib/content";
import "./globals.css";

const SITE_URL = "https://financialhandbook.exciseup.in";

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	viewportFit: 'cover',
	themeColor: [
		{ media: '(prefers-color-scheme: light)', color: '#f5f1e8' },
		{ media: '(prefers-color-scheme: dark)', color: '#171717' },
	],
};

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: {
		default: "UP Finance Handbook Archive",
		template: "%s · UP Finance Handbook Archive",
	},
	description:
		"A clean, searchable mirror of the Uttar Pradesh Finance Department's Financial Handbook (Volumes I-VII + Civil Service Regulations).",
	keywords: ["Uttar Pradesh", "Finance Handbook", "Civil Service Regulations", "budget.up.nic.in"],
	authors: [{ name: "UP Finance Handbook Archive" }],
	openGraph: {
		type: "website",
		locale: "en_US",
		url: SITE_URL,
		siteName: "UP Finance Handbook Archive",
		title: "UP Finance Handbook Archive",
		description: "A clean, searchable mirror of the UP Finance Department's Financial Handbook.",
	},
	twitter: {
		card: "summary",
		title: "UP Finance Handbook Archive",
		description: "A clean, searchable mirror of the UP Finance Department's Financial Handbook.",
	},
	icons: {
		icon: [
			{ url: "/favicon.svg", type: "image/svg+xml" },
			{ url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
		],
		apple: "/apple-touch-icon.png",
	},
	manifest: "/manifest.json",
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: "Finance Handbook",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const { volumes } = getNav();

	return (
		<html lang="en">
			<head>
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
				<link
					rel="stylesheet"
					href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap"
				/>
				<Script id="theme-init" strategy="beforeInteractive">{`(function(){try{var t=localStorage.getItem('handbook-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark');var p=JSON.parse(localStorage.getItem('handbook-reading-prefs-v1')||'{}');var r=document.documentElement;if(p.fontSize&&p.fontSize!=='base')r.setAttribute('data-rs',p.fontSize);if(p.lineHeight&&p.lineHeight!=='comfortable')r.setAttribute('data-rlh',p.lineHeight);if(p.readingWidth&&p.readingWidth!=='medium')r.setAttribute('data-rw',p.readingWidth);if(p.accent&&p.accent!=='amber')r.setAttribute('data-accent',p.accent)}catch(e){}})();`}</Script>
				<Script id="sw-register" strategy="lazyOnload">{`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js');}`}</Script>
			</head>
			<body className="antialiased">
				<Shell volumes={volumes}>{children}</Shell>
			</body>
		</html>
	);
}
