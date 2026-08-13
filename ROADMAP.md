# Roadmap

## Goal, in priority order

1. **Mirror** the full public site (`budget.up.nic.in/finhando.htm` and
   everything it reaches) into a clean local folder structure.
2. **Convert to PDF** — this is the main deliverable. One well-bookmarked PDF
   per volume (or one combined PDF with a full outline) is far more usable
   than thousands of loose `.htm` files.
3. *(Later, lowest priority)* a simple browsable/searchable UI over the
   mirrored + cleaned content. Nice-to-have, not the point of this repo.

## Phase 1 — Crawl & mirror

- **Language: Python** (`requests` + `BeautifulSoup`/`lxml`). Reasoning: this
  is a static-HTML crawl + text/encoding cleanup job, not something PHP or
  raw `curl` scripting is better suited for — `requests`+`bs4` is the
  standard, least-effort-correct tool for exactly this. No headless browser
  needed (site is old, no JS-rendered content per the pages surveyed so far).
- Start from `finhando.htm`, follow only links under `budget.up.nic.in`,
  discover the volume indexes, then each volume's chapter/section index, then
  every content page. Two known levels of nesting (top index → volume index
  → content pages) — verify this holds for every volume, some may differ
  (Vol V Part I/II both live under `volume5/`, CSR has its own subtree).
- Mirror to disk preserving the site's own path structure (e.g.
  `raw/Fin_H_Book/volume5/part1/001.html`), so the folder tree doubles as
  the crawl manifest — no need for a separate database for this phase.
- Also save any linked non-HTML assets referenced *within* content pages
  (images, embedded GIFs used as bullets/rules) so rendered PDFs don't have
  broken images.
- **Encoding**: legacy govt sites like this are frequently not UTF-8
  (Windows-1252 or similar is common) — detect per-page (`chardet`/meta
  charset tag) and normalize a cleaned copy to UTF-8 rather than trusting
  the HTTP header blindly.
- **Politeness**: identifying `User-Agent`, small delay between requests,
  retry-with-backoff on failure, and the crawl must be resumable/idempotent
  (skip pages already mirrored on re-run) — same principles
  `chinese-intel-pipeline`'s fetch engine already follows. Check `robots.txt`
  first and respect it.
- Output of this phase: `raw/` (untouched original bytes) + a `manifest.json`
  (URL → local path → parent index → detected title), which Phase 2 consumes
  to know page order and hierarchy.

## Phase 2 — PDF conversion

- Once mirrored, render each content page to PDF preserving the original
  table-based layout as faithfully as possible. Headless Chromium print-to-PDF
  (via `playwright`) is the safer bet here over `weasyprint` — this site
  leans on old-school HTML table layout, and Chromium's own layout/print
  engine handles that more faithfully than a from-scratch CSS box-model
  implementation.
- Use `manifest.json`'s hierarchy (volume → chapter → section → page) to:
  - Order pages correctly within each volume.
  - Merge per-page PDFs into one PDF per volume (`pypdf`/`pikepdf`).
  - Build a real PDF outline/bookmarks tree matching the source's own
    chapter/section structure, so the result is actually navigable —
    this is the main value-add over the raw site.
- Decide once real content is in hand whether "one PDF per volume" or "one
  combined PDF for everything" is more usable — leaning per-volume, since
  that mirrors how the source itself is organized and keeps file sizes sane.
- `pdf-markdown-pipeline`'s conversion/OCR API is available if a searchable
  markdown/text layer on top of the PDFs is wanted later, but isn't needed
  for this phase — the source is native HTML/text, not scanned images, so
  there's nothing to OCR.

## Phase 3 — Browsable UI (plan)

Stack decision: **Next.js + `@opennextjs/cloudflare` → Cloudflare Workers**,
`pnpm`, deployed to `financialhandbook.exciseup.in`. Matches the pattern
already used by `~/Projects/chinese-intel-pipeline/dashboard` (and other
`~/Projects/*` repos live on Cloudflare with custom domains) — same
`opennextjs-cloudflare build && deploy` flow, same `wrangler.jsonc` shape,
so nothing new to learn operationally. UI takes visual/structural cues from
that dashboard: Tailwind v4, shadcn components, `lucide-react`/tabler icons,
sidebar-nav + content-pane layout.

Source data: **not** the heavy per-volume PDFs (`pdf/`, `pdf_pages/`) — those
are gitignored and out of scope here per your note. The UI reads from the
already-mirrored `raw/` HTML + `manifest.json` hierarchy instead.

### Recommended shape (static, no DB)

The handbook doesn't change — it's a legacy static site, rebuilt only when
re-crawled. That means the lazy-correct option is to bake content in at
build time rather than stand up a database for it:

1. **Seed step** (`web/scripts/build-content.ts` or reuse Python): walk
   `manifest.json`, for each HTML page strip the old table-nav chrome
   (back/home button rows, stray `<font>` tags) and keep the body content +
   title, emit one JSON/MDX file per page under `web/content/<volume>/...`
   plus a `nav.json` tree per volume (reusing the same `parent` chain
   Phase 2's `merge.py` already walks — CSR's 3-level nesting included for
   free, no special-casing).
