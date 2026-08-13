# CLAUDE.md — Web UI

Instructions for AI agents working in this directory. See [README.md](README.md) for setup/deploy
commands and [../CLAUDE.md](../CLAUDE.md) for the whole-repo pipeline this app is Phase 3 of.

## What this is

Next.js (App Router) app, deployed as a single Cloudflare Worker via `@opennextjs/cloudflare` —
one Worker for UI pages *and* `/api/*` route handlers, no separate API service. Content pages are
rendered dynamically per request from Cloudflare D1 (`src/lib/content.ts`); there is no
static-generation/ISR cache layer (no R2, deliberately — see README's "Why D1 and not R2" note).
`pnpm` throughout.

## Request flow

```mermaid
flowchart TD
    Req(["GET /volume5-part1/001"]) --> Worker["Worker (.open-next/worker.js)"]
    Worker --> Route["app/[...slug]/page.tsx\n(fully dynamic — no generateStaticParams)"]
    Route --> Ctx["getCloudflareContext()\n→ env.DB"]
    Ctx --> Query["drizzle(env.DB)\n.select().from(pages)\n.where(eq(pages.slug, slug))"]
    Query --> D1[("D1: pages table")]
    D1 --> Render["Render HTML from D1\n+ breadcrumb from static nav.json"]
    Render --> Resp(["200: full page"])

    ReqDl(["GET /api/download/:slug?scope=section"]) --> DlRoute["app/api/download/[...slug]/route.ts"]
    DlRoute --> Section["loadSection(slug)\nWHERE slug = ? OR slug LIKE 'slug/%'\nre-sorted by orderedSlugs()"]
    Section --> D1
    Section --> MD["node-html-markdown\n(no-DOM, Workers-safe)"]
    MD --> DlResp(["200: text/markdown attachment"])

    First(["First visit, any page"]) --> Corpus["CorpusSync.tsx\n(idle callback, after paint)"]
    Corpus --> AllPages["GET /api/all-pages"]
    AllPages --> D1
    AllPages --> Dexie[("IndexedDB (Dexie)\nfull html + text,\nevery page")]
    Dexie -.search prefers this.-> SearchPage["app/search/page.tsx"]

    style D1 fill:#b45309,color:#fff
    style Dexie fill:#0369a1,color:#fff
    style Resp fill:#16a34a,color:#fff
    style DlResp fill:#16a34a,color:#fff
```

## Rules to preserve

- **Never run `wrangler d1 execute --remote`, `wrangler deploy`, or `pnpm run deploy` without the
  user explicitly saying so for that specific change.** This is a live public site
  (financialhandbook.exciseup.in). Local `--local` D1 work, `pnpm dev`, and `pnpm run preview`
  (real Workers runtime, local D1) don't need to ask.
- **Content routes are intentionally NOT statically generated.** An earlier version used
  `generateStaticParams` + OpenNext's incremental cache, which required an R2 bucket (needs a
  Cloudflare card on file even on the free tier) just to avoid 404s on cache misses. Don't
  reintroduce `generateStaticParams` on `[...slug]/page.tsx` without also reintroducing that cache
  — a bare static-assets binding does not serve dynamic-route pages.
- **`nav.json` is bundled/imported directly (`src/lib/content.ts`'s `getNav()`), not stored in
  D1.** It's small (~160 KB) and needed on every request for the sidebar/breadcrumbs; only page
  *body HTML* lives in D1. Don't move it into D1 "for consistency" — that would add a query to
  every request for no benefit.
- **Two-step regeneration, always both steps**: `../build_content.py` (raw/ + manifest.json →
  `content/nav.json` + `content/pages/*.json`) then `../generate_seed_sql.py` +
  `wrangler d1 execute --file=seed.sql` (local and/or remote). Editing `content/pages/*.json` by
  hand does nothing to the live site — D1 is what's actually read at request time.
- **Large page HTML is chunked in `seed.sql`** (`generate_seed_sql.py`'s `CHUNK_SIZE`) — D1 caps a
  single SQL statement's text around 100 KB; pages over that start as an empty-string INSERT
  followed by `UPDATE … SET html = html || '<chunk>'` statements. Don't "simplify" this back to one
  INSERT per page without re-checking the largest page's HTML size first.
- **`node-html-markdown`, not `turndown`**, for the `.md` download route — `turndown` needs a real
  DOM (`document`/`DOMParser`), which doesn't exist in the Workers runtime. `node-html-markdown` is
  parser-based and was chosen specifically because it works without one; verify any replacement
  the same way (`node -e "require('pkg').translate(...)"` isn't sufficient — test it under
  `wrangler dev`, since Node's `require` succeeding doesn't mean the Workers `workerd` runtime
  will).
- **Icons/manifest are generated PNGs (`web/public/icon-*.png`, `favicon.svg`), not designed
  assets** — a simple amber book glyph, matching `--ui-accent`. Regenerate via Pillow if the accent
  color or brand ever changes; don't hand-edit the PNGs.
- **Slugs are generated from each page's title, not its source filename** (`build_content.py`'s
  `unique_leaf_slug()` — slugify with a per-parent collision counter, `-2`/`-3`… suffix on
  clash). Changing title-extraction logic changes URLs; if that ever needs to happen, always do a
  full `build_content.py` → `generate_seed_sql.py` → `wrangler d1 execute --file=seed.sql` cycle
  (both `--local` and `--remote`, `DELETE FROM pages;` is the first line of `seed.sql` so it's a
  clean replace, not an incremental merge) — a partial reseed leaves stale slugs live.
- **Reading order (prev/next, and the order pages appear in a `?scope=section` download) comes
  from `nav.json`'s tree structure (`content.ts`'s `orderedSlugs()`), not from sorting slugs as
  strings.** This matters now that slugs are title-based — `"chapter-ii"` sorts before
  `"chapter-x"` alphabetically, which is wrong; `nav.json`'s children arrays are already in the
  crawl's real document order regardless of what the slug text looks like. There is no `order`
  column in D1 — don't add one to "fix" ordering; the tree already has it.
- **`loading.tsx` on `[...slug]` is load-bearing for perceived speed, not decoration.** Content
  routes are fully dynamic (no `generateStaticParams`), so every navigation is a real D1 round
  trip; without a `loading.tsx`, Next shows nothing until that resolves and navigation feels like
  a full-page reload even though it's client-side. Don't delete it to "simplify."

## Design system

Ported from `~/Projects/chinese-intel-pipeline/dashboard`: `globals.css` token system (light/dark
OKLCH palette, `--ui-accent` color switcher, `--reading-*` customization variables),
`ThemeToggle.tsx`, `CustomizationPanel.tsx` (font/size/line-height/width/accent FAB), `ui/button.tsx`
+ `ui/card.tsx` (`@base-ui/react` + `class-variance-authority`). Check that dashboard first before
adding a new UI pattern — the two apps are meant to look like the same product family.
