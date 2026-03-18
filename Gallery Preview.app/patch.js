    folderTree.renderTree(root.children, elements.folderTree);

    const saved = localStorage.getItem(constants.LAST_FOLDER_KEY);
    const rootFolder = all.find(f => f.path === "");
    const hasAnyImages = all.some(f => f.has_images);

    if (!hasAnyImages) {
      if (elements.status) elements.status.textContent = "No images found.";
      if (elements.grid) {
        elements.grid.innerHTML = `
          <div style="padding: 2rem; text-align: center; color: var(--text-color, #fff); font-family: sans-serif;">
            <h2>Добро пожаловать в Gallery Preview</h2>
            <p>Чтобы увидеть изображения, пожалуйста, скопируйте приложение (Gallery Preview.app) в папку с картинками или в папку, где есть другие папки с картинками.</p>
          </div>
        `;
      }
    } else if (saved && all.some(f => f.path === saved && f.has_images)) {
      currentFol    folderTree.renderTrIm
    const saved = localStorage.getItem(constants.LAST_FOLDERes)    const rootFolder = all.find(f => f.path === "");
    const ha      const hasAnyImages = all.some(f => f.has_imageses
    if (!hasAnyImages) {
      if (elements.status)r =      if (elements.stat        if (elements.grid) {
        elements.grid.innerHTML = `
          <d          elements.grid.inn a          <div style="padding: 2re= firstFolder;
        loadImages(firstFolder);
      }
    }
