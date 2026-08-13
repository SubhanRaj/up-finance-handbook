#!/usr/bin/env python3
"""Phase 2 step 2: merge rendered page PDFs into bookmarked, TOC'd volume
PDFs + one combined PDF, using manifest.json's crawl tree (url -> parent)
for page order and the outline/bookmark hierarchy.

Chapter/section titles come from the *linking* page's anchor text (a
content page's own <title> tag is often just a paragraph-range stub like
"[1-2", not a real heading), so each parent page is re-parsed once to map
child href -> visible link text.

Each volume PDF (and the combined PDF) gets, in addition to the sidebar
bookmark tree:
  - a printed, clickable Table of Contents as its first page(s).
Volume VI is pre-made chapter PDFs on the source site (no HTML render step
exists for it) and is merged directly from raw/.
"""
import json
import re
import urllib.parse
from pathlib import Path

from bs4 import BeautifulSoup
from pypdf import PdfReader, PdfWriter
from pypdf.annotations import Link
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

ROOT = Path(__file__).parent
RAW_DIR = ROOT / "raw"
PDF_PAGES_DIR = ROOT / "pdf_pages"
OUT_DIR = ROOT / "pdf"
MANIFEST_PATH = ROOT / "manifest.json"

VOLUMES = [
    ("volume2", "https://budget.up.nic.in/Fin_H_Book/volume2/financial handbook ii.html"),
    ("volume3", "https://budget.up.nic.in/Fin_H_Book/volume3/financial handbook1.html"),
    ("volume5_part1", "https://budget.up.nic.in/Fin_H_Book/volume5/part1/index.html"),
    ("volume5_part2", "https://budget.up.nic.in/Fin_H_Book/volume5/part2/PREFACE.htm"),
    ("volume6", "https://budget.up.nic.in/Fin_H_Book/volume6/index.html"),  # special-cased (PDF-only children)
    ("volume7", "https://budget.up.nic.in/Fin_H_Book/volume7/index.html"),
    ("CSR", "https://budget.up.nic.in/Fin_H_Book/CSR/index.html"),
]
VOLUME_LABELS = {
    "volume2": "Volume II — Service Conditions & Allowances",
    "volume3": "Volume III — Travelling Allowance Rules",
    "volume5_part1": "Volume V Part I — Account Rules",
    "volume5_part2": "Volume V Part II — Treasury Procedure",
    "volume6": "Volume VI — Works Department Financial Rules",
    "volume7": "Volume VII — Forest Department Financial Rules",
    "CSR": "Civil Service Regulations",
}

TOC_MARGIN = 40
TOC_LINE_HEIGHT = 14
TOC_FONT_SIZE = 9
TOC_INDENT = 14
PAGE_W, PAGE_H = A4


def clean_title(text, fallback):
    text = re.sub(r"\s+", " ", (text or "")).strip()
    return text or fallback


def anchor_text_map(url, encoding):
    """href (resolved absolute, no fragment) -> first visible link text on this page."""
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


def build_children_map(pages):
    children = {}
    for url, e in pages.items():
        parent = e.get("parent")
        if parent:
            children.setdefault(parent, []).append(url)
    return children


def volume6_children_ordered(pages, index_url):
    children = [u for u, e in pages.items() if e.get("parent") == index_url and e.get("type") == "pdf"]

    def order_key(u):
        local = pages[u]["local_path"]
        m = re.search(r"(\d+)", Path(local).stem)
        is_appendix = "appendix" in local.lower()
        return (is_appendix, int(m.group(1)) if m else 0, local)

    return sorted(children, key=order_key)


class NodeCollector:
    def __init__(self, pages, children_map):
        self.pages = pages
        self.children_map = children_map
        self.nodes = []  # dicts: id, parent_id, depth, title, source_path, num_pages
        self._next_id = 0

    def collect(self, url, depth=0, parent_id=None, label_override=None, is_volume6=False):
        entry = self.pages.get(url)
        if not entry or entry.get("status") != 200 or entry.get("type") not in ("html", "pdf"):
            return parent_id

        if entry["type"] == "html":
            rel = Path(entry["local_path"]).relative_to("raw")
            source_path = PDF_PAGES_DIR / rel.with_suffix(".pdf")
            fallback = rel.stem
        else:  # pdf (volume6 chapter)
            source_path = ROOT / entry["local_path"]
            fallback = Path(entry["local_path"]).stem

        this_id = parent_id
        if source_path.exists():
            num_pages = len(PdfReader(str(source_path)).pages)
            title = clean_title(label_override or entry.get("title"), fallback)
            node = {
                "id": self._next_id, "parent_id": parent_id, "depth": depth,
                "title": title, "source_path": source_path, "num_pages": num_pages,
            }
            self._next_id += 1
            self.nodes.append(node)
            this_id = node["id"]
            depth += 1

        if is_volume6:
            text_map = anchor_text_map(url, "windows-1252")
            for child in volume6_children_ordered(self.pages, url):
                self.collect(child, depth, this_id, text_map.get(child))
        else:
            kids = self.children_map.get(url, [])
            if kids:
                text_map = anchor_text_map(url, entry.get("encoding"))
                for child in kids:
                    child_entry = self.pages.get(child)
                    if not child_entry or child_entry.get("type") != "html":
                        continue
                    self.collect(child, depth, this_id, text_map.get(child))
        return this_id


