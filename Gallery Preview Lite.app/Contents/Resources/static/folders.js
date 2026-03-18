import * as api from "./api.js";

export class FolderTree {
  constructor(treeEl, folderTitleEl, callbacks) {
    this.treeEl = treeEl;
    this.folderTitleEl = folderTitleEl;
    this.callbacks = callbacks; // { onFolderSelect, onActiveChange }
    this.buttonByPath = new Map();
    this.currentFolder = "";
    this.navigationPath = "";
  }

  clear() {
    if (this.treeEl) this.treeEl.innerHTML = "";
    this.buttonByPath.clear();
  }

  setActive(path) {
    if (this.currentFolder && this.buttonByPath.has(this.currentFolder)) {
      this.buttonByPath.get(this.currentFolder).classList.remove("active");
    }
    this.currentFolder = path;
    if (this.buttonByPath.has(path)) {
      this.buttonByPath.get(path).classList.add("active");
    }
    if (this.folderTitleEl) this.folderTitleEl.textContent = path || "Root";
    if (this.callbacks.onActiveChange) this.callbacks.onActiveChange(path);
  }

  renderTree(node, parent) {
    const hideEmpty = localStorage.getItem("gallery_hide_empty_folders") === "1";
    const sorted = Object.entries(node).sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }));
    for (const [name, data] of sorted) {
      if (hideEmpty && data.isEmpty) continue;
      const hasChildren = Object.keys(data.children).length > 0;
      const li = document.createElement("li");
      const btn = document.createElement("button");
      const caret = document.createElement("span");
      caret.className = "caret";
      caret.textContent = hasChildren ? "▸" : "";
      const label = document.createElement("span");
      label.textContent = name;
      btn.append(caret, label);
      this.buttonByPath.set(data.fullPath, btn);
      li.appendChild(btn);

      const sub = document.createElement("ul");
      if (hasChildren) {
        sub.style.display = "none";
        const toggle = (e) => {
          if (e) e.stopPropagation();
          const open = sub.style.display !== "none";
          sub.style.display = open ? "none" : "";
          caret.textContent = open ? "▸" : "▾";
        };
        caret.addEventListener("click", toggle);
        btn.addEventListener("click", toggle);
        this.renderTree(data.children, sub);
        li.appendChild(sub);
      }

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.setActive(data.fullPath);
        if (this.callbacks.onFolderSelect) this.callbacks.onFolderSelect(data.fullPath);
      });

      parent.appendChild(li);
    }
  }

  async renderNavigation() {
    this.clear();
    try {
      const d = await api.fetchFolders();
      const allFolders = Array.isArray(d.folders) ? d.folders : [];
      
      if (this.navigationPath) {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.textContent = "← Back";
        btn.style.fontWeight = "bold";
        btn.addEventListener("click", () => {
          const parts = this.navigationPath.split("/").filter(Boolean);
          parts.pop();
          this.navigationPath = parts.join("/");
          this.renderNavigation();
        });
        li.appendChild(btn);
        this.treeEl.appendChild(li);
      }

      const prefix = this.navigationPath ? this.navigationPath + "/" : "";
      const sub = new Map();
      for (const f of allFolders) {
        if (f.path.startsWith(prefix)) {
          const part = f.path.slice(prefix.length).split("/")[0];
          if (part && !sub.has(part)) sub.set(part, prefix + part);
        }
      }

      Array.from(sub.keys()).sort().forEach(name => {
        const path = sub.get(name);
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.style.width = "100%";
        btn.textContent = name;
        btn.addEventListener("click", () => {
          this.navigationPath = path;
          this.renderNavigation();
          this.setActive(path);
          if (this.callbacks.onFolderSelect) this.callbacks.onFolderSelect(path);
        });
        li.appendChild(btn);
        this.treeEl.appendChild(li);
        this.buttonByPath.set(path, btn);
      });
    } catch (e) { console.error(e); }
  }
}
