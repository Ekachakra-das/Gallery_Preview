// api.js - Модуль для общения с бэкендом
export async function fetchFolders() {
  const r = await fetch("/api/folders");
  return await r.json();
}

export async function fetchImages(folder, signal) {
  const r = await fetch("/api/images/" + encodeURIComponent(folder), { signal });
  return await r.json();
}

export async function fetchFileInfo(folder, filename) {
  const response = await fetch("/api/file-info/" + encodeURIComponent(folder) + "/" + encodeURIComponent(filename));
  return await response.json();
}

export async function revealInFinder(folder, filename) {
  const response = await fetch("/api/reveal/" + encodeURIComponent(folder) + "/" + encodeURIComponent(filename), {
    method: "POST"
  });
  return await response.json();
}

export async function copyFileToClipboard(folder, filename) {
  const response = await fetch("/api/copy-file/" + encodeURIComponent(folder) + "/" + encodeURIComponent(filename), {
    method: "POST"
  });
  return await response.json();
}

export async function fetchSettings() {
  const r = await fetch("/api/settings");
  return await r.json();
}

export async function saveSettings(settings) {
  const r = await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings)
  });
  return await r.json();
}

export function startHeartbeat(onStop) {
  const heartbeatId = setInterval(async () => {
    try {
      const resp = await fetch("/api/heartbeat");
      if (!resp.ok && onStop) onStop();
    } catch (e) {
      if (onStop) onStop();
    }
  }, 10000);
  return heartbeatId;
}