def build_toc_pdf(nodes, toc_path, doc_title):
    lines_per_page = max(1, int((PAGE_H - 2 * TOC_MARGIN - TOC_LINE_HEIGHT) // TOC_LINE_HEIGHT))
    toc_page_count = max(1, -(-len(nodes) // lines_per_page))  # ceil

    c = canvas.Canvas(str(toc_path), pagesize=A4)
    link_rects = []  # (toc_page_index, x0, y0, x1, y1, target_page_index)

    for i, node in enumerate(nodes):
        target_page_index = toc_page_count + node["start_page"]
        page_in_toc = i // lines_per_page
        row_on_page = i % lines_per_page
        if row_on_page == 0:
            if i != 0:
                c.showPage()
            c.setFont("Helvetica-Bold", 14)
            c.drawString(TOC_MARGIN, PAGE_H - TOC_MARGIN + 6, doc_title if page_in_toc == 0 else f"{doc_title} (cont'd)")
            c.setFont("Helvetica", TOC_FONT_SIZE)
        y = PAGE_H - TOC_MARGIN - TOC_LINE_HEIGHT - row_on_page * TOC_LINE_HEIGHT
        indent = TOC_MARGIN + node["depth"] * TOC_INDENT
        num_str = str(target_page_index + 1)
        max_title_width = PAGE_W - TOC_MARGIN - indent - 40
        title = node["title"]
        while c.stringWidth(title, "Helvetica", TOC_FONT_SIZE) > max_title_width and len(title) > 3:
            title = title[:-2]
        if title != node["title"]:
            title += "…"
        c.drawString(indent, y, title)
        c.drawRightString(PAGE_W - TOC_MARGIN, y, num_str)
        link_rects.append((page_in_toc, TOC_MARGIN, y - 3, PAGE_W - TOC_MARGIN, y + TOC_LINE_HEIGHT - 3, target_page_index))

    c.showPage()
    c.save()
    return toc_page_count, link_rects


def assemble(nodes, out_path, doc_title, use_outline_item=False):
    # cumulative start_page (0-based, relative to just the content, before TOC is prepended)
    running = 0
    for node in nodes:
        node["start_page"] = running
        running += node["num_pages"]

    toc_path = out_path.with_suffix(".toc.pdf")
    toc_page_count, link_rects = build_toc_pdf(nodes, toc_path, doc_title)

    writer = PdfWriter()
    writer.append(str(toc_path))

    id_to_bookmark = {}
    for node in nodes:
        start = len(writer.pages)
        if use_outline_item:
            # node's own source PDF already carries its own outline (it's a whole
            # merged volume) — outline_item nests that imported tree under one
            # new bookmark instead of leaving it dangling at the top level.
            writer.append(str(node["source_path"]), outline_item=node["title"])
        else:
            writer.append(str(node["source_path"]))
            parent_bookmark = id_to_bookmark.get(node["parent_id"])
            id_to_bookmark[node["id"]] = writer.add_outline_item(node["title"], start, parent=parent_bookmark)

    for toc_page_idx, x0, y0, x1, y1, target in link_rects:
        writer.add_annotation(page_number=toc_page_idx, annotation=Link(
            rect=(x0, y0, x1, y1), target_page_index=target,
        ))

    with open(out_path, "wb") as f:
        writer.write(f)
    toc_path.unlink()
    return len(writer.pages)


def main():
    manifest = json.loads(MANIFEST_PATH.read_text())
    pages = manifest["pages"]
    children_map = build_children_map(pages)

    OUT_DIR.mkdir(exist_ok=True)

    combined_nodes = []
    combined_running = 0

    for stem, root_url in VOLUMES:
        label = VOLUME_LABELS[stem]
        collector = NodeCollector(pages, children_map)
        collector.collect(root_url, is_volume6=(stem == "volume6"))
        nodes = collector.nodes
        if not nodes:
            print(f"{stem}: no content found, skipping")
            continue

        out_path = OUT_DIR / f"{stem}.pdf"
        total_pages = assemble(nodes, out_path, label)
        print(f"{stem}: {total_pages} pages (incl. its own TOC) -> {out_path}")

        # fold into the combined PDF's own top-level TOC too, offsets applied after combined TOC size is known
        combined_nodes.append({"depth": 0, "title": label, "source_path": out_path,
                                "num_pages": total_pages})

    combined_path = OUT_DIR / "combined.pdf"
    total = assemble(combined_nodes, combined_path, "UP Finance Handbook — Combined", use_outline_item=True)
    print(f"combined: {total} pages -> {combined_path}")


if __name__ == "__main__":
    main()
