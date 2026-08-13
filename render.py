#!/usr/bin/env python3
"""Phase 2 step 1: render every mirrored HTML content page to PDF.

Serves raw/ over a local HTTP server (so Chromium resolves each page's own
declared charset + relative image/css links correctly, same as the live
site) and prints each page to PDF via headless Chromium. Volume VI is
already PDF-only in raw/ and needs no rendering (handled by merge.py).
Resumable: skips pages whose PDF already exists.
"""
import functools
import http.server
import json
import threading
import urllib.parse
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
RAW_DIR = ROOT / "raw"
PDF_DIR = ROOT / "pdf_pages"
MANIFEST_PATH = ROOT / "manifest.json"
PORT = 8791


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def start_server():
    handler = functools.partial(QuietHandler, directory=str(RAW_DIR))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd


def main():
    manifest = json.loads(MANIFEST_PATH.read_text())
    pages = manifest["pages"]
    todo = [
        e for e in pages.values()
        if e.get("type") == "html" and e.get("status") == 200
    ]
    print(f"{len(todo)} html pages to render.")

    httpd = start_server()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            done = 0
            skipped = 0
            failed = 0
            for e in todo:
                rel = Path(e["local_path"]).relative_to("raw")
                out_path = PDF_DIR / rel.with_suffix(".pdf")
                if out_path.exists():
                    skipped += 1
                    continue
                out_path.parent.mkdir(parents=True, exist_ok=True)
                url = f"http://127.0.0.1:{PORT}/" + "/".join(
                    urllib.parse.quote(part) for part in rel.parts
                )
                try:
                    page.goto(url, wait_until="load", timeout=15000)
                    page.pdf(path=str(out_path), format="A4", print_background=True,
                             margin={"top": "12mm", "bottom": "12mm", "left": "10mm", "right": "10mm"})
                    done += 1
                    if done % 50 == 0:
                        print(f"  rendered {done}/{len(todo)}")
                except Exception as ex:
                    failed += 1
                    print(f"  FAILED {url}: {ex}")
            browser.close()
    finally:
        httpd.shutdown()

    print(f"\nDone. rendered={done} skipped(existing)={skipped} failed={failed}")


if __name__ == "__main__":
    main()
