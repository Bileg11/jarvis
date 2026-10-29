"""Render AI Оффис post cards (1080x1350 JPEG) with Playwright + card.js.

Usage: python aioffice/render.py posts.json OUT_DIR
posts.json: list of {"id","kicker","accent","title","sub","source"}
Writes OUT_DIR/<id>.jpg for each post.
"""
import base64
import json
import os
import sys

from playwright.sync_api import sync_playwright

posts = json.load(open(sys.argv[1], encoding="utf-8"))
out = sys.argv[2]
os.makedirs(out, exist_ok=True)
js = open(os.path.join(os.path.dirname(__file__), "card.js"), encoding="utf-8").read()
with sync_playwright() as pw:
    b = pw.chromium.launch()
    pg = b.new_page()
    pg.set_content("<html><body></body></html>")
    pg.add_script_tag(content=js)
    for p in posts:
        url = pg.evaluate("async p => (await window.makeCard(p)).url", p)
        path = os.path.join(out, f"{p['id']}.jpg")
        open(path, "wb").write(base64.b64decode(url.split(",")[1]))
        print(path)
    b.close()
