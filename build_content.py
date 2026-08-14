#!/usr/bin/env python3
"""Phase 3 data step: turn manifest.json + raw/ into what the web UI reads.

Output (all under web/):
  content/pages/<slug>.json   - one file per content page: title, breadcrumb,
                                 volume, sourceUrl, cleaned body HTML, plain text
  content/nav.json            - full nav tree per volume (server-rendered sidebar)
  public/search-index.json    - flat {slug,volume,title,breadcrumb,text} list,
                                 fetched lazily by the client search box

Volume VI has no HTML content pages (source ships pre-made chapter PDFs) —
it appears in the nav as a link straight back to the source PDF instead of
a content page.
"""
import json
import re
import urllib.parse
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).parent
RAW_DIR = ROOT / "raw"
WEB_DIR = ROOT / "web"
MANIFEST_PATH = ROOT / "manifest.json"

VOLUMES = [
    ("volume2", "https://budget.up.nic.in/Fin_H_Book/volume2/financial handbook ii.html", "Volume II — Service Conditions & Allowances"),
    ("volume3", "https://budget.up.nic.in/Fin_H_Book/volume3/financial handbook1.html", "Volume III — Travelling Allowance Rules"),
    ("volume5-part1", "https://budget.up.nic.in/Fin_H_Book/volume5/part1/index.html", "Volume V Part I — Account Rules"),
    ("volume5-part2", "https://budget.up.nic.in/Fin_H_Book/volume5/part2/PREFACE.htm", "Volume V Part II — Treasury Procedure"),
    ("volume7", "https://budget.up.nic.in/Fin_H_Book/volume7/index.html", "Volume VII — Forest Department Financial Rules"),
    ("csr", "https://budget.up.nic.in/Fin_H_Book/CSR/index.html", "Civil Service Regulations"),
]
VOLUME6 = {
    "key": "volume6",
    "label": "Volume VI — Works Department Financial Rules",
    "note": "The source publishes this volume as ready-made chapter PDFs rather than HTML pages.",
    "sourceUrl": "https://budget.up.nic.in/Fin_H_Book/volume6/index.html",
}


