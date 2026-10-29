"""Schedule AI Оффис posts on the Facebook Page via the Graph API.

Reads every aioffice/queue/*.json file. Each file is a list of items:
  {"id": "2026-11-06-1", "image": "aioffice/queue/2026-11-06-1.jpg",
   "caption": "...", "publish_at": "2026-11-06T12:30:00+08:00", "status": "pending"}
Pending items are uploaded as photos with published=false and
scheduled_publish_time, so Facebook itself publishes them on time.
Results are written back into the JSON (status, fb_id or error).

Env: FB_PAGE_TOKEN (secret), FB_PAGE_ID, optional FB_API_VERSION (e.g. v23.0),
     DRY_RUN=1 to print instead of calling Facebook.
"""
import glob
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone

GRAPH = "https://graph.facebook.com"


def multipart(fields, file_field, file_path):
    boundary = uuid.uuid4().hex
    body = bytearray()
    for k, v in fields.items():
        body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n".encode()
        body += str(v).encode("utf-8") + b"\r\n"
    with open(file_path, "rb") as f:
        data = f.read()
    name = os.path.basename(file_path)
    body += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{file_field}\"; "
             f"filename=\"{name}\"\r\nContent-Type: image/jpeg\r\n\r\n").encode()
    body += data + b"\r\n" + f"--{boundary}--\r\n".encode()
    return bytes(body), f"multipart/form-data; boundary={boundary}"


def schedule(item, page_id, token, version):
    when = datetime.fromisoformat(item["publish_at"])
    ts = int(when.timestamp())
    now = int(time.time())
    if ts < now + 11 * 60:
        # Facebook needs at least 10 minutes lead time; publish now instead of failing.
        fields = {"caption": item["caption"], "published": "true", "access_token": token}
    else:
        fields = {"caption": item["caption"], "published": "false",
                  "scheduled_publish_time": ts, "access_token": token}
    url = f"{GRAPH}/{version + '/' if version else ''}{page_id}/photos"
    if os.environ.get("DRY_RUN") == "1":
        print("DRY_RUN", url, {k: v for k, v in fields.items() if k != "access_token"}, item["image"])
        return {"id": "dry-run"}
    body, ctype = multipart(fields, "source", item["image"])
    req = urllib.request.Request(url, data=body, headers={"Content-Type": ctype}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(e.read().decode("utf-8", "replace"))


def main():
    token = os.environ.get("FB_PAGE_TOKEN", "")
    page_id = os.environ.get("FB_PAGE_ID", "")
    version = os.environ.get("FB_API_VERSION", "").strip()
    if not page_id or (not token and os.environ.get("DRY_RUN") != "1"):
        sys.exit("FB_PAGE_ID and FB_PAGE_TOKEN are required")
    failed = 0
    for path in sorted(glob.glob("aioffice/queue/*.json")):
        items = json.load(open(path, encoding="utf-8"))
        changed = False
        for it in items:
            if it.get("status") != "pending":
                continue
            try:
                res = schedule(it, page_id, token, version)
                it["status"] = "scheduled"
                it["fb_id"] = res.get("post_id") or res.get("id")
                print(f"OK {it['id']} -> {it['fb_id']} at {it['publish_at']}")
            except Exception as e:  # keep going, record the error
                it["status"] = "error"
                it["error"] = str(e)[:500]
                failed += 1
                print(f"FAIL {it['id']}: {it['error']}")
            it["processed_at"] = datetime.now(timezone.utc).isoformat()
            changed = True
        if changed:
            json.dump(items, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
