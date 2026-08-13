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


def slugify(text, fallback):
    text = re.sub(r"\s+", "-", (text or "").strip().lower())
    text = re.sub(r"[^a-z0-9\-]", "", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text or fallback


def clean_title(text, fallback):
    text = re.sub(r"\s+", " ", (text or "")).strip()
    return text or fallback


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
    import urllib.parse
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

    inner_html = body.decode_contents().strip()
    text = body.get_text(" ", strip=True)
    return inner_html, text


class Builder:
    def __init__(self, pages):
        self.pages = pages
        self.children_map = {}
        for url, e in pages.items():
            parent = e.get("parent")
            if parent:
                self.children_map.setdefault(parent, []).append(url)
        self.search_rows = []

    def walk(self, url, volume_key, slug_prefix, label_override=None):
        entry = self.pages.get(url)
        if not entry or entry.get("status") != 200 or entry.get("type") != "html":
            return None

        local = RAW_DIR / Path(entry["local_path"]).relative_to("raw")
        raw_bytes = local.read_bytes()
        html_body, text = clean_body_html(raw_bytes, entry.get("encoding"))
        title = clean_title(label_override or entry.get("title"), local.stem)
        slug = f"{slug_prefix}/{slugify(local.stem, local.stem)}" if slug_prefix else volume_key

        node = {"title": title, "slug": slug, "url": url, "children": []}

        page_dir = WEB_DIR / "content" / "pages"
        page_dir.mkdir(parents=True, exist_ok=True)
        (page_dir / f"{slug.replace('/', '__')}.json").write_text(json.dumps({
            "slug": slug,
            "title": title,
            "volume": volume_key,
            "sourceUrl": url,
            "html": html_body,
        }, ensure_ascii=False))

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
