# Gallery Preview

A high-performance, lightweight image gallery application for macOS. It provides a modern "Pinterest-style" masonry interface for browsing local image collections with blazing-fast preview generation.

## ✨ Key Features

<p align="center">
  <a href="https://github.com/user-attachments/assets/771f4fff-1420-4979-b816-2c30cbe0e302">
    <img src="https://github.com/user-attachments/assets/771f4fff-1420-4979-b816-2c30cbe0e302" width="32%" />
  </a>
  <a href="https://github.com/user-attachments/assets/3fd0fa6a-de28-4195-960e-b726ea303a79">
    <img src="https://github.com/user-attachments/assets/3fd0fa6a-de28-4195-960e-b726ea303a79" width="32%" />
  </a>
  <a href="https://github.com/user-attachments/assets/4d32414e-2d94-4eaf-a06a-4942224f100d">
    <img src="https://github.com/user-attachments/assets/4d32414e-2d94-4eaf-a06a-4942224f100d" width="32%" />
  </a>
</p>

- 🏗️ **Masonry Grid**: Beautifully organized image layout that adapts to your window size.
- ⚡ **Turbo Thumbnails**: Uses native macOS `sips` (Scriptable Image Processing System) for nearly instantaneous thumbnail generation.
- 📁 **Smart Navigation**: Tree-view sidebar for folders with instant search and filtering.
- 🔍 **Pro Lightbox**: Full-screen preview mode with EXIF metadata display, smooth navigation, and "Copy to Clipboard" support.
- 🌓 **Dynamic Themes**: Built-in dark and light modes with system-matching capabilities.
- 🛠️ **Deep macOS Integration**: Designed as a `.app` bundle with support for native file operations and performance optimizations.

## 🚀 Getting Started

Choose the version that fits you best:

### 🌟 Option A: Standalone (Recommended)
**No setup required, works instantly.**
1. Download the full `.app` folder (includes the `vendor` directory).
2. Double-click to run. All dependencies are already inside (~12MB).

### ⚡ Option B: Lite (Source Only)
**Tiny download, but requires manual install.**
1. Download the source files (without the `vendor` folder).
2. Install the core dependency via terminal:
   ```bash
   pip3 install pywebview
   ```
3. Open the `.app` as usual (~500KB).

### Prerequisites

- **macOS** 12.0 or newer.
- **Python 3.9+** (pre-installed on most modern macOS systems).

## 🎹 Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `G` | Toggle Full Gallery Mode |
| `Space` / `Enter` | Open image in Lightbox |
| `←` / `→` | Navigate images in Lightbox |
| `Esc` | Close Lightbox |
| `Cmd + C` | Copy current file to clipboard |
| `F` | Toggle Fullscreen (in Lightbox) |
| `Cmd + Q` | Quit Application |

## 🏗️ Technical Architecture

This project uses a **Hybrid Desktop Architecture**:

- **Backend**: A custom Multi-threaded Python HTTP Server (`preview.py`) handling file-system indexing and API requests.
- **Thumbnailing**: Utilizes the macOS `sips` command-line tool, offloading heavy image processing to native system binaries for maximum speed and lower RAM usage.
- **Frontend**: A modern ES6+ JavaScript SPA (Single Page Application) using CSS Grid/Flexbox and the Intersection Observer API for lazy-loading.
- **UI Bridge**: Integrated via `pywebview` to provide a native window experience while leveraging web technologies for the interface.

## 📂 Project Structure

```text
Gallery Preview.app/
└── Contents/
    ├── MacOS/
    │   └── launcher         # Entry point script
    └── Resources/
        ├── launcher.py      # pywebview window management
        ├── preview.py       # Python API & Image Server
        ├── index.html       # UI Entry point
        └── static/
            ├── app.js       # Main application logic
            ├── api.js       # Backend communication
            └── gallery-mode.js # Masonry layout engine
```

## 📜 License

Distributed under the MIT License.
