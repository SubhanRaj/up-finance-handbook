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

## Phase 3 — Browsable UI (built)

Lives in `web/` (this repo, not a separate one). Next.js (App Router) +
Tailwind v4 + `@opennextjs/cloudflare` → one Cloudflare Worker, `pnpm`.
Design system (theme toggle, reading-customization FAB with font/size/
line-height/width/accent controls, warm paper-textured light mode) ported
from `~/Projects/chinese-intel-pipeline/dashboard`.

- **Content**: `build_content.py` (repo root) walks `manifest.json`'s crawl
  tree — the same `url -> parent` structure `merge.py` uses for PDF
  bookmarks — strips the legacy back/home nav chrome from each page, and
  emits `web/content/pages/*.json` (one per content page) + `web/content/
  nav.json` (the full sidebar tree, CSR's 3-level nesting included for
  free) + `web/public/search-index.json` (flat text index). 715 content
  pages, 12 MiB. Volume VI (no HTML content on the source, pre-made chapter
  PDFs instead) shows up in the nav as a straight link to the source.
- **Rendering**: every content page is prerendered at build time via
  `generateStaticParams` — no database. Confirmed working end-to-end under
  the actual Workers runtime locally (`wrangler dev` + `populateCache
  local`), not just `next dev`.
- **Search**: client-side, `flexsearch` over the prebuilt index fetched
  lazily from `/search-index.json` — no D1/FTS5, no server round-trip.
- **Cache**: prerendered pages are served from an R2-backed incremental
  cache (`@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-
  cache`) rather than re-rendering per request — this was the one piece
  that needed real infra: tested it, a bare static-assets binding 404s on
  every dynamic-route page (only the true root route serves as a static
  asset) until the R2 cache is populated. One R2 bucket, no ongoing
  maintenance. See `web/README.md` for the "why not fully static" tradeoff
  note if that bucket ever feels like overkill.
- **Deploy**: `pnpm run deploy` (`opennextjs-cloudflare build && deploy`),
  one Worker for UI + any future API routes. Custom domain
  `financialhandbook.exciseup.in` attaches via the Cloudflare dashboard the
  same way other `~/Projects/*` Workers do — not yet done (needs your
  Cloudflare login), see `web/README.md`.

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

**Phase 3 built.** See the Phase 3 section above and `web/README.md`.
Next action: attach the `financialhandbook.exciseup.in` custom domain and
run the first real `pnpm run deploy` (needs your Cloudflare login).
