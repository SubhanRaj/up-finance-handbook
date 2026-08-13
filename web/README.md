# UP Finance Handbook — Web UI

Phase 3 of the parent project: a browsable, searchable version of the
handbook, built from the same `manifest.json` + `raw/` mirror Phases 1–2
produced. Next.js (App Router) + Tailwind v4, deployed as a single
Cloudflare Worker via `@opennextjs/cloudflare` — same stack, design system,
and UI components (theme toggle, reading-customization panel, accent
colors) as `~/Projects/chinese-intel-pipeline/dashboard`.

Every content page is prerendered at build time (`generateStaticParams`) —
there's no database. Search is client-side (`flexsearch`) over a prebuilt
index fetched lazily from `/search-index.json`.

## Rebuilding content from a fresh crawl

If `../raw/` and `../manifest.json` (Phase 1) have changed, regenerate this
app's content before building:

```
cd ..  && .venv/bin/python build_content.py   # writes web/content/ + web/public/search-index.json
```

This walks the same crawl tree `merge.py` uses for the PDFs, so the nav
hierarchy (including CSR's 3-level nesting) matches automatically. Volume
VI has no HTML content pages on the source site (pre-made chapter PDFs
instead) — it appears in the nav as a link straight to the source.

## Local development

```
pnpm install
pnpm dev              # http://localhost:3000
```

## Deploying to Cloudflare Workers

One-time setup:

```
wrangler login
wrangler r2 bucket create up-finance-handbook-cache   # holds prerendered page cache
```

Then:

```
pnpm run deploy        # opennextjs-cloudflare build && opennextjs-cloudflare deploy
```

`pnpm run preview` builds and runs the real Workers runtime locally
(`wrangler dev`) instead of Next's own dev server — useful for confirming
the R2 cache / assets binding behave the way they will in production.

### Custom domain

Attach `financialhandbook.exciseup.in` the same way the other `~/Projects/*`
Workers do: Cloudflare dashboard → Workers & Pages → this worker → Settings
→ Domains & Routes → Add custom domain (or `wrangler` if you prefer CLI).

## Why R2 and not "fully static, no worker"

Every route here *could* be exported as plain static HTML — nothing is
truly dynamic. Using OpenNext's SSR worker (with R2 as the incremental
cache so prerendered pages don't get re-rendered on every request) was a
deliberate choice over `next export`: it keeps this one Worker able to grow
an API route later without a second deploy target, at the cost of one R2
bucket. If that flexibility is never needed, switching to `output: 'export'`
and dropping OpenNext/R2 entirely is a valid simplification.
