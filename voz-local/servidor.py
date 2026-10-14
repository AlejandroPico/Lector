"""Optional local-only Piper adapter. This file is GPL-3.0-or-later.
Piper: https://github.com/OHF-Voice/piper1-gpl (GPL-3.0-or-later).
Voice models have their own licenses; retain each MODEL_CARD.
"""
import argparse
import io
import json
import threading
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from piper import PiperVoice, SynthesisConfig

ALLOWED = {"https://alejandropico.github.io", "http://127.0.0.1:5177", "http://localhost:5177"}

def serve(directory, port=5055, origins=()):
    directory = Path(directory).resolve()
    allowed = ALLOWED | set(origins)
    voices, lock = {}, threading.Lock()
    def catalog():
        return {path.name[:-10]: json.loads(path.read_text(encoding="utf-8"))
                for path in directory.glob("*.onnx.json") if path.with_suffix("").is_file()}
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass  # Never log book passages.
        def authorized(self):
            origin = self.headers.get("Origin", "")
            host = urlparse("http://" + self.headers.get("Host", "")).hostname
            if origin not in allowed or host not in {"localhost", "127.0.0.1"}:
                self.send_error(403)
                return False
            return True
        def reply(self, data=b"", status=200, mime="application/json"):
            self.send_response(status)
            self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", ""))
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
        def do_OPTIONS(self):
            if self.authorized(): self.reply(status=204)
        def do_GET(self):
            if not self.authorized(): return
            if self.path != "/voices": self.reply(b'{}', 404); return
            self.reply(json.dumps(catalog()).encode())
        def do_POST(self):
            if not self.authorized(): return
            if self.path != "/synthesize": self.reply(b'{}', 404); return
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 < size <= 32768: raise ValueError("size")
                data = json.loads(self.rfile.read(size))
                text = data["text"]
                if not isinstance(text, str) or not text.strip() or len(text) > 4096: raise ValueError("text")
                name = data.get("voice")
                configs = catalog()
                if name not in configs: raise ValueError("voice")
                speaker = int(data.get("speaker_id", 0))
                if not 0 <= speaker < configs[name].get("num_speakers", 1): raise ValueError("speaker")
                noise = float(data.get("noise_scale", .667))
                width = float(data.get("noise_w_scale", .8))
                length = float(data.get("length_scale", 1))
                if not 0 <= noise <= 2 or not 0 <= width <= 2 or not .5 <= length <= 2: raise ValueError("config")
                with lock:
                    if name not in voices:
                        if len(voices) >= 2: voices.pop(next(iter(voices)))
                        voices[name] = PiperVoice.load(directory / (name + ".onnx"))
                    audio = io.BytesIO()
                    with wave.open(audio, "wb") as wav:
                        voices[name].synthesize_wav(text, wav, SynthesisConfig(speaker_id=speaker, noise_scale=noise, noise_w_scale=width, length_scale=length))
                self.reply(audio.getvalue(), mime="audio/wav")
            except (ValueError, KeyError, TypeError, json.JSONDecodeError): self.reply(b'{"error":"Invalid request or voice"}', 400)
            except Exception: self.reply(b'{"error":"Local synthesis failed"}', 500)
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Lector: voz local en http://127.0.0.1:{port}", flush=True)
    server.serve_forever()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--modelos", default=str(Path(__file__).parent / "modelos"))
    parser.add_argument("--puerto", type=int, default=5055)
    parser.add_argument("--origen", action="append", default=[])
    args = parser.parse_args()
    serve(args.modelos, args.puerto, args.origen)