2. **Search**: prebuild a client-side index (`flexsearch` or `minisearch`,
   a few MB gzipped for ~723 pages of legal text) at the same seed step —
   no D1/FTS5, no server round-trip, no cold-start query cost. Good enough
   at this content size; this is the one rung *below* what the sibling repos
   use (they need D1 because their content is live/growing — this handbook
   is neither).
3. **Routes**: `/[volume]/[...slug]` — static/ISR page per content page,
   sidebar tree from `nav.json`, breadcrumbs, a "view original on
   budget.up.nic.in" link for provenance. `/search` client-side over the
   prebuilt index.
4. **Deploy**: `wrangler.jsonc` with just the `assets` binding (no `d1_databases`
   block needed under this option) — `pnpm run deploy` →
   `opennextjs-cloudflare build && opennextjs-cloudflare deploy`. Attach
   `financialhandbook.exciseup.in` as a custom domain the same way the other
   `~/Projects` repos do (Cloudflare dashboard → Workers → custom domains,
   or `wrangler`); should be a five-minute step given it's already a known
   pattern on this account.

### If you want server-side/DB search instead

Drop in **D1 + `drizzle-orm` + FTS5** (same as `chinese-intel-pipeline`'s
`dashboard`): one `pages` table (slug, volume, title, breadcrumb, html) +
one FTS5 virtual table, seeded once from the same walk as above. Worth it
only if the UI grows features that need a real query layer (tagging,
cross-references, admin edits) — not needed just to serve/search a fixed
~723-page static corpus. Say the word and I'll scaffold this variant
instead.

### Open before building

- New repo, or a `web/` subdirectory in this one? Sibling `~/Projects` repos
  are one-repo-per-app; matching that means a new `up-finance-handbook-web`
  (or similar) repo rather than nesting a pnpm/Next app inside this Python
  crawler repo.

## Open questions to resolve during Phase 1 — answered

- **Nesting**: two levels (index → content) holds for volume2, volume3,
  volume5/part1, volume5/part2, and volume7. **CSR is the exception**: its
  chapter pages (`CSR/02.html`, `CSR/03.html`, ...) link a further tier of
  note pages (`CSR/n21.html`, `n22.html`, ...) — three levels deep. The
  crawler doesn't hardcode depth, so this was captured automatically; the
  manifest's `parent` chain preserves the real hierarchy regardless of depth.
- **Volume VI is not HTML at all** — `volume6/index.html` is a table of
  contents linking straight to pre-made chapter PDFs (`book/Chapter-1.pdf`,
  etc.), not numbered `.html` content pages. Phase 2 doesn't need to render
  this volume — just download and merge/bookmark the existing PDFs
  (5 of the 38 linked chapter/appendix PDFs 404 on the source itself).
- **Total size**: 800 URLs discovered, 184 MiB mirrored. 723 HTML pages,
  33 PDFs (all volume VI), 26 image/asset files, 18 dead links (404s baked
  into the source itself — matches the "Volume I has no live link" note
  below). No scanned-image content pages found — everything is native
  text/table HTML, so no OCR needed anywhere.
- Per-volume page counts: vol5/part1 = 319 (largest by far), vol7 = 135,
  vol5/part2 = 108, vol2 = 72, CSR = 43, vol3 = 60, vol6 = 39 (PDFs).

## Status

**Phase 1 complete.** `crawl.py` mirrors the site (polite: identifying UA,
0.5s delay, retry w/ backoff, resumable — re-running skips URLs already
recorded with a 200 and a file on disk; robots.txt checked, none present)
into `raw/` + `manifest.json` (URL → local path → parent → depth → type →
title → detected encoding).

**Phase 2 complete.** `render.py` serves `raw/` over a local HTTP server
and prints all 709 content pages to PDF via headless Chromium (each page's
own declared charset drives correct decoding — no separate UTF-8 mirror
needed) into `pdf_pages/`. `merge.py` walks `manifest.json`'s crawl tree
(`url -> parent`) to build a real nested bookmark outline per volume —
chapter/section titles are pulled from the *linking* page's anchor text,
since content pages' own `<title>` tags are often just paragraph-range
stubs — and merges into `pdf/{volume2,volume3,volume5_part1,volume5_part2,
volume6,volume7,CSR}.pdf` plus `pdf/combined.pdf` (one file, all volumes,
each nested under a top-level volume bookmark). Volume VI skips rendering
entirely and merges its pre-made source chapter PDFs directly. Each PDF
also gets a printed, clickable Table of Contents as its first page(s)
(built with `reportlab` + `pypdf` link annotations, not just sidebar
bookmarks) — every volume PDF has its own detailed TOC, and `combined.pdf`
additionally has a top-level TOC listing all 7 volumes; both jump straight
to the right page. Output: 2,594 combined pages, ~194 MiB (volume VI's
original source PDFs dominate size).

Note on page numbers: the printed TOC / bookmark labels reflect each
volume's own PDF page numbers, not the original bound book's printed
page numbers — the source HTML doesn't expose real book pagination in a
consistent, parseable way (checked: no in-body page markers, and only
Volume VI's own TOC table happens to list original page ranges per
chapter). Not implemented to avoid fabricating numbers the data doesn't
actually support.

Next action: Phase 3 (browsable UI) — lowest priority, not started.
