import type { NextConfig } from "next";

const SECURITY_HEADERS = [
	{ key: 'X-Frame-Options', value: 'DENY' },
	{ key: 'X-Content-Type-Options', value: 'nosniff' },
	{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
	{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
	{ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
	{
		key: 'Content-Security-Policy',
		value: [
			"default-src 'self'",
			// unsafe-inline required for the theme-init beforeInteractive script in layout.tsx
			"script-src 'self' 'unsafe-inline'",
			// Google Fonts stylesheets, loaded eagerly + on-demand from CustomizationPanel
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
			"img-src 'self' data:",
			"font-src 'self' https://fonts.gstatic.com",
			"connect-src 'self'",
			"frame-ancestors 'none'",
			"object-src 'none'",
			"base-uri 'self'",
		].join('; '),
	},
];

const nextConfig: NextConfig = {
	async headers() {
		return [
			{
				source: '/(.*)',
				headers: SECURITY_HEADERS,
			},
		];
	},
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
