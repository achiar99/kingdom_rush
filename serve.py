#!/usr/bin/env python3
"""Dev static server that disables all caching — avoids the browser serving
stale JS modules while iterating on the game. Not part of the shipped game;
just a local convenience for testing."""
import http.server
import sys

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    http.server.test(HandlerClass=NoCacheHandler, port=port)
