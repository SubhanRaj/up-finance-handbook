import type { Metadata, Viewport } from "next";
import Script from "next/script";
import Shell from "@/components/Shell";
import { getNav } from "@/lib/content";
import "./globals.css";

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	viewportFit: 'cover',
};

export const metadata: Metadata = {
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
		siteName: "UP Finance Handbook Archive",
		title: "UP Finance Handbook Archive",
		description: "A clean, searchable mirror of the UP Finance Department's Financial Handbook.",
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
			</head>
			<body className="antialiased">
				<Shell volumes={volumes}>{children}</Shell>
			</body>
		</html>
	);
}