def slugify(text, fallback, max_len=60):
    text = (text or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    text = text[:max_len].rstrip("-")
    return text or fallback


def clean_title(text, fallback):
    text = re.sub(r"\s+", " ", (text or "")).strip()
    return text or fallback


def is_weak_label(label):
    """True for TOC link text that's just a bare ordinal/footnote marker
    ("001", "01A", "*", "") rather than an actual descriptive title. Deliberately
    narrow (mostly-digits, or a lone footnote symbol) so real short words like
    "Fund" or "Rent" aren't mistaken for weak labels."""
    stripped = re.sub(r"\s+", "", label or "")
    if not stripped:
        return True
    return bool(re.fullmatch(r"\d{1,4}[A-Za-z]?", stripped) or re.fullmatch(r"[*†‡]{1,2}", stripped))


def anchor_text_map(url, encoding):
    local = RAW_DIR / Path(url.replace("https://budget.up.nic.in/", ""))
    if not local.exists():
        return {}
    raw = local.read_bytes()
    try:
        html = raw.decode(encoding or "windows-1252", errors="replace")
    except LookupError:
        html = raw.decode("windows-1252", errors="replace")
    soup = BeautifulSoup(html, "lxml")
    mapping = {}
    for a in soup.find_all("a", href=True):
        href = urllib.parse.urljoin(url, a["href"].strip()).split("#")[0]
        if href not in mapping:
            text = a.get_text(" ", strip=True)
            if text:
                mapping[href] = text
    return mapping


def clean_body_html(raw_bytes, encoding):
    try:
        html = raw_bytes.decode(encoding or "windows-1252", errors="replace")
    except LookupError:
        html = raw_bytes.decode("windows-1252", errors="replace")
    soup = BeautifulSoup(html, "lxml")
    body = soup.body or soup

    # Drop the legacy back/home nav row (a <table> whose only images are the
    # back2_b.gif / home4_b.gif button icons) — the web UI has its own sidebar.
    for table in body.find_all("table"):
        imgs = table.find_all("img")
        if imgs and all(re.search(r"back|home", (img.get("src") or ""), re.I) for img in imgs):
            table.decompose()

    # Images from the old mirror aren't served by the web app — drop stray refs.
    for img in body.find_all("img"):
        img.decompose()

    for tag in body.find_all(["meta", "script", "style"]):
        tag.decompose()

    # Drop literal presentational colors from the 2000s-era source (dozens of
    # near-random <font color="#..."> / bgcolor / align values with no contrast
    # guarantee against a dark background) — keep `size` (drives the heading-like
    # CSS rules) and drop everything else so text just inherits the site's own
    # theme colors in both light and dark mode. Doesn't touch any text content.
    for tag in body.find_all(True):
        for attr in ("color", "bgcolor"):
            if tag.has_attr(attr):
                del tag[attr]
        if tag.has_attr("style"):
            tag["style"] = re.sub(r"color\s*:\s*[^;]+;?", "", tag["style"], flags=re.I)

    # Chapter/section heading, if the page has one — its own large-font opening
    # lines (e.g. "CHAPTER I" / "EXTENT OF APPLICATION"), used as a fallback
    # title when the linking TOC page only gave us a bare number like "001".
    heading = None
    big_font = body.find_all("font", attrs={"size": ["4", "5"]}, limit=4)
    parts = []
    for f in big_font:
        t = f.get_text(" ", strip=True)
        if t:
            parts.append(t)
        if sum(len(p) for p in parts) > 80:
            break
    if parts:
        heading = " — ".join(parts[:2])

    inner_html = body.decode_contents().strip()
    text = body.get_text(" ", strip=True)
    return inner_html, text, heading


CHAPTER_PREFIX_RE = re.compile(r"^CHAPTER\s+[IVXLCDM]+[\-A]*\s*[—–-]?\s*", re.I)


def rewrite_links(html_fragment, own_url, url_to_slug, slug_to_title):
    """TOC/index pages keep the legacy site's own <a href> targets (relative
    filenames like "02.html", or absolute dead links back to budget.up.nic.in) —
    none of those resolve to our title-derived slugs, so every one 404s on the
    web app. Rewrite anything that resolves to a page we actually built into an
    internal /slug link; anything on the source site that *doesn't* resolve
    (genuinely dead, even in the original) gets unwrapped to plain text instead
    of left as a dead link. Real external links (not on budget.up.nic.in) and
    mailto:/javascript: hrefs are left untouched."""
    soup = BeautifulSoup(f"<div>{html_fragment}</div>", "lxml")
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith("javascript:") or href.startswith("mailto:"):
            continue
        resolved = urllib.parse.urljoin(own_url, href)
        parsed = urllib.parse.urlparse(resolved)
        if parsed.netloc and parsed.netloc != "budget.up.nic.in":
            continue
        slug = url_to_slug.get(resolved.split("#")[0])
        if slug:
            a["href"] = f"/{slug}"
        else:
            a.unwrap()

    # TOC table cells commonly look like "<a>020</a>1—7" — the crawled page's own
    # link code (its old numbered filename) immediately followed, with no
    # separating space, by the *original printed book*'s page range — meaningless
    # on the web, nothing here is paginated. Drop that trailing dead text
    # entirely and keep only the link itself, so the column just shows a clean
    # working link (e.g. "020") in whatever font/size/style it already had —
    # nothing about the anchor's own formatting is touched, only the extra
    # sibling content appended after it within the cell is removed.
    for td in soup.find_all("td"):
        links = td.find_all("a", href=True)
        if len(links) != 1:
            continue
        a = links[0]
        if not a["href"].startswith("/"):
            continue
        node = a
        while node is not None and node.parent is not td:
            for sibling in list(node.find_next_siblings()):
                sibling.extract()
            node = node.parent
        if node is not None:
            for sibling in list(node.find_next_siblings()):
                sibling.extract()

    # Some TOC rows have a genuinely empty title cell in the source itself (e.g.
    # volume2's Chapter IV row: numeral + link, no title in between) — not
    # something we broke, the original site shipped it that way. We already know
    # the real title from the linked page's own heading, so fill it in rather
    # than leave the row blank. Match the sibling rows' own casing convention
    # ("CHAPTER IV—PAY" -> "Pay", same transform that turns "CHAPTER
    # I—EXTENT OF APPLICATION" into the "Extent of application" already present
    # verbatim in a filled-in sibling row) and wrap in the same <font size="3">
    # sibling title cells use, so it's indistinguishable in style from the rest
    # of the table.
    for tr in soup.find_all("tr"):
        tds = tr.find_all("td", recursive=False)
        if len(tds) < 2:
            continue
        links = tr.find_all("a", href=True)
        internal = [a for a in links if a["href"].startswith("/")]
        if len(internal) != 1:
            continue
        slug = internal[0]["href"].lstrip("/")
        title = slug_to_title.get(slug)
        if not title:
            continue
        link_td = next((td for td in tds if internal[0] in td.find_all("a")), None)
        empty_tds = [td for td in tds if td is not link_td and not td.get_text(strip=True)]
        if len(empty_tds) != 1:
            continue
        clean = CHAPTER_PREFIX_RE.sub("", title).strip().capitalize()
        if not clean:
            continue
        font = soup.new_tag("font", attrs={"size": "3"})
        font.string = clean
        empty_tds[0].append(font)

    return soup.div.decode_contents().strip()


class Builder:
    def __init__(self, pages):
        self.pages = pages
        self.children_map = {}
        for url, e in pages.items():
            parent = e.get("parent")
            if parent:
                self.children_map.setdefault(parent, []).append(url)
        self.search_rows = []
        self.used_slugs = {}  # slug_prefix -> set of leaf slugs already taken, for dedup
        self.order_counter = 0  # global document-order sequence, for prev/next + section ordering
        self.built = {}  # url -> page data, written to disk only after the whole tree is known

    def unique_leaf_slug(self, slug_prefix, title, fallback):
        base = slugify(title, fallback)
        used = self.used_slugs.setdefault(slug_prefix, set())
        leaf = base
        n = 2
        while leaf in used:
            leaf = f"{base}-{n}"
            n += 1
        used.add(leaf)
        return leaf

    def walk(self, url, volume_key, slug_prefix, label_override=None):
        entry = self.pages.get(url)
        if not entry or entry.get("status") != 200 or entry.get("type") != "html":
            return None

        local = RAW_DIR / Path(entry["local_path"]).relative_to("raw")
        raw_bytes = local.read_bytes()
        html_body, text, heading = clean_body_html(raw_bytes, entry.get("encoding"))
        # The linking TOC page's anchor text is often just a bare number ("001") for
        # several volumes (vol2/vol3/vol7/CSR don't give real link text like vol5's
        # does) — prefer the page's own chapter heading in that case. Footnote-style
        # pages (CSR's *, † note pages) have no real heading — their biggest <font>
        # block is the footnote body itself, so only trust "heading" when it's
        # short enough to plausibly be a title, not a paragraph.
        best_label = label_override
        if is_weak_label(best_label):
            short_heading = heading if heading and len(heading) <= 100 else None
            best_label = short_heading or entry.get("title")
        title = clean_title(best_label, local.stem)
        if slug_prefix:
            leaf = self.unique_leaf_slug(slug_prefix, title, local.stem)
            slug = f"{slug_prefix}/{leaf}"
        else:
            slug = volume_key
        self.order_counter += 1
        order = self.order_counter

        node = {"title": title, "slug": slug, "url": url, "children": []}

        self.built[url] = {
            "slug": slug, "title": title, "volume": volume_key,
            "sourceUrl": url, "html": html_body, "order": order,
        }

        if text.strip():
            self.search_rows.append({
                "slug": slug, "volume": volume_key, "title": title,
                "text": text[:4000],
            })

        kids = self.children_map.get(url, [])
        if kids:
            text_map = anchor_text_map(url, entry.get("encoding"))
            for child in kids:
                child_entry = self.pages.get(child)
                if not child_entry or child_entry.get("type") != "html":
                    continue
                child_node = self.walk(child, volume_key, slug, text_map.get(child))
                if child_node:
                    node["children"].append(child_node)
        return node

    def write_pages(self):
        """Rewrite legacy <a href> targets to internal /slug links now that every
        page in the tree has a known slug, then write content/pages/*.json."""
        url_to_slug = {url: d["slug"] for url, d in self.built.items()}
        slug_to_title = {d["slug"]: d["title"] for d in self.built.values()}
        page_dir = WEB_DIR / "content" / "pages"
        page_dir.mkdir(parents=True, exist_ok=True)
        for url, d in self.built.items():
            html = rewrite_links(d["html"], url, url_to_slug, slug_to_title)
            (page_dir / f"{d['slug'].replace('/', '__')}.json").write_text(json.dumps({
                "slug": d["slug"],
                "title": d["title"],
                "volume": d["volume"],
                "sourceUrl": d["sourceUrl"],
                "html": html,
                "order": d["order"],
            }, ensure_ascii=False))


def main():
    manifest = json.loads(MANIFEST_PATH.read_text())
    pages = manifest["pages"]
    builder = Builder(pages)

    nav_volumes = []
    for key, root_url, label in VOLUMES:
        tree = builder.walk(root_url, key, "")
        if tree is None:
            continue
        tree["title"] = label
        nav_volumes.append({"key": key, "label": label, "entrySlug": tree["slug"], "tree": tree})

    nav_volumes.append({"key": VOLUME6["key"], "label": VOLUME6["label"], "external": VOLUME6})

    builder.write_pages()

    nav_path = WEB_DIR / "content" / "nav.json"
    nav_path.parent.mkdir(parents=True, exist_ok=True)
    nav_path.write_text(json.dumps({"volumes": nav_volumes}, ensure_ascii=False, indent=2))

    search_path = WEB_DIR / "public" / "search-index.json"
    search_path.parent.mkdir(parents=True, exist_ok=True)
    search_path.write_text(json.dumps(builder.search_rows, ensure_ascii=False))

    n_pages = len(list((WEB_DIR / "content" / "pages").glob("*.json")))
    print(f"{n_pages} content pages, {len(builder.search_rows)} search rows, {len(nav_volumes)} volumes.")


if __name__ == "__main__":
    main()
