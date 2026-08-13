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

## Phase 3 — Browsable UI (later, optional)

- Lowest priority — only worth doing once Phases 1–2 are solid and someone
  actually wants search/browse over PDF. Options to consider then, not now:
  a static site generated from the cleaned HTML (no backend needed), or a
  thin Laravel/PHP viewer with full-text search (SQLite FTS5 is enough at
  this content size — no need for Elasticsearch/etc.).

## Open questions to resolve during Phase 1

- Does every volume really only nest two levels deep, or does e.g. CSR
  (`Fin_H_Book/CSR/index.html`) have its own different structure worth
  checking early?
- Total page count / total site size (helps decide crawl concurrency and
  whether per-volume PDFs will be reasonably sized).
- Whether any volume embeds actual scanned-image pages instead of text HTML
  (would need OCR via `pdf-markdown-pipeline`, unlike the rest).

## Status

Not started — repo scaffolded with this roadmap only. Next action is Phase 1.
