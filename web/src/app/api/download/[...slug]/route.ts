import { NextRequest } from 'next/server';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { loadPage, loadSection } from '@/lib/content';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
	const { slug: slugParts } = await params;
	const slug = slugParts.join('/');
	const scope = req.nextUrl.searchParams.get('scope');

	const pages = scope === 'section' ? await loadSection(slug) : [await loadPage(slug)].filter(p => p !== null);
	if (pages.length === 0) return new Response('Not found', { status: 404 });

	const md = pages
		.map(p => `# ${p.title}\n\nSource: ${p.sourceUrl}\n\n${NodeHtmlMarkdown.translate(p.html)}`)
		.join('\n\n---\n\n');

	const filename = `${pages[0].slug.replaceAll('/', '_')}${scope === 'section' ? '_section' : ''}.md`;
	return new Response(md, {
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`,
		},
	});
}
