#!/usr/bin/env python3

import os
import re
import signal
import subprocess
import sys
import time
import threading

script_dir = os.path.dirname(os.path.abspath(__file__))
preview_path = os.path.join(script_dir, "preview.py")
default_gallery_dir = os.path.abspath(os.path.join(script_dir, "../../.."))

if not os.path.exists(preview_path):
    sys.exit(1)


def choose_gallery_folder(default_dir):
    escaped = default_dir.replace("\\", "\\\\").replace('"', '\\"')
    script = (
        f'set defaultFolder to POSIX file "{escaped}"\n'
        'set selectedFolder to choose folder with prompt "Select folder for Gallery Preview" default location defaultFolder\n'
        "POSIX path of selectedFolder"
    )
    result = subprocess.run(
        ["osascript", "-e", script], capture_output=True, text=True
    )
    if result.returncode != 0:
        return None
    return result.stdout.strip() or default_dir


def stop_existing_servers():
    # Find PIDs of any process running our preview script
    result = subprocess.run(
        ["pgrep", "-f", preview_path], capture_output=True, text=True
    )
    if result.returncode != 0:
        return
    
    current_pid = os.getpid()
    for pid_s in result.stdout.split():
        try:
            pid = int(pid_s)
            if pid != current_pid:
                # First try SIGTERM (polite)
                os.kill(pid, signal.SIGTERM)
        except Exception:
            pass
    
    time.sleep(0.3)
    
    # Double check and force kill (SIGKILL) if still alive
    result = subprocess.run(
        ["pgrep", "-f", preview_path], capture_output=True, text=True
    )
    if result.returncode == 0:
        for pid_s in result.stdout.split():
            try:
                pid = int(pid_s)
                if pid != current_pid:
                    os.kill(pid, signal.SIGKILL)
            except Exception:
                pass
    time.sleep(0.2)


def parse_url_from_output(line):
    m = re.search(r"http://localhost:\d+", line)
    return m.group(0) if m else None


def start_server(selected_dir):
    env = os.environ.copy()
    env["GALLERY_BASE_DIR"] = selected_dir
    proc = subprocess.Popen(
        [sys.executable, preview_path],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        start_new_session=True,
    )
    url = None
    deadline = time.time() + 5
    while time.time() < deadline:
        line = proc.stdout.readline()
        if not line:
            break
        url = parse_url_from_output(line)
        if url:
            return url, proc
    return "http://localhost:7788", proc


# Skip folder selection dialog and use default directory directly
# If app is in a restricted folder, use home directory instead
try:
    # Test if we can access the default directory
    os.listdir(default_gallery_dir)
    selected_dir = default_gallery_dir
except (PermissionError, OSError):
    # If no access, ask user to select folder (show current directory)
    selected_dir = choose_gallery_folder(default_gallery_dir)
    if not selected_dir:
        sys.exit(0)

stop_existing_servers()
url, server_proc = start_server(selected_dir)

try:
    import webview
    print("webview imported successfully")
    
    # Create API class for JavaScript bridge
    class Api:
        def quit_app(self):
            import sys
            sys.exit(0)
    
    api = Api()
    
    # Create window with webview
    window = webview.create_window(
        "Gallery Preview",
        url,
        fullscreen=True,
        background_color="#0f1115",
        js_api=api
    )
    print("window created")
    
    # Start webview (blocking call)
    webview.start(debug=False)
    print("webview started")
    
    # When window closes, terminate server
    if server_proc:
        server_proc.terminate()
        try:
            server_proc.wait(timeout=3)
        except:
            server_proc.kill()
            
except (ImportError, Exception) as e:
    # Fallback to browser if pywebview not available or fails
    import traceback
    with open("/tmp/gallery_preview_error.log", "w") as f:
        f.write(f"Webview error: {e}\n")
        f.write(traceback.format_exc())
    subprocess.run(
        ["osascript", "-e", f'open location "{url}"'],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
