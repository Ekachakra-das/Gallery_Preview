import * as constants from "./constants.js";
import * as api from "./api.js";

export class GalleryMode {
  constructor(elements, lightbox, assignDeferredImageSrc) {
    this.els = elements;
    this.lightbox = lightbox;
    this.assignDeferredImageSrc = assignDeferredImageSrc;
    this.batchObserver = null;
    this.renderToken = 0;
    this.buttonByPath = new Map();

    this.init();
  }

  init() {
    if (this.els.sidebarTriggerEl) {
      this.els.sidebarTriggerEl.addEventListener("mouseenter", () => {
        if (!this.els.galleryEl.hidden) this.showSidebar();
      });
    }
    if (this.els.sidebarEl) {
      this.els.sidebarEl.addEventListener("mouseleave", () => this.hideSidebar());
    }
  }

  toggle(currentFolder, imageCache, syncTreeFn) {
    if (!this.els.galleryEl) return;
    if (this.els.galleryEl.hidden) {
      if (imageCache.has(currentFolder)) {
        this.lightbox.setData(currentFolder, imageCache.get(currentFolder));
        this.els.galleryEl.hidden = false;
        this.render();
        if (syncTreeFn) syncTreeFn();
      }
    } else {
      this.close();
    }
  }

  render() {
    if (!this.lightbox.images || !this.lightbox.images.length || !this.els.contentEl) return;
    this.cleanupObserver();
    this.renderToken += 1;
    const token = this.renderToken;
    this.els.contentEl.innerHTML = "";
    
    // Move everything from main sidebar to gallery sidebar
    if (this.els.sidebar && this.els.sidebarEl) {
      while (this.els.sidebar.firstChild) {
        this.els.sidebarEl.appendChild(this.els.sidebar.firstChild);
      }
    }

    let i = 0;
    const hideFilenames = localStorage.getItem(constants.HIDE_FILENAMES_KEY) === "1";

    const appendBatch = () => {
      if (token !== this.renderToken || this.els.galleryEl.hidden) return false;
      if (i >= this.lightbox.images.length) return false;
      const frag = document.createDocumentFragment();
      const upper = Math.min(i + constants.FULLSCREEN_BATCH_SIZE, this.lightbox.images.length);
      for (; i < upper; i++) {
        const index = i;
        const filename = this.lightbox.images[i];
        const card = document.createElement("article");
        card.className = "card";
        const img = document.createElement("img");
        img.alt = filename;
        img.loading = "lazy";
        img.decoding = "async";
        const folderPrefix = this.lightbox.folder ? encodeURIComponent(this.lightbox.folder) + "/" : "";
        const src = "/thumbs/" + folderPrefix + encodeURIComponent(filename);
        this.assignDeferredImageSrc(img, src);
        img.addEventListener("click", () => this.lightbox.showAt(index));
        const caption = document.createElement("div");
        caption.className = "caption";
        caption.textContent = filename;
        if (hideFilenames) caption.style.display = "none";
        card.appendChild(img);
        card.appendChild(caption);
        frag.appendChild(card);
      }
      this.els.contentEl.appendChild(frag);
      return i < this.lightbox.images.length;
    };

    for (let batch = 0; batch < constants.INITIAL_FULLSCREEN_BATCHES; batch++) {
      if (!appendBatch()) break;
    }

    if (i < this.lightbox.images.length && !this.els.galleryEl.hidden) {
      const sentinel = document.createElement("div");
      sentinel.className = "fullscreen-gallery-sentinel";
      this.els.contentEl.appendChild(sentinel);

      if ("IntersectionObserver" in window) {
        this.batchObserver = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
            this.els.contentEl.appendChild(sentinel);
            if (!appendBatch()) {
              this.cleanupObserver();
              sentinel.remove();
            }
          }
        }, { root: this.els.galleryEl, rootMargin: "2000px 0px" });
        this.batchObserver.observe(sentinel);
      } else {
        while (appendBatch());
        sentinel.remove();
      }
    }
  }

  showSidebar() {
    this.els.sidebarEl.classList.add("visible");
    this.els.galleryEl.classList.add("sidebar-visible");
  }

  hideSidebar() {
    this.els.sidebarEl.classList.remove("visible");
    this.els.galleryEl.classList.remove("sidebar-visible");
  }

  cleanupObserver() {
    if (this.batchObserver) {
      this.batchObserver.disconnect();
      this.batchObserver = null;
    }
  }

  close() {
    this.cleanupObserver();
    this.renderToken += 1;
    this.els.galleryEl.hidden = true;
    if (this.els.contentEl) this.els.contentEl.innerHTML = "";
    
    // Move everything back to the main sidebar
    if (this.els.sidebarEl && this.els.sidebar) {
      while (this.els.sidebarEl.firstChild) {
        this.els.sidebar.appendChild(this.els.sidebarEl.firstChild);
      }
    }

    this.hideSidebar();
  }

  async loadFolder(folder, setActiveFn) {
    if (setActiveFn) setActiveFn(folder);
    try {
      const data = await api.fetchImages(folder);
      const images = data.images || [];
      this.lightbox.setData(folder, images);
      this.render();
      return images;
    } catch (e) {
      console.error("Gallery mode load error:", e);
      return [];
    }
  }
}
