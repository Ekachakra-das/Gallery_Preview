#!/usr/bin/env python3
import json
import mimetypes
import os
import re
import hashlib
import socket
import subprocess
import sys
import threading
import shutil
import time

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

IMAGE_EXTS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".avif",
    ".heic",
}

SCRIPT_PATH = os.path.abspath(__file__)
RESOURCES_DIR = os.path.dirname(SCRIPT_PATH)
STATIC_DIR = os.path.join(RESOURCES_DIR, "static")
ICON_FILE = os.path.join(RESOURCES_DIR, "icon.svg")
INDEX_FILE = os.path.join(RESOURCES_DIR, "index.html")

# Create a temporary directory for thumbnails inside the script's directory
# This will be cleaned up on start and exit.
THUMBS_DIR = os.path.join(RESOURCES_DIR, ".thumbs_cache")


def cleanup_thumbs():
    if os.path.exists(THUMBS_DIR):
        try:
            shutil.rmtree(THUMBS_DIR)
        except Exception:
            pass


def ensure_thumbs_dir():
    if not os.path.exists(THUMBS_DIR):
        os.makedirs(THUMBS_DIR, exist_ok=True)


def get_thumb_path(source_path):
    # Hash the absolute path to create a unique but consistent filename
    h = hashlib.md5(source_path.encode("utf-8")).hexdigest()
    return os.path.join(THUMBS_DIR, f"{h}.jpg")


def create_thumbnail(source_path, thumb_path):
    # Use macOS 'sips' command for fast, high-quality resizing
    # Increased size to 800px and added high quality (v.good) compression
    try:
        subprocess.run([
            "sips", "--resampleHeightWidthMax", "800",
            "-s", "format", "jpeg",
            "-s", "formatOptions", "85",
            source_path, "--out", thumb_path
        ], capture_output=True, check=True)
        return True
    except Exception:
        return False


def resolve_base_dir():
    base_dir = os.environ.get("GALLERY_BASE_DIR", "").strip()
    if not base_dir:
        base_dir = os.path.dirname(SCRIPT_PATH)
    if "Gallery Preview.app" in SCRIPT_PATH and os.environ.get("GALLERY_BASE_DIR") is None:
        base_dir = os.path.abspath(os.path.join(base_dir, "../../.."))

    # Mac protection: if path starts with /private/var or similar (App Translocation)
    # we should check if the path is valid and accessible.
    # We resolve symlinks and ensure we have the absolute path.
    base_dir = os.path.realpath(base_dir)
    return base_dir


BASE_DIR = resolve_base_dir()
SETTINGS_FILE = os.path.join(RESOURCES_DIR, "settings.json")


def load_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_settings(settings):
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
        return True
    except Exception:
        return False


def safe_join(base_dir, rel_path):
    rel_path = str(rel_path).lstrip('/')
    candidate = os.path.abspath(os.path.join(base_dir, rel_path))
    if candidate == base_dir or candidate.startswith(base_dir + os.sep):
        return candidate
    return None


def list_folders(base_dir):
    folder_paths = set()
    has_images_by_path = {}
    scan_error = None

    def normalize_rel(path):
        if path in {"", "."}:
            return ""
        return path.replace(os.sep, "/")

    def ensure_folder(path):
        if not path:
            return
        if path not in has_images_by_path:
            has_images_by_path[path] = False
        folder_paths.add(path)

    def mark_ancestors(path):
        if not path:
            return
        parts = path.split("/")
        for i in range(1, len(parts) + 1):
            ancestor = "/".join(parts[:i])
            ensure_folder(ancestor)
            has_images_by_path[ancestor] = True

    try:
        # Include root directory explicitly
        folder_paths.add("")
        if "" not in has_images_by_path:
            has_images_by_path[""] = False

        for root, dirs, files in os.walk(base_dir, topdown=True, followlinks=False):
            dirs[:] = [
                d
                for d in dirs
                if not d.startswith(".") and d not in {"__pycache__", "Gallery Preview.app"}
            ]

            rel_root = normalize_rel(os.path.relpath(root, base_dir))
            ensure_folder(rel_root)

            for d in dirs:
                child_path = f"{rel_root}/{d}" if rel_root else d
                ensure_folder(child_path)

            has_image_here = any(
                not file.startswith(".") and os.path.splitext(file)[1].lower() in IMAGE_EXTS
                for file in files
            )
            if has_image_here:
                if rel_root == "":
                    has_images_by_path[""] = True
                else:
                    mark_ancestors(rel_root)
    except Exception as e:
        scan_error = str(e)

    folders = [
        {"path": path, "has_images": has_images_by_path.get(path, False)}
        for path in sorted(folder_paths, key=lambda p: p.casefold())
    ]
    return folders, scan_error


