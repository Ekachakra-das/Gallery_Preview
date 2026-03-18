import * as constants from "./constants.js";
import * as api from "./api.js";
import { Lightbox } from "./lightbox.js";
import { GalleryMode } from "./gallery-mode.js";
import { FolderTree } from "./folders.js";

const imageCache = new Map();
let currentFolder = "";
let currentImages = [];
let deferredImages = new Set();
let columnWidth = constants.DEFAULT_SIZE;

const elements = {
  grid: document.getElementById("content"),
  status: document.querySelector(".content .status"), // More specific selector to find the status div inside content
  sidebar: document.querySelector(".sidebar"),
  folderTree: document.getElementById("folderTree"),
  currentFolderTitle: document.getElementById("folderTitle"),
  sizeSlider: document.getElementById("imageSizeSlider"),
  refreshBtn: document.getElementById("sidebarToggle"),
  settingsBtn: document.getElementById("settingsToggle"),
  settingsMenu: document.getElementById("settingsMenu"),
  hideFilenamesCheckbox: document.getElementById("hideFilenames"),
  toggleFullscreenBtn: document.getElementById("galleryModeBtn"),
  galleryEl: document.getElementById("fullscreenGallery"),
  contentEl: document.getElementById("fullscreenGalleryContent"),
  sidebarEl: document.getElementById("fullscreenGallerySidebar"),
  sidebarTriggerEl: document.getElementById("fullscreenGallerySidebarTrigger")
};

const lightbox = new Lightbox({
  lightboxEl: document.getElementById("lightbox"), 
  lightboxImageEl: document.getElementById("lightboxImage"),
  closeBtnEl: document.getElementById("closeBtn"),
  prevBtnEl: document.getElementById("prevBtn"),
  nextBtnEl: document.getElementById("nextBtn"),
  lightboxInfoNameEl: document.getElementById("lightboxInfoName"),
  lightboxInfoPathEl: document.getElementById("lightboxInfoPath"),
  lightboxInfoSizeEl: document.getElementById("lightboxInfoSize"),
  lightboxInfoEl: document.getElementById("lightboxInfo"),
  lightboxInfoRevealEl: document.getElementById("lightboxInfoReveal"),
  lightboxInfoCopyEl: document.getElementById("lightboxInfoCopy")
});

const gallery = new GalleryMode(elements, lightbox, (img, src) => { img.src = src; });
const folderTree = new FolderTree(elements.folderTree, elements.currentFolderTitle, {
  onFolderSelect: loadImages,
  onActiveChange: (path) => currentFolder = path
});

