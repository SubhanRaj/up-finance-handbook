# UP Finance Handbook Archive

The UP Finance Department's Financial Handbook (Volumes I–VII + Civil Service
Regulations) is published publicly at
[budget.up.nic.in/finhando.htm](https://budget.up.nic.in/finhando.htm) as a
sprawling, decades-old table-based HTML site — thousands of individual
`.htm`/`.html` pages nested under per-volume/per-chapter index pages, no
search, no unified document, inconsistent encoding.

This project mirrors that site, converts it into a small number of clean,
bookmarked PDFs (one per volume, ideally), and provides a browsable,
searchable web UI (`web/`) on top of the same crawled content.

See [ROADMAP.md](ROADMAP.md) for the plan and current status.

## Usage

Phases 1 and 2 are done. Requires the venv (`python3 -m venv .venv && .venv/bin/pip
install requests beautifulsoup4 lxml chardet playwright pypdf reportlab &&
.venv/bin/playwright install chromium`):

```
.venv/bin/python crawl.py    # Phase 1: mirror the site -> raw/ + manifest.json (resumable)
.venv/bin/python render.py   # Phase 2a: render every content page to PDF -> pdf_pages/
.venv/bin/python merge.py    # Phase 2b: build bookmarked, TOC'd volume PDFs + combined.pdf -> pdf/
```

`raw/`, `pdf_pages/`, and `pdf/` are gitignored (184 MiB / large PDFs) —
not checked into this repo.

### Web UI (`web/`)

**Live: [financialhandbook.exciseup.in](https://financialhandbook.exciseup.in)**

```
.venv/bin/python build_content.py    # raw/ + manifest.json -> web/content/ + web/public/search-index.json
cd web && pnpm install && pnpm dev   # http://localhost:3000
```

Content is served from Cloudflare D1, not from static files — see
[web/README.md](web/README.md) for the full regenerate/seed/deploy flow and
[CLAUDE.md](CLAUDE.md) / [web/CLAUDE.md](web/CLAUDE.md) for the rules an AI
agent must follow when working in this repo (includes architecture
diagrams).

## Source structure (as surveyed 2026-08-13)

`finhando.htm` is the top-level index, linking to per-volume indexes:

| Volume | Entry point | Subject |
|---|---|---|
| Vol II (Part 2-4) | `Fin_H_Book/volume2/financial handbook ii.html` | Service conditions & allowances |
| Vol III | `Fin_H_Book/volume3/financial handbook1.html` | Travelling Allowance Rules |
| Vol V (Part I) | `Fin_H_Book/volume5/part1/index.html` | Account Rules |
| Vol V (Part II) | `Fin_H_Book/volume5/part2/PREFACE.htm` | Treasury Procedure |
| Vol VI | `Fin_H_Book/volume6/index.html` | Works department financial rules |
| Vol VII | `Fin_H_Book/volume7/index.html` | Forest Department financial rules |
| Civil Service Regulations | `Fin_H_Book/CSR/index.html` | Civil Service Regulations |

Volume I and one other listed entry have no live link on the index page (dead
in the source itself, not a crawl bug).

Each volume index (e.g. `volume5/part1/index.html`) is itself a table of
contents (chapters → sections → paragraph refs, plus appendices and forms)
linking straight to numbered content pages (`001.html`, `002.html`, ...) —
two levels of index, not deeper.

## Related projects

- `~/Projects/chinese-intel-pipeline` — has a working scraper/fetch-engine
  pattern worth borrowing conventions from (polite fetching, no headless
  browser unless needed, idempotent re-runs).
- `~/Sites/pdf-markdown-pipeline` — this repo's own PDF/OCR/markdown
  conversion pipeline exposes an API that can optionally be reused here if
  a markdown/searchable-text layer is wanted later; not required for the
  core "clean PDF" goal since the source is already plain HTML/text, not
  scanned documents.
