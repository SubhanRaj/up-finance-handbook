# CLAUDE.md — UP Finance Handbook Archive

Instructions for AI agents working in this repo. This file documents rules to preserve, not a
build log — see [README.md](README.md) for what the system does and [ROADMAP.md](ROADMAP.md) for
phase-by-phase history and status. [web/CLAUDE.md](web/CLAUDE.md) has the web app's own rules.

## What this is

A three-phase pipeline that mirrors the UP Finance Department's legacy table-HTML site
(`budget.up.nic.in/finhando.htm`) into (1) a local crawl, (2) bookmarked PDFs, and (3) a live,
searchable web app at **financialhandbook.exciseup.in**. Phases 1–2 are Python scripts run by
hand, not a service; Phase 3 is a Next.js app on Cloudflare Workers + D1.

## Pipeline shape

```mermaid
flowchart LR
    Site[("budget.up.nic.in\n(live site)")] -->|crawl.py| Raw["raw/\n+ manifest.json\n(gitignored, 184 MiB)"]

    Raw -->|render.py + Chromium| PdfPages["pdf_pages/\n(gitignored)"]
    PdfPages -->|merge.py| PDFs["pdf/*.pdf\n(gitignored, ~194 MiB)"]

    Raw -->|build_content.py| Content["web/content/\nnav.json (committed)\npages/*.json (gitignored,\nintermediate only)"]
    Content -->|generate_seed_sql.py| Seed["web/seed.sql\n(gitignored)"]
    Seed -->|wrangler d1 execute| D1[("Cloudflare D1\npages table")]
    D1 --> Worker["Next.js Worker\n(@opennextjs/cloudflare)"]
    Content -.nav.json only.-> Worker
    Worker --> Live(["financialhandbook.exciseup.in"])

    style Live fill:#16a34a,color:#fff
    style D1 fill:#b45309,color:#fff
```

Rules to preserve:

- **`raw/`, `pdf_pages/`, `pdf/` are gitignored and never committed** — 184 MiB + ~194 MiB of
  regenerable/heavy binary data. `manifest.json` (crawl tree: url → parent → depth → type →
  encoding) *is* committed — small, and Phase 2/3 both depend on its `parent` chain for hierarchy.
- **`web/content/pages/*.json` and `web/seed.sql` are also gitignored** — regenerable
  intermediates on the way to D1, not source of truth once seeded. `web/content/nav.json` *is*
  committed (small, needed directly by the Worker for the sidebar tree — not duplicated into D1).
- **D1 holds canonical page HTML, not this repo.** After `build_content.py` +
  `generate_seed_sql.py` + `wrangler d1 execute --remote`, the D1 database is the source of truth
  the live site actually reads from. Regenerating `web/content/pages/` from a fresh crawl and not
  re-seeding D1 leaves the live site unchanged — the two steps are independent, always do both.
- **Never run `wrangler d1 execute --remote` or `wrangler deploy` without the user explicitly
  saying so for that specific change.** This is a live public site. Local `--local` D1 work,
  `pnpm dev`, and `pnpm run preview` don't need to ask.
- **Civil Service Regulations nests 3 levels deep** (chapter → chapter page → footnote/note page), every other volume
  nests 2. Don't hardcode a depth assumption anywhere — `manifest.json`'s `parent` chain and
  `build_content.py`'s recursive walk already handle arbitrary depth; this was verified by
  crawling the real site, not assumed.
- **Volume VI has no HTML content** — the source ships it as pre-made chapter PDFs
  (`volume6/index.html` links straight to `book/Chapter-N.pdf`). It's excluded from the web app's
  D1-backed content entirely (shown as an external link in the nav) but still merged into
  `pdf/volume6.pdf` by `merge.py` in Phase 2.
- **Legacy presentational HTML is stripped, not the text.** `build_content.py`'s
  `clean_body_html()` removes the old back/home nav table, images, and `color`/`bgcolor`/inline
  `style="color:…"` attributes (2000s-era literal reds/blues with no dark-mode contrast
  guarantee) — it never rewrites or drops actual paragraph/table content. If dark-mode contrast
  ever regresses again, fix it here, not with CSS overrides fighting inline attributes.
- **Sidebar titles**: prefer the *linking* page's anchor text; several volumes (II, III, VII,
  Civil Service Regulations) only link with bare numbers ("001"), so `is_weak_label()` falls back to the page's own
  large-font heading — capped at 100 chars so Civil Service Regulations' footnote-only note pages (whose biggest
  `<font>` block is the footnote body itself, not a heading) don't get a paragraph as a title.
- **Legacy `<a href>` targets are rewritten to internal `/slug` links, not left as-is.** Every
  volume's index/TOC page (and plenty of in-body cross-references) originally linked to the
  source site's own filenames (`02.html`, `../../finhando.htm`) — none of those resolve to our
  title-derived slugs, so left untouched they render as live, permanently-dead links on the web
  app. `build_content.py`'s `Builder` runs in two passes for this reason: `walk()` collects every
  page's cleaned HTML *and* its slug into `self.built` first (without writing anything), then
  `write_pages()` runs once the full `url -> slug` map is known and rewrites each page's `<a
  href>` via `rewrite_links()` — matched hrefs become `/slug`, hrefs that don't resolve to any
  page we built (genuinely dead even on the source) get unwrapped to plain text, and real
  external links are left alone. Don't collapse this back into a single pass — a page can link
  forward to a sibling slug that isn't known yet mid-walk.
- **TOC reference cells with dangling old book page numbers get folded into the link, not left
  bare.** A typical index-table cell is `<a>020</a>1—7` — the crawled page's own link code
  immediately followed by the *original printed book*'s page range, with no separating space,
  which rendered as one garbled number ("0201—7"). `rewrite_links()`'s second pass finds every
  `<td>` with exactly one internal link plus other text and wraps the whole cell (link + trailing
  page range) in a single `<a>`, so the old page numbers stay visible but are now part of a
  working link instead of dead trailing digits. Only fires when the link doesn't already cover
  the whole cell (`td.get_text() != a.get_text()`), so already-fully-linked chapter titles are
  untouched.

## Design system

The web app's UI (theme toggle, reading-customization panel, color tokens, warm paper-textured
light mode) was deliberately ported from `~/Projects/chinese-intel-pipeline/dashboard` — same
Tailwind v4 token setup, same component patterns. When touching UI, check that dashboard's
equivalent component first rather than inventing a new pattern.
