#!/usr/bin/env python3
"""Polite mirror crawler for budget.up.nic.in/finhando.htm.

Walks the site starting at the top-level index, follows only links on the
same host, saves every page/asset's raw bytes under raw/ (mirroring the
site's own path layout), and records URL -> local path -> parent -> type ->
detected encoding in manifest.json. Resumable: re-running skips URLs already
recorded with a successful fetch and a file present on disk.
"""
import json
import sys
import time
import urllib.parse
import urllib.robotparser
from pathlib import Path

import requests
from bs4 import BeautifulSoup

HOST = "budget.up.nic.in"
START_URL = f"https://{HOST}/finhando.htm"
UA = "UPFinanceHandbookArchiver/1.0 (+claudeupexcise@gmail.com; personal archival mirror)"
DELAY = 0.5
RETRIES = 3
TIMEOUT = 20
ROOT = Path(__file__).parent
RAW_DIR = ROOT / "raw"
MANIFEST_PATH = ROOT / "manifest.json"

HTML_EXTS = {"htm", "html"}


def load_manifest():
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text())
    return {"start_url": START_URL, "pages": {}}


def save_manifest(manifest):
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))


def check_robots(session):
    rp = urllib.robotparser.RobotFileParser()
    rp.set_url(f"https://{HOST}/robots.txt")
    try:
        resp = session.get(f"https://{HOST}/robots.txt", timeout=TIMEOUT)
        if resp.status_code == 404:
            return None  # no robots.txt -> nothing to respect
        rp.parse(resp.text.splitlines())
        return rp
    except requests.RequestException:
        return None


def url_to_local_path(url):
    parsed = urllib.parse.urlsplit(url)
    path = urllib.parse.unquote(parsed.path).lstrip("/")
    if not path:
        path = "index.html"
    return RAW_DIR / path


def classify(url, content_type):
    ext = url.rsplit(".", 1)[-1].lower().split("?")[0] if "." in url.rsplit("/", 1)[-1] else ""
    if ext in HTML_EXTS or "html" in (content_type or ""):
        return "html"
    if ext == "pdf":
        return "pdf"
    if ext in {"doc", "docx"}:
        return "doc"
    return "asset"


def detect_encoding(raw_bytes, headers):
    soup_probe = raw_bytes[:2048].decode("ascii", errors="ignore").lower()
    if "charset=" in soup_probe:
        try:
            charset = soup_probe.split("charset=")[1].split('"')[0].split("'")[0].split(">")[0].strip()
            charset = charset.split(";")[0].strip()
            if charset:
                return charset
        except IndexError:
            pass
    ctype = headers.get("Content-Type", "")
    if "charset=" in ctype:
        return ctype.split("charset=")[1].strip()
    import chardet
    guess = chardet.detect(raw_bytes)
    return guess.get("encoding") or "windows-1252"


def fetch(session, url):
    for attempt in range(1, RETRIES + 1):
        try:
            resp = session.get(url, timeout=TIMEOUT)
            return resp
        except requests.RequestException as e:
            if attempt == RETRIES:
                print(f"  FAILED after {RETRIES} attempts: {url} ({e})", file=sys.stderr)
                return None
            time.sleep(2 ** attempt)
    return None


def extract_links(html_bytes, encoding, base_url):
    try:
        text = html_bytes.decode(encoding, errors="replace")
    except (LookupError, TypeError):
        text = html_bytes.decode("windows-1252", errors="replace")
    soup = BeautifulSoup(text, "lxml")
    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else ""
    links = []
    for tag, attr in (("a", "href"), ("img", "src"), ("link", "href"), ("frame", "src")):
        for el in soup.find_all(tag):
            val = el.get(attr)
            if not val:
                continue
            val = val.strip()
            if val.lower().startswith(("javascript:", "mailto:", "#")):
                continue
            abs_url = urllib.parse.urljoin(base_url, val)
            abs_url = abs_url.split("#")[0]
            links.append(abs_url)
    return title, links


def crawl():
    RAW_DIR.mkdir(exist_ok=True)
    manifest = load_manifest()
    pages = manifest["pages"]

    session = requests.Session()
    session.headers["User-Agent"] = UA

    robots = check_robots(session)
    if robots is not None:
        print("robots.txt found and loaded.")

    queue = [(START_URL, None, 0)]
    seen = set(pages.keys())
    for url, *_ in queue:
        seen.add(url)

    fetched_count = 0
    while queue:
        url, parent, depth = queue.pop(0)
        parsed = urllib.parse.urlsplit(url)
        if parsed.netloc != HOST:
            continue
        if robots is not None and not robots.can_fetch(UA, url):
            print(f"  BLOCKED by robots.txt: {url}")
            continue

        existing = pages.get(url)
        local_path = url_to_local_path(url)
        if existing and existing.get("status") == 200 and local_path.exists():
            # already mirrored; still walk its links if it's html and we have them cached
            if existing.get("type") == "html":
                for child in existing.get("links", []):
                    if child not in seen:
                        seen.add(child)
                        queue.append((child, url, depth + 1))
            continue

        print(f"[{depth}] fetching {url}")
        resp = fetch(session, url)
        time.sleep(DELAY)
        fetched_count += 1

        entry = {
            "url": url,
            "parent": parent,
            "depth": depth,
            "local_path": str(local_path.relative_to(ROOT)),
        }
        if resp is None:
            entry["status"] = "error"
            pages[url] = entry
            if fetched_count % 20 == 0:
                save_manifest(manifest)
            continue

        entry["status"] = resp.status_code
        if resp.status_code != 200:
            pages[url] = entry
            if fetched_count % 20 == 0:
                save_manifest(manifest)
            continue

        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_bytes(resp.content)

        ctype = resp.headers.get("Content-Type", "")
        page_type = classify(url, ctype)
        entry["type"] = page_type

        if page_type == "html":
            encoding = detect_encoding(resp.content, resp.headers)
            entry["encoding"] = encoding
            title, links = extract_links(resp.content, encoding, url)
            entry["title"] = title
            entry["links"] = links
            for child in links:
                if child not in seen:
                    seen.add(child)
                    queue.append((child, url, depth + 1))

        pages[url] = entry
        if fetched_count % 20 == 0:
            save_manifest(manifest)

    save_manifest(manifest)
    return manifest


if __name__ == "__main__":
    m = crawl()
    total = len(m["pages"])
    by_type = {}
    total_bytes = 0
    for e in m["pages"].values():
        by_type[e.get("type", "error")] = by_type.get(e.get("type", "error"), 0) + 1
        lp = ROOT / e["local_path"]
        if lp.exists():
            total_bytes += lp.stat().st_size
    print(f"\nDone. {total} URLs recorded.")
    print("By type:", by_type)
    print(f"Total mirrored size: {total_bytes / 1024 / 1024:.1f} MiB")
