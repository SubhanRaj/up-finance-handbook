#!/usr/bin/env python3
"""Turns web/content/pages/*.json into a SQL seed file for the D1 `pages` table.

Run after build_content.py. Apply with:
  wrangler d1 execute up-finance-handbook-db --local  --file=web/seed.sql
  wrangler d1 execute up-finance-handbook-db --remote --file=web/seed.sql
"""
import json
from pathlib import Path

WEB_DIR = Path(__file__).parent / "web"
PAGES_DIR = WEB_DIR / "content" / "pages"
OUT_PATH = WEB_DIR / "seed.sql"


def esc(s):
    return s.replace("'", "''")


# D1 caps a single SQL statement's text around 100KB — pages under that go in
# as one INSERT; larger ones start empty and get appended in chunks via
# UPDATE ... SET html = html || '<chunk>', staying well under the cap per statement.
CHUNK_SIZE = 60_000


def main():
    lines = ["DELETE FROM pages;"]
    for f in sorted(PAGES_DIR.glob("*.json")):
        page = json.loads(f.read_text())
        slug, volume, title, source_url, html = (
            page["slug"], page["volume"], page["title"], page["sourceUrl"], page["html"],
        )
        if len(html) <= CHUNK_SIZE:
            lines.append(
                "INSERT INTO pages (slug, volume, title, source_url, html) VALUES "
                f"('{esc(slug)}', '{esc(volume)}', '{esc(title)}', '{esc(source_url)}', '{esc(html)}');"
            )
        else:
            lines.append(
                "INSERT INTO pages (slug, volume, title, source_url, html) VALUES "
                f"('{esc(slug)}', '{esc(volume)}', '{esc(title)}', '{esc(source_url)}', '');"
            )
            for i in range(0, len(html), CHUNK_SIZE):
                chunk = html[i:i + CHUNK_SIZE]
                lines.append(f"UPDATE pages SET html = html || '{esc(chunk)}' WHERE slug = '{esc(slug)}';")
    OUT_PATH.write_text("\n".join(lines))
    print(f"{len(lines) - 1} statements -> {OUT_PATH} ({OUT_PATH.stat().st_size / 1024 / 1024:.1f} MiB)")


if __name__ == "__main__":
    main()