async function loadFolders() {
  if (elements.status) elements.status.textContent = "Loading folders...";
  try {
    const data = await api.fetchFolders();
    const all = Array.isArray(data.folders) ? data.folders : [];
    
    if (all.length === 0) {
      // Empty case management (translated to Russian)
      if (elements.status) {
        elements.status.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📁</div>
            <h2>Папки и изображения не найдены</h2>
            <p>Доступ к папке ограничен системой macOS или папка пуста.</p>
            <div class="empty-instruction">
              <button id="manualPickBtn" class="primary-btn">Выбрать папку вручную</button>
              <p class="debug-path">Текущая папка: <code>${data.base_dir || 'не определена'}</code></p>
            </div>
          </div>
        `;
        const pickBtn = document.getElementById("manualPickBtn");
        if (pickBtn) {
          pickBtn.onclick = async () => {
            const res = await api.pickFolder();
            if (res.ok) {
              window.location.reload();
            }
          };
        }
      }
      folderTree.clear();
      return;
    }

    const root = { children: {}, fullPath: "" };
    for (const f of all) {
      const parts = f.path.split("/").filter(Boolean);
      let curr = root;
      let pathAcc = "";
      
      // If root itself has images, it will be handled by f.path === ""
      if (f.path === "") {
        curr.isEmpty = f.has_images === false;
        curr.hasImages = f.has_images === true;
      }

      for (const p of parts) {
        pathAcc = pathAcc ? `${pathAcc}/${p}` : p;
        if (!curr.children[p]) {
          curr.children[p] = { 
            children: {}, 
            fullPath: pathAcc,
            isEmpty: f.count === 0
          };
        }
        curr = curr.children[p];
      }
    }
    folderTree.clear();
    
    // Explicitly add a "Main Folder" link for functional access, but hide it via CSS
    const rootInfo = all.find(f => f.path === "");
    if (rootInfo && rootInfo.has_images) {
      const li = document.createElement("li");
      li.style.display = "none"; // HIDE VIA CSS
      const btn = document.createElement("button");
      btn.innerHTML = `Main`;
      btn.onclick = (e) => {
        e.stopPropagation();
        folderTree.setActive("");
        loadImages("");
      };
      folderTree.buttonByPath.set("", btn);
      li.appendChild(btn);
      elements.folderTree.prepend(li);
    }
    
    folderTree.renderTree(root.children, elements.folderTree);

    // Show "No Folders" if only root images exist but no subfolders
    if (Object.keys(root.children).length === 0) {
      const li = document.createElement("li");
      li.style.padding = "10px";
      li.style.opacity = "0.5";
      li.style.fontSize = "0.9em";
      li.textContent = "No Folders";
      elements.folderTree.appendChild(li);
    }

    // Priority for initial selection:
    const rootHasImages = rootInfo && rootInfo.has_images;
    const hasAnyImages = all.some(f => f.has_images);

    const saved = localStorage.getItem(constants.LAST_FOLDER_KEY);
    const hasSaved = saved && all.find(f => f.path === saved && f.has_images);

    let initialFolder = null;
    if (hasSaved) {
      initialFolder = saved;
    } else if (rootHasImages) {
      initialFolder = "";
    } else {
      // Find FIRST folder that has images
      const firstWithImages = all.find(f => f.has_images && f.path !== "");
      if (firstWithImages) {
        initialFolder = firstWithImages.path;
      }
    }

    if (initialFolder !== null) {
      currentFolder = initialFolder;
      loadImages(initialFolder);
    } else {
      // Show instruction if NO images found anywhere
      if (elements.status) elements.status.textContent = "No images found";
      if (elements.grid) {
        elements.grid.innerHTML = `
          <div style="padding: 3rem 2rem; text-align: center; color: var(--text, #fff); font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="margin-bottom: 1rem;">No images found</h2>
            <p style="line-height: 1.6; opacity: 0.8;">To start viewing, please copy <b>Gallery Preview.app</b> into a folder that contains images, or into a folder with subfolders containing images.</p>
          </div>
        `;
      }
    }

    setTimeout(() => {
      // Automatic Gallery Mode redirection if saved
      if (localStorage.getItem(constants.AUTO_GALLERY_KEY) === "1" && elements.galleryEl.hidden) {
        gallery.toggle(currentFolder, imageCache);
      }
    }, 50);
  } catch (e) {
    if (elements.status) elements.status.textContent = "Error loading folders";
  }
}

async function loadImages(folder) {
  if (folder === undefined || folder === null) return;
  currentFolder = folder;
  localStorage.setItem(constants.LAST_FOLDER_KEY, folder);
  folderTree.setActive(folder); 
  const displayFolderName = folder === "" ? "Main Folder" : folder;
  if (elements.status) elements.status.textContent = `Loading ${displayFolderName}...`;
  try {
    const data = await api.fetchImages(folder);
    currentImages = data.images || [];
    imageCache.set(folder, currentImages);
    lightbox.setData(folder, currentImages);
    if (elements.galleryEl && !elements.galleryEl.hidden) gallery.render();
    renderImages();
    if (elements.status) elements.status.textContent = `${currentImages.length} images in ${displayFolderName}`;
  } catch (e) {
    if (elements.status) elements.status.textContent = "Error loading images";
  }
}

function getColumnWidth(size) {
  const s = parseInt(size, 10);
  // Assuming 1-5 scale based on HTML <input type="range" min="1" max="5" />
  const widths = [150, 200, 300, 400, 600];
  return widths[s - 1] || 300;
}

function renderImages() {
  if (!elements.grid) return;
  elements.grid.innerHTML = "";
  const hideFilenames = elements.hideFilenamesCheckbox ? elements.hideFilenamesCheckbox.checked : false;
  
  const masonry = document.createElement("div");
  masonry.className = "masonry";
  masonry.style.setProperty("--column-width", columnWidth + "px");

  const frag = document.createDocumentFragment();
  currentImages.forEach((filename, index) => {
    const card = document.createElement("article");
    card.className = "card";
    
    // Pinterest style cards usually need just an img and maybe a caption
    const img = document.createElement("img");
    img.alt = filename;
    img.loading = "lazy";
    const folderPrefix = currentFolder ? encodeURIComponent(currentFolder) + "/" : "";
    img.src = "/thumbs/" + folderPrefix + encodeURIComponent(filename);
    img.onclick = () => lightbox.showAt(index);
    card.appendChild(img);
    
    if (!hideFilenames) {
      const caption = document.createElement("div");
      caption.className = "caption";
      caption.textContent = filename;
      card.appendChild(caption);
    }
    frag.appendChild(card);
  });
  masonry.appendChild(frag);
  elements.grid.appendChild(masonry);
}

// Events
if (elements.sizeSlider) {
  const savedSize = localStorage.getItem(constants.IMAGE_SIZE_KEY);
  if (savedSize) {
    elements.sizeSlider.value = savedSize;
    columnWidth = getColumnWidth(savedSize);
  } else {
    columnWidth = getColumnWidth(elements.sizeSlider.value);
  }
  
  elements.sizeSlider.oninput = (e) => {
    columnWidth = getColumnWidth(e.target.value);
    localStorage.setItem(constants.IMAGE_SIZE_KEY, e.target.value);
    renderImages();
  };
}

if (elements.refreshBtn) elements.refreshBtn.onclick = () => currentFolder && loadImages(currentFolder);

const sidebarToggle = document.getElementById("sidebarToggle");
if (sidebarToggle) {
  sidebarToggle.onclick = (e) => {
    const isMain = !!document.querySelector(".app .sidebar #sidebarToggle");
    const container = isMain ? document.querySelector(".app") : document.getElementById("fullscreenGallery");
    
    container.classList.toggle("sidebar-collapsed");
    const isCollapsed = container.classList.contains("sidebar-collapsed");
    localStorage.setItem(constants.SIDEBAR_KEY, isCollapsed ? "1" : "0");
    
    document.querySelectorAll("#sidebarToggle").forEach(btn => {
      btn.textContent = isCollapsed ? "›" : "‹";
    });
  };
  // Restore state
  if (localStorage.getItem(constants.SIDEBAR_KEY) === "1") {
    document.querySelector(".app").classList.add("sidebar-collapsed");
    document.getElementById("fullscreenGallery")?.classList.add("sidebar-collapsed");
    sidebarToggle.textContent = "›";
  }
}

if (elements.settingsBtn) elements.settingsBtn.onclick = (e) => {
  e.stopPropagation();
  if (elements.settingsMenu) elements.settingsMenu.hidden = !elements.settingsMenu.hidden;
};

// Close settings when clicking outside
document.addEventListener("click", (e) => {
  if (elements.settingsMenu && !elements.settingsMenu.hidden) {
    if (!elements.settingsMenu.contains(e.target) && e.target !== elements.settingsBtn) {
      elements.settingsMenu.hidden = true;
    }
  }
});

// Settings management with backup to server
async function syncSettings() {
  const getVal = (key) => {
    const val = localStorage.getItem(key);
    return (val === null || val === undefined) ? "" : val;
  };

  const settings = {
    [constants.THEME_KEY]: getVal(constants.THEME_KEY),
    [constants.HIDE_FILENAMES_KEY]: getVal(constants.HIDE_FILENAMES_KEY),
    [constants.HIDE_EMPTY_FOLDERS_KEY]: getVal(constants.HIDE_EMPTY_FOLDERS_KEY),
    [constants.AUTO_GALLERY_KEY]: getVal(constants.AUTO_GALLERY_KEY),
    [constants.IMAGE_SIZE_KEY]: getVal(constants.IMAGE_SIZE_KEY),
    [constants.SIDEBAR_KEY]: getVal(constants.SIDEBAR_KEY)
  };
  try {
    await api.saveSettings(settings);
  } catch (e) {
    console.warn("Failed to save settings to server");
  }
}

async function loadSettingsFromServer() {
  try {
    const response = await fetch("/api/settings", { cache: "no-store" });
    const settings = await response.json();
    if (settings && Object.keys(settings).length > 0) {
      for (const [key, value] of Object.entries(settings)) {
        if (value !== null && value !== undefined && value !== "") {
          localStorage.setItem(key, value);
        }
      }
      return true;
    }
  } catch (e) {
    console.warn("Failed to load settings from server", e);
  }
  return false;
}

if (elements.hideFilenamesCheckbox) {
  elements.hideFilenamesCheckbox.onchange = (e) => {
    localStorage.setItem(constants.HIDE_FILENAMES_KEY, e.target.checked ? "1" : "0");
    syncSettings();
    renderImages();
  };
}

// Theme management
function setTheme(mode) {
  localStorage.setItem(constants.THEME_KEY, mode);
  syncSettings();
  const isDark = mode === "dark" || (mode === "auto" && constants.mediaQuery.matches);
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  
  // Highlight active button
  document.querySelectorAll("[data-theme-mode]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.themeMode === mode);
  });
}

// Initial theme setup (will be updated after server load)
const savedTheme = localStorage.getItem(constants.THEME_KEY) || "auto";
// Preliminary theme set to reduce flicker, but without syncSettings
const isDarkInit = savedTheme === "dark" || (savedTheme === "auto" && constants.mediaQuery.matches);
document.documentElement.setAttribute("data-theme", isDarkInit ? "dark" : "light");

// Restore all settings state
function restoreSettings() {
  if (elements.hideFilenamesCheckbox) {
    elements.hideFilenamesCheckbox.checked = localStorage.getItem(constants.HIDE_FILENAMES_KEY) === "1";
  }
  
  const hideEmptyCheckbox = document.getElementById("hideEmptyFolders");
  if (hideEmptyCheckbox) {
    hideEmptyCheckbox.checked = localStorage.getItem(constants.HIDE_EMPTY_FOLDERS_KEY) === "1";
  }

  const autoGalleryCheckbox = document.getElementById("autoGalleryMode");
  if (autoGalleryCheckbox) {
    autoGalleryCheckbox.checked = localStorage.getItem(constants.AUTO_GALLERY_KEY) === "1";
  }
}

// Full initialization
async function init() {
  await loadSettingsFromServer();
  setTheme(localStorage.getItem(constants.THEME_KEY) || "auto");
  restoreSettings();
  
  const savedSize = localStorage.getItem(constants.IMAGE_SIZE_KEY);
  if (savedSize && elements.sizeSlider) {
    elements.sizeSlider.value = savedSize;
    columnWidth = getColumnWidth(savedSize);
  }
  
  loadFolders();
}

init();

// Handle theme button clicks
document.addEventListener("click", (e) => {
  const themeBtn = e.target.closest("[data-theme-mode]");
  if (themeBtn) {
    setTheme(themeBtn.dataset.themeMode);
  }
});

// React to system theme changes if set to auto
constants.mediaQuery.addEventListener("change", () => {
  if (localStorage.getItem(constants.THEME_KEY) === "auto") {
    setTheme("auto");
  }
});

const hideEmptyCheckbox = document.getElementById("hideEmptyFolders");
if (hideEmptyCheckbox) {
  hideEmptyCheckbox.onchange = (e) => {
    localStorage.setItem(constants.HIDE_EMPTY_FOLDERS_KEY, e.target.checked ? "1" : "0");
    syncSettings();
    loadFolders(); // Перезагружаем дерево
  };
}

const autoGalleryCheckbox = document.getElementById("autoGalleryMode");
if (autoGalleryCheckbox) {
  autoGalleryCheckbox.onchange = (e) => {
    localStorage.setItem(constants.AUTO_GALLERY_KEY, e.target.checked ? "1" : "0");
    syncSettings();
  };
}

if (elements.sizeSlider) {
  elements.sizeSlider.oninput = (e) => {
    columnWidth = getColumnWidth(e.target.value);
    localStorage.setItem(constants.IMAGE_SIZE_KEY, e.target.value);
    syncSettings();
    renderImages();
  };
}

if (elements.toggleFullscreenBtn) elements.toggleFullscreenBtn.onclick = () => gallery.toggle(currentFolder, imageCache);

// Delegate sidebar toggle clicks if the sidebar is in the gallery
document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "sidebarToggle") {
    // Check if the clicked button is INSIDE the gallery sidebar
    if (elements.sidebarEl.contains(e.target)) {
      document.getElementById("fullscreenGallery").classList.toggle("sidebar-collapsed");
      const isCollapsed = document.getElementById("fullscreenGallery").classList.contains("sidebar-collapsed");
      localStorage.setItem(constants.SIDEBAR_KEY, isCollapsed ? "1" : "0");
      syncSettings();
      document.querySelectorAll("#sidebarToggle").forEach(btn => {
        btn.textContent = isCollapsed ? "›" : "‹";
      });
    }
  }
});

window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  const key = e.key.toLowerCase();
  if (key === "g") gallery.toggle(currentFolder, imageCache);
  if (key === "escape") {
    e.preventDefault(); // Системный запрет на выход из Fullscreen для любой страницы
    if (lightbox.els.lightboxEl && lightbox.els.lightboxEl.classList.contains("active")) {
      lightbox.close();
    } else if (elements.galleryEl && !elements.galleryEl.hidden) {
      gallery.close();
    }
  }
  if (key === "arrowleft" || key === "a") lightbox.prev();
  if (key === "arrowright" || key === "d") lightbox.next();
});

const savedHide = localStorage.getItem(constants.HIDE_FILENAMES_KEY);
if (elements.hideFilenamesCheckbox) {
  elements.hideFilenamesCheckbox.checked = savedHide === "1";
}

// Ensure init is called
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}