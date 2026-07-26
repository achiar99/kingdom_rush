#!/usr/bin/env python3
"""Dev server for the game.

- Serves the static files with all caching disabled (avoids the browser
  serving stale JS modules while iterating).
- POST /api/save persists a save slot to save-slot-<n>.json next to this
  script, so progress auto-saves to disk (the game also mirrors saves in
  localStorage; on boot it prefers whichever copy is newer). Sending
  "data": null deletes the slot's file.
"""
import http.server
import json
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SLOT_COUNT = 3

def slot_path(slot):
    return os.path.join(ROOT, f"save-slot-{slot + 1}.json")

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def _respond(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/api/save":
            return self._respond(404, {"error": "unknown endpoint"})
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length))
            slot = int(payload["slot"])
            if not 0 <= slot < SLOT_COUNT:
                return self._respond(400, {"error": "bad slot"})
            if payload.get("data") is None:
                if os.path.exists(slot_path(slot)):
                    os.remove(slot_path(slot))
            else:
                with open(slot_path(slot), "w") as f:
                    json.dump(payload["data"], f, indent=2)
            return self._respond(200, {"ok": True})
        except (ValueError, KeyError, json.JSONDecodeError) as e:
            return self._respond(400, {"error": str(e)})

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    os.chdir(ROOT)
    http.server.test(HandlerClass=Handler, port=port)
