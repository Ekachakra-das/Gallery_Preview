import * as constants from "./constants.js";
import * as api from "./api.js";

export class Lightbox {
  constructor(elements) {
    this.els = elements;
    this.images = [];
    this.folder = "";
    this.index = -1;
    this.mouseTimeout = null;

    this.init();
  }

  init() {
    if (this.els.lightboxEl) {
      this.els.lightboxEl.addEventListener("click", (e) => {
        if (e.target === this.els.lightboxEl || e.target === this.els.closeBtnEl) this.close();
      });

      this.els.lightboxEl.addEventListener("mousemove", (e) => this.handleMouseMove(e));
    }

    if (this.els.prevBtnEl) this.els.prevBtnEl.addEventListener("click", (e) => { e.stopPropagation(); this.prev(); });
    if (this.els.nextBtnEl) this.els.nextBtnEl.addEventListener("click", (e) => { e.stopPropagation(); this.next(); });
    
    if (this.els.lightboxInfoRevealEl) {
      this.els.lightboxInfoRevealEl.addEventListener("click", async (e) => {
        e.stopPropagation();
        const filename = this.images[this.index];
        try { await api.revealInFinder(this.folder, filename); } catch (err) { console.error(err); }
      });
    }

    if (this.els.lightboxInfoCopyEl) {
      this.els.lightboxInfoCopyEl.addEventListener("click", async (e) => {
        e.stopPropagation();
        await this.copyCurrentImageToClipboard();
      });
    }
  }

  setData(folder, images) {
    this.folder = folder;
    this.images = images;
  }

  showAt(index) {
    if (!this.images || !this.images.length || !this.els.lightboxImageEl || !this.els.lightboxEl) return;
    
    if (index < 0) index = this.images.length - 1;
    if (index >= this.images.length) index = 0;
    
    this.index = index;
    const filename = this.images[this.index];
    const folderPrefix = this.folder ? encodeURIComponent(this.folder) + "/" : "";
    const src = "/images/" + folderPrefix + encodeURIComponent(filename);
    
    this.els.lightboxImageEl.src = src;
    this.els.lightboxImageEl.style.display = "block";
    this.els.lightboxImageEl.style.opacity = "1";
    
    if (this.els.lightboxGalleryEl) this.els.lightboxGalleryEl.hidden = true;
    this.els.lightboxEl.classList.add("active");
    
    this.updateInfo(filename, this.folder);
  }

  async updateInfo(filename, folder) {
    if (!this.els.lightboxInfoNameEl || !this.els.lightboxInfoPathEl || !this.els.lightboxInfoEl) return;
    
    const count = this.images.length;
    const current = this.index + 1;
    this.els.lightboxInfoNameEl.textContent = `${filename} (${current}/${count})`;
    this.els.lightboxInfoPathEl.textContent = folder;
    
    try {
      const data = await api.fetchFileInfo(folder, filename);
      if (data.size && this.els.lightboxInfoSizeEl) {
        this.els.lightboxInfoSizeEl.textContent = constants.formatFileSize(data.size);
      }
    } catch (e) {
      if (this.els.lightboxInfoSizeEl) this.els.lightboxInfoSizeEl.textContent = "";
    }
    this.els.lightboxInfoEl.hidden = false;
  }

  next() { this.showAt(this.index + 1); }
  prev() { this.showAt(this.index - 1); }

  close() {
    if (!this.els.lightboxEl || !this.els.lightboxImageEl) return;
    this.els.lightboxEl.classList.remove("active");
    this.els.lightboxImageEl.src = "";
  }

  handleMouseMove(e) {
    if (!this.els.lightboxEl.classList.contains("active") || (this.els.lightboxGalleryEl && !this.els.lightboxGalleryEl.hidden)) return;
    
    const windowHeight = window.innerHeight;
    const mouseY = e.clientY;
    
    if (this.els.closeBtnEl) {
      if (mouseY < windowHeight * 0.2) this.els.closeBtnEl.classList.add("visible"); 
      else this.els.closeBtnEl.classList.remove("visible");
    }
    
    if (this.els.lightboxInfoEl) {
      if (mouseY > windowHeight * 0.7) this.els.lightboxInfoEl.classList.add("visible"); 
      else this.els.lightboxInfoEl.classList.remove("visible");
    }
    
    clearTimeout(this.mouseTimeout);
    this.mouseTimeout = setTimeout(() => {
      if (this.els.lightboxInfoEl) this.els.lightboxInfoEl.classList.remove("visible");
      if (this.els.closeBtnEl) this.els.closeBtnEl.classList.remove("visible");
    }, 3000);
  }

  async copyCurrentImageToClipboard() {
    if (this.index < 0 || !this.images.length) return;
    const filename = this.images[this.index];
    try {
      const data = await api.copyFileToClipboard(this.folder, filename);
      if (!data.success) return;
      if (this.els.lightboxInfoCopyEl) {
        this.els.lightboxInfoCopyEl.classList.add("success");
        const originalHTML = this.els.lightboxInfoCopyEl.innerHTML;
        this.els.lightboxInfoCopyEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        setTimeout(() => {
          this.els.lightboxInfoCopyEl.classList.remove("success");
          this.els.lightboxInfoCopyEl.innerHTML = originalHTML;
        }, 1500);
      }
    } catch (e) { console.error(e); }
  }

  toggleGallery(assignDeferredImageSrc) {
    if (!this.els.lightboxGalleryEl || !this.els.lightboxImageEl) return;
    
    if (this.els.lightboxGalleryEl.hidden) {
      this.els.lightboxGalleryEl.hidden = false;
      this.els.lightboxGalleryEl.style.display = "flex";
      this.els.lightboxImageEl.style.display = "none";
      this.renderGallery(assignDeferredImageSrc);
    } else {
      this.els.lightboxGalleryEl.hidden = true;
      this.els.lightboxGalleryEl.style.display = "none";
      this.els.lightboxImageEl.style.display = "block";
    }
  }

  renderGallery(assignDeferredImageSrc) {
    if (!this.images.length || !this.els.lightboxGalleryContentEl) return;
    this.els.lightboxGalleryContentEl.innerHTML = "";
    
    this.images.forEach((filename, index) => {
      const card = document.createElement("article");
      card.className = "card";
      const img = document.createElement("img");
      img.alt = filename;
      img.loading = "lazy";
      img.decoding = "async";
      const src = "/images/" + encodeURIComponent(this.folder) + "/" + encodeURIComponent(filename);
      assignDeferredImageSrc(img, src);
      img.addEventListener("click", () => {
        this.els.lightboxGalleryEl.hidden = true;
        this.els.lightboxGalleryEl.style.display = "none";
        this.showAt(index);
      });
      const caption = document.createElement("div");
      caption.className = "caption";
      caption.textContent = filename;
      card.appendChild(img);
      card.appendChild(caption);
      this.els.lightboxGalleryContentEl.appendChild(card);
    });
  }
}
