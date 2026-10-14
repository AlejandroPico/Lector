"""Explicit local media relay for Lector. No cloud, original file edits or discovery."""
import argparse
import ipaddress
import json
import mimetypes
import re
import secrets
import socket
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ALLOWED = {"https://alejandropico.github.io", "http://127.0.0.1:5177", "http://localhost:5177"}
LIMIT = 128 * 1024 * 1024

def presentation(value):
    if not isinstance(value, dict): raise ValueError()
    result = {key: str(value.get(key, ""))[:200] for key in ("title", "chapter", "author")}
    result["language"] = value.get("language", "es") if value.get("language") in {"es", "ca", "en", "fr", "de", "pt", "it", "zh", "ja", "hi"} else "es"
    result["text"] = str(value.get("text", ""))[:20000]
    colors = value.get("colors")
    result["colors"] = colors if isinstance(colors, list) and len(colors) == 3 and all(isinstance(color, str) and re.fullmatch(r"#[a-fA-F0-9]{6}", color) for color in colors) else ["#151a18", "#e7e8dd", "#a5b59a"]
    result["cues"] = []
    if isinstance(value.get("cues"), list):
        for cue in value["cues"][:5000]:
            if not isinstance(cue, dict): continue
            start, end = cue.get("start"), cue.get("end")
            if isinstance(start, (float, int)) and isinstance(end, (float, int)) and 0 <= start < end < 86400:
                result["cues"].append({"start": start, "end": end, "text": str(cue.get("text", ""))[:2000]})
    return result

