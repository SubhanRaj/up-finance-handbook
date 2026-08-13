# UP Finance Handbook — Web UI

**Live: [financialhandbook.exciseup.in](https://financialhandbook.exciseup.in)**

Phase 3 of the parent project: a browsable, searchable version of the handbook. See
[CLAUDE.md](CLAUDE.md) for the rules an AI agent must follow when working here (includes a
request-flow diagram) and [../CLAUDE.md](../CLAUDE.md) / [../ROADMAP.md](../ROADMAP.md) for the
whole pipeline this is one phase of.

## Tech stack

One Next.js (App Router) app on [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare),
deployed as a single Cloudflare Worker serving both UI pages and `/api/*` route handlers. `pnpm`
throughout. Design system (theme toggle, reading-customization panel, color tokens) ported from
`~/Projects/chinese-intel-pipeline/dashboard`.

- **Next.js 16 / React 19**, Tailwind v4 + `@tailwindcss/typography` (`prose` classes render the
  handbook's legacy table-based HTML).
- **Cloudflare D1** (`src/db/schema.ts`, Drizzle ORM) — one `pages` table (slug, volume, title,
  source URL, HTML). Content is rendered dynamically per request, not statically generated — see
  CLAUDE.md's "Why D1 and not R2" reasoning.
- **`flexsearch`** — client-side search. Starts from `public/search-index.json` (small, ~4000-char
  excerpts per page) and upgrades to full-text once the IndexedDB cache below is warm — either way,
  no server round-trip, no D1 query for search.
- **`dexie`** — after first paint, `CorpusSync.tsx` background-fetches the entire corpus
  (`/api/all-pages`) into IndexedDB, same pattern as `pac-recovery-portal`'s admin dashboard. Feeds
  full-text search; content pages themselves stay server-rendered from D1 (SEO/no-JS baseline
  unaffected).
- **`node-html-markdown`** — powers the `.md` download route (`/api/download/[...slug]`, single
  page or `?scope=section` for a whole chapter), DOM-free so it works in the Workers runtime.
- **`@tabler/icons-react`**, **`@base-ui/react`** + **`class-variance-authority`** (`ui/button.tsx`,
  `ui/card.tsx`) — same component primitives as the sibling dashboard app.
- **Prev/Next footer nav** on every content page, ordered by `nav.json`'s tree (not slug string
  sort — see CLAUDE.md) — continuous reading across the whole handbook without the sidebar.
- **`loading.tsx`** gives instant feedback on every navigation (content routes are fully dynamic,
  no static generation) — this is what makes it feel like an SPA despite being real SSR per
  request.

## Rebuilding content from a fresh crawl

If `../raw/` and `../manifest.json` (Phase 1) have changed, regenerate and re-seed D1:

```
cd .. && .venv/bin/python build_content.py       # raw/ + manifest.json -> web/content/ + web/public/search-index.json
.venv/bin/python generate_seed_sql.py            # web/content/pages/*.json -> web/seed.sql
cd web
wrangler d1 execute up-finance-handbook-db --local  --file=seed.sql   # test locally first
wrangler d1 execute up-finance-handbook-db --remote --file=seed.sql   # only with explicit go-ahead
```

`build_content.py` walks the same crawl tree `merge.py` uses for the PDFs, so the nav hierarchy
(including CSR's 3-level nesting) matches automatically. Volume VI has no HTML content pages on
the source site (pre-made chapter PDFs instead) — it appears in the nav as a link straight to the
source.

## Local development

```
pnpm install
pnpm dev              # http://localhost:3000 — Next's own dev server, D1 access via local binding
```

`pnpm run preview` builds and runs the *real* Workers runtime locally (`wrangler dev` against the
built worker + local D1) — more faithful than `pnpm dev` for confirming a change actually works
under `workerd`, not just Node.

## Deploying to Cloudflare Workers

One-time setup (already done for the live site — only needed for a fresh account/environment):

```
wrangler login
wrangler d1 create up-finance-handbook-db     # update wrangler.jsonc's database_id with the output
wrangler d1 migrations apply up-finance-handbook-db --local
wrangler d1 migrations apply up-finance-handbook-db --remote
```

Then seed D1 (see above) and:

```
pnpm run deploy        # opennextjs-cloudflare build && opennextjs-cloudflare deploy
```

Custom domain (`financialhandbook.exciseup.in`) is wired via `wrangler.jsonc`'s `routes` —
`{ pattern: "financialhandbook.exciseup.in", custom_domain: true }` auto-provisions the DNS record
on deploy, same pattern as `pac-recovery-portal`/`up-excise-spatial-revenue-optimizer`.

## Why D1 and not R2

Every content route here *could* be exported as plain static HTML — nothing about the content
itself is dynamic. An earlier version did exactly that (`generateStaticParams` + OpenNext's R2
incremental cache), but **Cloudflare R2 requires a card on file even for free-tier usage**, unlike
D1/KV/Workers themselves — a real constraint for staying on the plain free tier like the other
`~/Projects/*` apps. Moving page content into D1 and rendering per-request instead removes that
requirement entirely, at the cost of a D1 query per page view (fast, and D1's free tier is 5 GB /
5M reads-per-day against a ~9 MB dataset — nowhere close to a limit). It also keeps the Worker
genuinely dynamic, so a future `/api/*` route needs no second deploy target.
