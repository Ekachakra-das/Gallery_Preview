// constants.js - Константы и ключи LocalStorage

export const MAX_FOLDER_CACHE = 12;
export const HEARTBEAT_INTERVAL_MS = 10000;
export const FULLSCREEN_BATCH_SIZE = 150;
export const INITIAL_FULLSCREEN_BATCHES = 1;

export const THEME_KEY = "gallery_theme_mode";
export const SIDEBAR_KEY = "gallery_sidebar_collapsed";
export const SIDEBAR_WIDTH_KEY = "gallery_sidebar_width";
export const HIDE_FILENAMES_KEY = "gallery_hide_filenames";
export const HIDE_EMPTY_FOLDERS_KEY = "gallery_hide_empty_folders";
export const FOLDER_NAVIGATION_MODE_KEY = "gallery_folder_navigation_mode";
export const IMAGE_SIZE_KEY = "gallery_image_size";
export const AUTO_GALLERY_KEY = "gallery_auto_gallery_mode";

export const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