def list_images(abs_folder):
    images = []
    try:
        entries = sorted(os.scandir(abs_folder), key=lambda e: e.name.casefold())
        for entry in entries:
            if not entry.is_file(follow_symlinks=False):
                continue
            if os.path.splitext(entry.name)[1].lower() in IMAGE_EXTS:
                images.append(entry.name)
    except Exception:
        pass
    return images


def dbg(msg):
    print(f"[DEBUG] {msg}", flush=True)


class GalleryHandler(SimpleHTTPRequestHandler):
    last_request_time = time.time()

    def json_response(self, payload, status=200):
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def send_file(self, path, cache_control=None):
        if not os.path.isfile(path):
            self.send_error(404)
            return
        mime, _ = mimetypes.guess_type(path)
        with open(path, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-type", mime or "application/octet-stream")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-length", str(len(data)))
        if cache_control:
            self.send_header("Cache-Control", cache_control)
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        GalleryHandler.last_request_time = time.time()
        try:
            if self.path == "/api/folders":
                folders, scan_error = list_folders(BASE_DIR)
                self.json_response({"folders": folders, "error": scan_error})
                return

            if self.path == "/api/settings":
                self.json_response(load_settings())
                return

            if self.path.startswith("/api/images/"):
                folder = unquote(self.path.replace("/api/images/", "", 1))
                abs_folder = safe_join(BASE_DIR, folder)
                if not abs_folder or not os.path.isdir(abs_folder):
                    self.json_response({"images": [], "folder": folder})
                    return
                self.json_response({"images": list_images(abs_folder), "folder": folder})
                return

            if self.path.startswith("/api/file-info/"):
                rel_path = unquote(self.path.replace("/api/file-info/", "", 1))
                abs_path = safe_join(BASE_DIR, rel_path)
                if not abs_path or not os.path.isfile(abs_path):
                    self.json_response({"error": "File not found"})
                    return
                stat = os.stat(abs_path)
                self.json_response({
                    "size": stat.st_size,
                    "path": abs_path,
                    "name": os.path.basename(abs_path)
                })
                return

            if self.path == "/api/ping":
                self.json_response({"ok": True})
                return

            if self.path == "/api/quit":
                self.json_response({"ok": True})
                # Kill the process after a short delay
                import threading
                def delayed_quit():
                    import time
                    import os
                    time.sleep(0.5)
                    os.kill(os.getpid(), 9)
                threading.Thread(target=delayed_quit, daemon=True).start()
                return

            if self.path == "/":
                self.send_file(INDEX_FILE, cache_control="no-cache")
                return

            if self.path == "/favicon.ico" or self.path == "/icon.svg":
                self.send_file(ICON_FILE, cache_control="public, max-age=3600")
                return

            if self.path.startswith("/static/"):
                rel = unquote(self.path[len("/static/"):])
                static_path = safe_join(STATIC_DIR, rel)
                if not static_path:
                    self.send_error(404)
                    return
                self.send_file(static_path, cache_control="no-cache")
                return

            if self.path.startswith("/images/"):
                rel_image = unquote(self.path[len("/images/"):])
                abs_path = safe_join(BASE_DIR, rel_image)
                if not abs_path or not os.path.isfile(abs_path):
                    self.send_error(404)
                    return
                self.send_file(abs_path, cache_control="public, max-age=3600")
                return

            if self.path.startswith("/thumbs/"):
                rel_image = unquote(self.path[len("/thumbs/"):])
                abs_path = safe_join(BASE_DIR, rel_image)
                if not abs_path or not os.path.isfile(abs_path):
                    self.send_error(404)
                    return
                
                ensure_thumbs_dir()
                thumb_path = get_thumb_path(abs_path)
                
                # Check if we already created it this session
                if not os.path.exists(thumb_path):
                    if not create_thumbnail(abs_path, thumb_path):
                        # Fallback to full image if thumbnailing fails
                        self.send_file(abs_path, cache_control="public, max-age=3600")
                        return
                    
                self.send_file(thumb_path, cache_control="public, max-age=3600")
                return

            self.send_error(404)
        except Exception as e:
            dbg(f"ERROR do_GET: {e}")
            self.send_error(500)

    def do_POST(self):
        GalleryHandler.last_request_time = time.time()
        try:
            if self.path.startswith("/api/reveal/"):
                rel_path = unquote(self.path.replace("/api/reveal/", "", 1))
                abs_path = safe_join(BASE_DIR, rel_path)
                if not abs_path or not os.path.isfile(abs_path):
                    self.json_response({"success": False, "error": "File not found"})
                    return
                
                # Open in Finder using osascript
                import subprocess
                try:
                    subprocess.run([
                        "osascript", "-e",
                        f'tell application "Finder" to reveal POSIX file "{abs_path}"'
                    ], check=True)
                    subprocess.run([
                        "osascript", "-e",
                        'tell application "Finder" to activate'
                    ], check=True)
                    self.json_response({"success": True})
                except Exception as e:
                    self.json_response({"success": False, "error": str(e)})
                return

            if self.path.startswith("/api/copy-file/"):
                rel_path = unquote(self.path.replace("/api/copy-file/", "", 1))
                abs_path = safe_join(BASE_DIR, rel_path)
                if not abs_path or not os.path.isfile(abs_path):
                    self.json_response({"success": False, "error": "File not found"})
                    return
                
                # Copy file to clipboard using osascript
                import subprocess
                try:
                    # Use AppleScript to copy file to clipboard
                    subprocess.run([
                        "osascript", "-e",
                        f'set the clipboard to (POSIX file "{abs_path}")'
                    ], check=True)
                    self.json_response({"success": True})
                except Exception as e:
                    self.json_response({"success": False, "error": str(e)})
                return

            if self.path == "/api/settings":
                content_len = int(self.headers.get('Content-Length', 0))
                post_data = self.rfile.read(content_len)
                settings = json.loads(post_data.decode('utf-8'))
                success = save_settings(settings)
                self.json_response({"success": success})
                return

            self.send_error(404)
        except Exception as e:
            dbg(f"ERROR do_POST: {e}")
            self.send_error(500)

    def log_message(self, *args):
        pass


def find_port(start=7788):
    port = start
    while True:
        try:
            s = socket.socket()
            s.bind(("localhost", port))
            s.close()
            return port
        except Exception:
            port += 1


if __name__ == "__main__":
    cleanup_thumbs()
    ensure_thumbs_dir()
    
    port = find_port(7788)
    server = ThreadingHTTPServer(("localhost", port), GalleryHandler)
    print(f"Gallery Preview started on http://localhost:{port}", flush=True)

    def run_server():
        server.serve_forever()

    def shutdown():
        while True:
            time.sleep(5)
            if time.time() - GalleryHandler.last_request_time > 600:
                print("Idle timeout, shutting down...", flush=True)
                cleanup_thumbs()
                server.shutdown()
                break

    t1 = threading.Thread(target=run_server, daemon=False)
    t2 = threading.Thread(target=shutdown, daemon=True)
    t1.start()
    t2.start()
    t1.join()