def run(host, address, port, web, origins=()):
    web = Path(web).resolve()
    if not (web / "receptor.html").is_file(): raise ValueError("Compila Lector antes de iniciar el receptor (--web).")
    ipaddress.ip_address(address)
    sessions, lock = {}, threading.RLock()
    with tempfile.TemporaryDirectory(prefix="lector-emision-") as folder:
        cache = Path(folder).resolve()
        def remove_file(token):
            try: (cache / token).unlink(missing_ok=True)
            except PermissionError: pass  # An in-flight Windows range may hold it briefly.
        def purge():
            for token in list(sessions):
                if sessions[token]["expires"] < time.time():
                    sessions.pop(token)
                    remove_file(token)
            for path in cache.iterdir():
                if path.name not in sessions: remove_file(path.name)
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args): pass
            def admin(self):
                origin = self.headers.get("Origin", "")
                hostname = urlparse("http://" + self.headers.get("Host", "")).hostname
                return self.client_address[0] == "127.0.0.1" and hostname in {"localhost", "127.0.0.1"} and origin in ALLOWED | set(origins)
            def reply(self, data=b"", code=200, mime="application/json", public=False, extra=(), stream=None, size=None):
                self.send_response(code)
                self.send_header("Content-Type", mime)
                self.send_header("Content-Length", str(size if stream else len(data)))
                self.send_header("Access-Control-Allow-Origin", "*" if public else self.headers.get("Origin", ""))
                self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type,Range")
                self.send_header("Access-Control-Allow-Private-Network", "true")
                self.send_header("Referrer-Policy", "no-referrer")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.send_header("Cache-Control", "no-store")
                for key, value in extra: self.send_header(key, value)
                self.end_headers()
                try:
                    if stream:
                        remaining = size
                        while remaining:
                            chunk = stream.read(min(65536, remaining))
                            if not chunk: break
                            self.wfile.write(chunk)
                            remaining -= len(chunk)
                    else: self.wfile.write(data)
                except (BrokenPipeError, ConnectionResetError): pass
                finally:
                    if stream: stream.close()
            def do_OPTIONS(self):
                if self.admin() or self.path.startswith(("/media/", "/session/")): self.reply(code=204, public=not self.admin())
                else: self.reply(code=403)
            def do_GET(self):
                path = urlparse(self.path).path
                with lock: purge()
                if path == "/info":
                    if not self.admin(): self.reply(code=403); return
                    self.reply(json.dumps({"address": f"http://{address}:{port}", "lan": host == "0.0.0.0"}).encode()); return
                match = re.fullmatch(r"/(media|session)/([A-Za-z0-9_-]{32})", path)
                if match:
                    kind, token = match.groups()
                    with lock:
                        session = sessions.get(token)
                        if not session: self.reply(code=404, public=True); return
                        if kind == "session": self.reply(json.dumps(session).encode(), public=True); return
                        if not session["ready"]: self.reply(code=404, public=True); return
                        source = (cache / token).open("rb")
                        length = (cache / token).stat().st_size
                        mime = session["type"]
                    start, end, code = 0, length - 1, 200
                    requested = self.headers.get("Range")
                    if requested:
                        ranges = re.fullmatch(r"bytes=(\d*)-(\d*)", requested)
                        if not ranges or not any(ranges.groups()): source.close(); self.reply(code=416, public=True, extra=(("Content-Range", f"bytes */{length}"),)); return
                        first, last = ranges.groups()
                        start = int(first) if first else max(0, length - int(last))
                        end = min(length - 1, int(last)) if first and last else length - 1
                        if start > end or start >= length: source.close(); self.reply(code=416, public=True, extra=(("Content-Range", f"bytes */{length}"),)); return
                        code = 206
                    headers = [("Accept-Ranges", "bytes")]
                    if code == 206: headers.append(("Content-Range", f"bytes {start}-{end}/{length}"))
                    source.seek(start)
                    self.reply(code=code, mime=mime, public=True, extra=headers, stream=source, size=end-start+1); return
                if path == "/": path = "/receptor.html"
                candidate = (web / path.lstrip("/")).resolve()
                if candidate != web / "receptor.html" and candidate != web / "favicon.svg" and not (candidate.is_relative_to(web / "assets") and candidate.suffix in {".js", ".css", ".woff", ".woff2"}): self.reply(code=404); return
                if not candidate.is_file(): self.reply(code=404); return
                self.reply(candidate.read_bytes(), mime=mimetypes.guess_type(candidate.name)[0] or "application/octet-stream", public=True)
            def do_POST(self):
                if not self.admin(): self.reply(code=403); return
                try:
                    length = int(self.headers.get("Content-Length", "0"))
                    if not 0 < length <= LIMIT: self.reply(code=413); return
                    data = self.rfile.read(length)
                    if len(data) != length: self.reply(code=400); return
                    with lock:
                        purge()
                        if self.path == "/session":
                            if length > 1024 * 1024 or len(sessions) >= 8: self.reply(code=413); return
                            payload = json.loads(data)
                            display = presentation(payload["presentation"])
                            ttl = min(360, max(5, int(payload.get("minutes", 120))))
                            token = secrets.token_urlsafe(24)
                            session = {"presentation": display, "expires": time.time() + ttl * 60, "type": "audio/wav", "ready": False}
                            sessions[token] = session
                            (cache / token).write_bytes(b"")
                            self.reply(json.dumps({"token": token, "receiverURL": f"http://{address}:{port}/receptor.html#{token}", "mediaURL": f"http://{address}:{port}/media/{token}"}).encode()); return
                        control = re.fullmatch(r"/control/([A-Za-z0-9_-]{32})", self.path)
                        if control:
                            if length > 1024 or control[1] not in sessions: self.reply(code=404); return
                            command = json.loads(data)
                            if command.get("action") not in {"play", "pause", "seek"}: raise ValueError()
                            seconds = float(command.get("seconds", 0))
                            if not 0 <= seconds < 86400: raise ValueError()
                            commands = sessions[control[1]].get("commands", [])
                            previous = commands[-1]["sequence"] if commands else 0
                            sessions[control[1]]["commands"] = (commands + [{"action": command["action"], "seconds": seconds, "sequence": previous + 1}])[-32:]
                            self.reply(b'{}'); return
                        match = re.fullmatch(r"/media/([A-Za-z0-9_-]{32})", self.path)
                        if not match or match[1] not in sessions: self.reply(code=404); return
                        mime = self.headers.get("Content-Type", "").split(";")[0]
                        valid = (mime == "audio/wav" and data.startswith(b"RIFF") and data[8:12] == b"WAVE") or (mime in {"audio/mpeg", "audio/mp3"} and (data.startswith(b"ID3") or data[:1] == b"\xff")) or (mime == "audio/ogg" and data.startswith(b"OggS")) or (mime == "audio/flac" and data.startswith(b"fLaC")) or (mime == "audio/mp4" and data[4:8] == b"ftyp")
                        if not valid: self.reply(code=415); return
                        if sessions[match[1]]["ready"]: self.reply(code=409); return
                        (cache / match[1]).write_bytes(data)
                        sessions[match[1]]["type"] = mime
                        sessions[match[1]]["ready"] = True
                        self.reply(b'{}')
                except (ValueError, TypeError, KeyError, AttributeError, OverflowError): self.reply(code=400)
            def do_DELETE(self):
                if not self.admin(): self.reply(code=403); return
                match = re.fullmatch(r"/session/([A-Za-z0-9_-]{32})", self.path)
                if not match: self.reply(code=404); return
                with lock:
                    sessions.pop(match[1], None)
                    remove_file(match[1])
                self.reply(b'{}')
        server = ThreadingHTTPServer((host, port), Handler)
        server.timeout = .5
        print(f"Lector: emision local http://{address}:{port} (archivos temporales, cierre Ctrl+C)", flush=True)
        try: server.serve_forever()
        finally: server.server_close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--red", action="store_true")
    parser.add_argument("--direccion", default="")
    parser.add_argument("--puerto", type=int, default=5056)
    parser.add_argument("--web", default=str(Path(__file__).parent.parent / "dist"))
    parser.add_argument("--origen", action="append", default=[])
    args = parser.parse_args()
    address = args.direccion or (socket.gethostbyname(socket.gethostname()) if args.red else "127.0.0.1")
    run("0.0.0.0" if args.red else "127.0.0.1", address, args.puerto, args.web, args.origen)
