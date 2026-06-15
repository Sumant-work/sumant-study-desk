const STORAGE_KEY = "mission2026-hub-state-v1";
const APP_VERSION = "20260615h";
const BACKUP_KEYS = [
  STORAGE_KEY,
  "ssc_cgl_topper_growth_tracker_v2",
  "tt2-settings",
  "tt2-logs"
];

const $ = (id) => document.getElementById(id);

const elements = {
  lockedShell: $("lockedShell"),
  appShell: $("appShell"),
  unlockForm: $("unlockForm"),
  passwordInput: $("passwordInput"),
  unlockButton: $("unlockButton"),
  togglePassword: $("togglePassword"),
  unlockStatus: $("unlockStatus"),
  unlockError: $("unlockError"),
  lockedCount: $("lockedCount"),
  unlockBadge: $("unlockBadge"),
  totalItems: $("totalItems"),
  savedItems: $("savedItems"),
  doneItems: $("doneItems"),
  recentItems: $("recentItems"),
  searchInput: $("searchInput"),
  clearSearch: $("clearSearch"),
  statusFilter: $("statusFilter"),
  sortFilter: $("sortFilter"),
  continueLast: $("continueLast"),
  openMedievalSet: $("openMedievalSet"),
  openRandomPractice: $("openRandomPractice"),
  toggleDensity: $("toggleDensity"),
  resetFilters: $("resetFilters"),
  quickFilters: $("quickFilters"),
  categoryList: $("categoryList"),
  categoryProgress: $("categoryProgress"),
  materialGrid: $("materialGrid"),
  libraryTitle: $("libraryTitle"),
  librarySubtitle: $("librarySubtitle"),
  viewerPanel: $("viewerPanel"),
  viewerFrame: $("viewerFrame"),
  viewerTitle: $("viewerTitle"),
  viewerMeta: $("viewerMeta"),
  favoriteActive: $("favoriteActive"),
  fullscreenActive: $("fullscreenActive"),
  openPracticeTab: $("openPracticeTab"),
  openActiveTab: $("openActiveTab"),
  downloadActive: $("downloadActive"),
  closeViewer: $("closeViewer"),
  activeStatus: $("activeStatus"),
  activeNotes: $("activeNotes"),
  exportBackup: $("exportBackup"),
  importBackup: $("importBackup"),
  lockAgain: $("lockAgain"),
  appToast: $("appToast")
};

let site = null;
let state = loadState();
let activeCategory = "All";
let activeItem = null;
let query = "";
let statusFilter = "all";
let sortMode = "priority";
let quickFilter = "all";
let unlocked = false;
let currentRawKey = null;
let viewerLoadHintTimer = null;
let viewerObjectUrl = null;
let viewerRequestId = 0;

init();

async function init() {
  if (window.location.protocol === "file:") {
    elements.lockedCount.textContent = "Use local server URL, not file://";
    elements.unlockButton.disabled = true;
    elements.unlockError.textContent = "Open this site on http://127.0.0.1:4177 (or GitHub Pages URL).";
    elements.unlockStatus.textContent = "Encrypted unlock needs secure origin (http/https).";
    return;
  }

  try {
    site = await fetchJson("content/site.json");
    elements.lockedCount.textContent = `${site.items.length} encrypted items ready`;
    if (elements.unlockBadge) elements.unlockBadge.textContent = "Waiting for unlock";
    bindEvents();
  } catch (error) {
    elements.lockedCount.textContent = "Encrypted catalog missing. Run npm run build first.";
    elements.unlockButton.disabled = true;
    elements.unlockError.textContent = error.message;
  }
}

function bindEvents() {
  elements.unlockForm.addEventListener("submit", unlock);
  elements.togglePassword.addEventListener("click", togglePasswordVisibility);
  elements.searchInput.addEventListener("input", () => {
    query = elements.searchInput.value.trim().toLowerCase();
    renderLibrary();
  });
  elements.clearSearch.addEventListener("click", () => {
    elements.searchInput.value = "";
    query = "";
    renderLibrary();
  });
  elements.statusFilter.addEventListener("change", () => {
    statusFilter = elements.statusFilter.value;
    renderLibrary();
  });
  elements.sortFilter.addEventListener("change", () => {
    sortMode = elements.sortFilter.value;
    renderLibrary();
  });
  elements.continueLast.addEventListener("click", openRecentItem);
  elements.openMedievalSet.addEventListener("click", openMedievalSet);
  elements.openRandomPractice.addEventListener("click", openRandomPractice);
  elements.toggleDensity.addEventListener("click", toggleDensity);
  elements.resetFilters.addEventListener("click", resetFilters);
  elements.quickFilters.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-quick]");
    if (!button) return;
    quickFilter = button.dataset.quick;
    renderQuickFilters();
    renderLibrary();
  });
  elements.materialGrid.addEventListener("click", onGridClick);
  elements.materialGrid.addEventListener("change", onGridChange);
  elements.closeViewer.addEventListener("click", closeViewer);
  elements.favoriteActive.addEventListener("click", () => {
    if (activeItem) toggleFavorite(activeItem.id);
  });
  elements.fullscreenActive.addEventListener("click", () => {
    openFullscreenViewer();
  });
  elements.openPracticeTab.addEventListener("click", () => {
    if (activeItem) openItemInTab(activeItem, "practice");
  });
  elements.downloadActive.addEventListener("click", () => {
    if (activeItem) downloadItem(activeItem.id);
  });
  elements.openActiveTab.addEventListener("click", () => {
    if (activeItem) openItemInTab(activeItem, "material");
  });
  elements.activeStatus.addEventListener("change", () => {
    if (!activeItem) return;
    state.status[activeItem.id] = elements.activeStatus.value;
    saveState();
    renderStats();
    renderCategoryProgress();
    renderLibrary();
  });
  elements.activeNotes.addEventListener("input", () => {
    if (!activeItem) return;
    state.notes[activeItem.id] = elements.activeNotes.value;
    saveState();
  });
  elements.exportBackup.addEventListener("click", exportBackup);
  elements.importBackup.addEventListener("change", importBackup);
  elements.lockAgain.addEventListener("click", () => window.location.reload());
  document.addEventListener("keydown", onGlobalKeydown);
  window.addEventListener("popstate", () => {
    if (activeItem && !elements.viewerPanel.hidden) {
      closeViewer({ fromHistory: true });
    }
  });
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "MISSION2026_NEED_KEY" && currentRawKey && site) {
        event.ports[0]?.postMessage({ rawKey: currentRawKey, files: site.files });
      }
    });
  }
}

async function unlock(event) {
  event.preventDefault();
  const password = elements.passwordInput.value;
  if (!password) return;

  elements.unlockButton.disabled = true;
  elements.unlockButton.textContent = "Unlocking...";
  elements.unlockError.textContent = "";
  elements.unlockStatus.textContent = "Unlock in progress...";

  try {
    const rawKey = await deriveRawKey(password);
    await verifyPassword(rawKey);
    currentRawKey = rawKey;
    await startSecureRouter(rawKey);
    unlocked = true;
    elements.unlockStatus.textContent = "Unlocked. Loading your study hub...";
    elements.lockedShell.hidden = true;
    elements.appShell.hidden = false;
    if (elements.unlockBadge) {
      elements.unlockBadge.textContent = "Unlocked";
      elements.unlockBadge.classList.add("is-unlocked");
    }
    renderApp();
    showToast("Unlocked successfully. Choose any set and start practicing.");
  } catch (error) {
    if (/unlock check failed/i.test(String(error?.message || ""))) {
      elements.unlockError.textContent = "Password galat hai ya encrypted content rebuild hua hai.";
    } else {
      elements.unlockError.textContent = "Unlock setup issue. Refresh page once, then try again.";
    }
    elements.unlockStatus.textContent = "";
    console.error(error);
  } finally {
    elements.unlockButton.disabled = false;
    elements.unlockButton.textContent = "Unlock";
  }
}

async function deriveRawKey(password) {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: b64ToBytes(site.crypto.salt),
      iterations: site.crypto.iterations,
      hash: "SHA-256"
    },
    passwordKey,
    256
  );
}

async function verifyPassword(rawKey) {
  const key = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBytes(site.crypto.check.iv) },
    key,
    b64ToBytes(site.crypto.check.data)
  );
  if (new TextDecoder().decode(plain) !== "MISSION2026_UNLOCK_OK") {
    throw new Error("Unlock check failed");
  }
}

async function startSecureRouter(rawKey) {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser does not support secure local routing.");
  }

  const registration = await navigator.serviceWorker.register(`sw.js?v=${APP_VERSION}`, { scope: "./" });
  await registration.update();
  await navigator.serviceWorker.ready;
  const messageTarget = navigator.serviceWorker.controller
    || registration.active
    || registration.waiting
    || registration.installing;
  if (!messageTarget) {
    throw new Error("Secure router unavailable.");
  }

  await sendSecureConfig(rawKey, messageTarget);

  if (registration.waiting) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }
}

function sendSecureConfig(rawKey, messageTarget) {
  return new Promise((resolve, reject) => {
    const target = messageTarget || navigator.serviceWorker.controller;
    if (!target) {
      reject(new Error("Secure router was not activated."));
      return;
    }

    const channel = new MessageChannel();
    const timer = setTimeout(() => reject(new Error("Secure router did not respond.")), 8000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      if (event.data?.ok) resolve();
      else reject(new Error("Secure router failed."));
    };

    target.postMessage(
      {
        type: "MISSION2026_INIT",
        rawKey,
        files: site.files
      },
      [channel.port2]
    );
  });
}

function renderApp() {
  elements.openPracticeTab.hidden = true;
  elements.appShell.classList.toggle("compact-view", Boolean(state.compact));
  elements.toggleDensity.textContent = state.compact ? "Comfort View" : "Compact View";
  renderCategories();
  renderQuickFilters();
  renderStats();
  renderCategoryProgress();
  renderLibrary();
}

function renderCategories() {
  const counts = new Map();
  for (const item of site.items) {
    counts.set(item.category, (counts.get(item.category) || 0) + 1);
  }

  const categories = ["All", ...[...counts.keys()].sort((a, b) => a.localeCompare(b))];
  elements.categoryList.innerHTML = categories.map((category) => {
    const count = category === "All" ? site.items.length : counts.get(category);
    return `<button class="${category === activeCategory ? "active" : ""}" data-category="${escapeAttr(category)}">
      <span>${escapeHtml(category)}</span><span>${count}</span>
    </button>`;
  }).join("");

  elements.categoryList.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.category;
      renderCategories();
      renderLibrary();
    });
  });
}

function renderStats() {
  const savedCount = Object.values(state.favorites).filter(Boolean).length;
  const doneCount = Object.values(state.status).filter((value) => value === "done").length;
  const recentTitles = state.recent
    .map((id) => site.items.find((item) => item.id === id)?.title)
    .filter(Boolean)
    .slice(0, 2);

  elements.totalItems.textContent = site.items.length;
  elements.savedItems.textContent = savedCount;
  elements.doneItems.textContent = doneCount;
  elements.recentItems.textContent = recentTitles.length ? recentTitles.join(" / ") : "Nothing yet";
}

function renderQuickFilters() {
  if (!elements.quickFilters) return;
  elements.quickFilters.querySelectorAll("button[data-quick]").forEach((button) => {
    button.classList.toggle("active", button.dataset.quick === quickFilter);
  });
}

function renderCategoryProgress() {
  const summary = new Map();
  for (const item of site.items) {
    if (!summary.has(item.category)) summary.set(item.category, { total: 0, done: 0 });
    const row = summary.get(item.category);
    row.total += 1;
    if ((state.status[item.id] || "not-started") === "done") row.done += 1;
  }

  const rows = [...summary.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([category, row]) => {
      const percent = row.total ? Math.round((row.done / row.total) * 100) : 0;
      return `<div class="progress-row">
        <div class="progress-head">
          <span>${escapeHtml(category)}</span>
          <span>${row.done}/${row.total}</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
      </div>`;
    })
    .join("");

  elements.categoryProgress.innerHTML = rows || `<p class="empty">No categories found.</p>`;
}

function renderLibrary() {
  const filtered = site.items.filter((item) => {
    const haystack = `${item.title} ${item.category} ${item.section} ${item.type} ${(item.tags || []).join(" ")}`.toLowerCase();
    const categoryOk = activeCategory === "All" || item.category === activeCategory;
    const queryOk = !query || haystack.includes(query);
    const itemStatus = state.status[item.id] || "not-started";
    const statusOk = statusFilter === "all" || statusFilter === itemStatus;
    const quickOk = passesQuickFilter(item, itemStatus);
    return categoryOk && queryOk && statusOk && quickOk;
  }).sort((a, b) => {
    if (sortMode === "alpha") return a.title.localeCompare(b.title);
    if (sortMode === "size") return b.sizeBytes - a.sizeBytes;
    if (sortMode === "recent") {
      const ai = state.recent.indexOf(a.id);
      const bi = state.recent.indexOf(b.id);
      const aScore = ai === -1 ? 9999 : ai;
      const bScore = bi === -1 ? 9999 : bi;
      if (aScore !== bScore) return aScore - bScore;
      return a.title.localeCompare(b.title);
    }
    const af = state.favorites[a.id] ? 0 : 1;
    const bf = state.favorites[b.id] ? 0 : 1;
    if (af !== bf) return af - bf;
    const as = state.status[a.id] || "not-started";
    const bs = state.status[b.id] || "not-started";
    const priority = { studying: 0, "not-started": 1, done: 2 };
    if (priority[as] !== priority[bs]) return priority[as] - priority[bs];
    return a.title.localeCompare(b.title);
  });

  elements.libraryTitle.textContent = activeCategory === "All" ? "All Material" : activeCategory;
  elements.librarySubtitle.textContent = `${filtered.length} item${filtered.length === 1 ? "" : "s"} shown · ${labelForQuickFilter()}`;

  if (!filtered.length) {
    elements.materialGrid.innerHTML = `<div class="empty">No material matched your filters.</div>`;
    return;
  }

  elements.materialGrid.innerHTML = filtered.map(renderCard).join("");
}

function renderCard(item) {
  const saved = Boolean(state.favorites[item.id]);
  const status = state.status[item.id] || "not-started";
  const canOpen = item.openMode !== "download";
  const accent = categoryAccent(item.category);
  return `<article class="material-card ${saved ? "saved" : ""}" style="--card-accent:${accent}" data-id="${escapeAttr(item.id)}">
    <div class="card-top">
      <div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.section || item.category)}</p>
      </div>
      <div class="card-side">
        <span class="status-pill ${statusClass(status)}">${statusLabel(status)}</span>
        <button class="ghost mini-button" data-action="favorite">${saved ? "Saved" : "Save"}</button>
      </div>
    </div>
    <div class="meta-row">
      <span>${escapeHtml(item.category)}</span>
      <span>${escapeHtml(item.type)}</span>
      <span>${formatBytes(item.sizeBytes)}</span>
    </div>
    <select data-action="status" aria-label="Study status">
      <option value="not-started" ${status === "not-started" ? "selected" : ""}>Not started</option>
      <option value="studying" ${status === "studying" ? "selected" : ""}>Studying</option>
      <option value="done" ${status === "done" ? "selected" : ""}>Done</option>
    </select>
    <div class="card-actions">
      <button data-action="open">${canOpen ? "Open" : "Download"}</button>
      <button class="ghost" data-action="download">Save File</button>
    </div>
  </article>`;
}

function onGridClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const card = button.closest("[data-id]");
  const id = card?.dataset.id;
  if (!id) return;

  if (button.dataset.action === "favorite") toggleFavorite(id);
  if (button.dataset.action === "open") openItem(id);
  if (button.dataset.action === "download") downloadItem(id);
}

function onGridChange(event) {
  if (event.target.dataset.action !== "status") return;
  const id = event.target.closest("[data-id]")?.dataset.id;
  if (!id) return;
  state.status[id] = event.target.value;
  saveState();
  renderStats();
  renderCategoryProgress();
  renderLibrary();
}

async function openItem(id) {
  if (!unlocked) return;
  const item = site.items.find((entry) => entry.id === id);
  if (!item) return;

  if (item.openMode === "download") {
    downloadItem(id);
    return;
  }

  activeItem = item;
  const requestId = ++viewerRequestId;
  state.recent = [id, ...state.recent.filter((value) => value !== id)].slice(0, 8);
  if (!state.status[id]) state.status[id] = "studying";
  saveState();

  elements.viewerTitle.textContent = item.title;
  elements.viewerMeta.textContent = `${item.category} / ${item.section || item.type} / ${formatBytes(item.sizeBytes)}`;
  showViewerLoading();
  const practiceLike = isPracticeSet(item);
  elements.openPracticeTab.hidden = !practiceLike;
  clearTimeout(viewerLoadHintTimer);
  viewerLoadHintTimer = setTimeout(() => {
    if (practiceLike && !elements.viewerPanel.hidden) {
      showToast("Use Back to Library to return. Full Tab is optional.");
    }
  }, 2500);
  elements.activeStatus.value = state.status[id] || "not-started";
  elements.activeNotes.value = state.notes[id] || "";
  elements.favoriteActive.textContent = state.favorites[id] ? "Saved" : "Save";
  elements.viewerPanel.hidden = false;
  document.body.classList.add("viewer-open");
  pushViewerHistory(id);
  elements.viewerPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  renderStats();
  renderCategoryProgress();
  renderLibrary();

  try {
    const payload = await decryptItemPayload(item);
    if (requestId !== viewerRequestId || activeItem?.id !== item.id) {
      return;
    }
    if (isHtmlPayload(payload.file)) {
      revokeViewerObjectUrl();
      replaceViewerFrame({ srcdoc: payloadToText(payload.plain) });
    } else {
      const blob = payloadToBlob(payload);
      const objectUrl = URL.createObjectURL(blob);
      revokeViewerObjectUrl();
      viewerObjectUrl = objectUrl;
      replaceViewerFrame({ src: objectUrl });
    }
  } catch (error) {
    if (requestId === viewerRequestId) {
      replaceViewerFrame({
        srcdoc: viewerMessageHtml("Could not open this material", "Lock and unlock once, then retry.")
      });
      showToast("Open failed. Unlock and retry.");
    }
    console.error(error);
  }
}

function closeViewer(options = {}) {
  viewerRequestId += 1;
  replaceViewerFrame({ src: "about:blank" });
  revokeViewerObjectUrl();
  elements.viewerPanel.hidden = true;
  activeItem = null;
  document.body.classList.remove("viewer-open");
  clearTimeout(viewerLoadHintTimer);
  if (!options.fromHistory && window.history.state?.mission2026Viewer) {
    window.history.back();
  }
}

function toggleFavorite(id) {
  state.favorites[id] = !state.favorites[id];
  if (!state.favorites[id]) delete state.favorites[id];
  saveState();
  if (activeItem?.id === id) {
    elements.favoriteActive.textContent = state.favorites[id] ? "Saved" : "Save";
  }
  renderStats();
  renderCategoryProgress();
  renderLibrary();
}

async function downloadItem(id) {
  const item = site.items.find((entry) => entry.id === id);
  if (!item) return;
  try {
    const blob = await decryptItem(item);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = item.fileName || `${item.id}.bin`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    showToast("Download started.");
  } catch (error) {
    alert("Download failed. Unlock again and retry.");
    showToast("Download failed. Unlock and retry.");
    console.error(error);
  }
}

function secureUrl(route) {
  const base = new URL(".", window.location.href).pathname;
  const encodedRoute = route.split("/").map(encodeURIComponent).join("/");
  return `${base}secure/${encodedRoute}`;
}

function pushViewerHistory(id) {
  const stateData = { mission2026Viewer: true, id };
  const target = new URL(window.location.href);
  target.hash = `view-${encodeURIComponent(id)}`;
  if (window.location.hash !== target.hash) {
    window.history.pushState(stateData, "", target);
  } else {
    window.history.replaceState(stateData, "", target);
  }
}

function exportBackup() {
  const payload = {
    app: "Sumant Study Desk",
    exportedAt: new Date().toISOString(),
    origin: location.origin,
    data: {}
  };

  for (const key of BACKUP_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) payload.data[key] = value;
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `mission2026-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(String(reader.result));
      if (!payload.data || typeof payload.data !== "object") throw new Error("Invalid backup");
      for (const [key, value] of Object.entries(payload.data)) {
        if (BACKUP_KEYS.includes(key) && typeof value === "string") {
          localStorage.setItem(key, value);
        }
      }
      state = loadState();
      renderApp();
      alert("Backup imported.");
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      favorites: parsed.favorites || {},
      status: parsed.status || {},
      notes: parsed.notes || {},
      recent: Array.isArray(parsed.recent) ? parsed.recent : [],
      compact: Boolean(parsed.compact)
    };
  } catch {
    return { favorites: {}, status: {}, notes: {}, recent: [], compact: false };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url} not found`);
  return response.json();
}

function b64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function categoryAccent(category) {
  const accents = {
    "Bihar GK/GS": "#0f766e",
    Downloads: "#1469c8",
    English: "#7c3aed",
    "GS/GK": "#be3455",
    Maths: "#0f7a8a",
    Reasoning: "#b45309",
    Research: "#4f46e5",
    "Sanitary Inspector": "#15803d",
    "SSC Syllabus": "#2563eb",
    Trackers: "#9333ea",
    Typing: "#ca8a04"
  };
  return accents[category] || "#1469c8";
}

function statusClass(status) {
  return `status-${status || "not-started"}`;
}

function statusLabel(status) {
  const labels = {
    "not-started": "New",
    studying: "Studying",
    done: "Done"
  };
  return labels[status] || "New";
}

function passesQuickFilter(item, itemStatus) {
  const type = `${item.type} ${item.title} ${item.section}`.toLowerCase();
  if (quickFilter === "practice") return isPracticeSet(item);
  if (quickFilter === "syllabus") return type.includes("syllabus");
  if (quickFilter === "downloads") return item.openMode === "download" || type.includes("offline pack") || type.includes("slides");
  if (quickFilter === "saved") return Boolean(state.favorites[item.id]);
  if (quickFilter === "recent") return state.recent.includes(item.id);
  if (quickFilter === "continue") return itemStatus === "studying" || Boolean(state.notes[item.id]);
  return true;
}

function labelForQuickFilter() {
  const labels = {
    all: "all view",
    practice: "practice tools",
    syllabus: "syllabus pages",
    downloads: "download packs",
    saved: "saved items",
    recent: "recently opened",
    continue: "continue studying"
  };
  return labels[quickFilter] || "all view";
}

function togglePasswordVisibility() {
  const currentlyHidden = elements.passwordInput.type === "password";
  elements.passwordInput.type = currentlyHidden ? "text" : "password";
  elements.togglePassword.textContent = currentlyHidden ? "Hide" : "Show";
}

async function openItemInTab(item, mode, options = {}) {
  try {
    const payload = await decryptItemPayload(item);
    const htmlPayload = isHtmlPayload(payload.file);
    const objectUrl = htmlPayload ? "" : URL.createObjectURL(payloadToBlob(payload));
    const opened = window.open(htmlPayload ? "" : objectUrl, "_blank");
    if (!opened) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (!options.silentBlockedToast) {
        showToast("Popup blocked by browser. Allow popups for this site.");
      }
      return false;
    }
    if (htmlPayload) {
      opened.document.open();
      opened.document.write(payloadToText(payload.plain));
      opened.document.close();
    } else if (objectUrl) {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    }
    try {
      opened.opener = null;
    } catch {
      // Ignore if browser disallows setting opener.
    }
    if (mode === "practice") {
      showToast("Practice set opened in full tab.");
    }
    return true;
  } catch (error) {
    showToast("Open failed. Unlock and retry.");
    console.error(error);
    return false;
  }
}

function showViewerLoading() {
  revokeViewerObjectUrl();
  replaceViewerFrame({
    srcdoc: viewerMessageHtml("Opening secure material...", "Decrypting inside this browser.")
  });
}

function replaceViewerFrame({ src = "", srcdoc = "" } = {}) {
  const nextFrame = document.createElement("iframe");
  nextFrame.id = "viewerFrame";
  nextFrame.title = "Study material viewer";
  nextFrame.allowFullscreen = true;
  if (srcdoc) nextFrame.srcdoc = srcdoc;
  if (src) nextFrame.src = src;
  elements.viewerFrame.replaceWith(nextFrame);
  elements.viewerFrame = nextFrame;
}

function viewerMessageHtml(title, detail) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;color:#223047;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    section{text-align:center;padding:24px}
    h1{font-size:20px;margin:0 0 8px}
    p{margin:0;color:#64748b}
  </style></head><body><section><h1>${escapeHtml(title)}</h1><p>${escapeHtml(detail)}</p></section></body></html>`;
}

function revokeViewerObjectUrl() {
  if (!viewerObjectUrl) return;
  URL.revokeObjectURL(viewerObjectUrl);
  viewerObjectUrl = null;
}

async function decryptItem(item) {
  return payloadToBlob(await decryptItemPayload(item));
}

async function decryptItemPayload(item) {
  if (!currentRawKey) throw new Error("Unlock key missing.");
  const file = site.files[item.entryRoute];
  if (!file) throw new Error(`Secure file missing: ${item.entryRoute}`);

  const response = await fetch(file.blob, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Encrypted blob missing: ${file.blob}`);

  const key = await crypto.subtle.importKey("raw", currentRawKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const plain = await decryptEncryptedBytes(new Uint8Array(await response.arrayBuffer()), key);
  return { file, plain };
}

function payloadToBlob(payload) {
  return new Blob([payload.plain], { type: payload.file.mime || "application/octet-stream" });
}

function payloadToText(plain) {
  return new TextDecoder().decode(plain);
}

function isHtmlPayload(file) {
  return /html/i.test(file.mime || "") || /\.html?$/i.test(file.name || "");
}

async function decryptEncryptedBytes(bytes, key) {
  const magic = "M26ENC1\n";
  const decoder = new TextDecoder();
  if (decoder.decode(bytes.slice(0, magic.length)) !== magic) {
    throw new Error("Invalid encrypted file");
  }

  const iv = bytes.slice(magic.length, magic.length + 12);
  const payload = bytes.slice(magic.length + 12);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, payload);
}

function openSecureInTab(route, mode, options = {}) {
  const opened = window.open(secureUrl(route), "_blank");
  if (!opened) {
    if (!options.silentBlockedToast) {
      showToast("Popup blocked by browser. Allow popups for this site.");
    }
    return false;
  }
  try {
    opened.opener = null;
  } catch {
    // Ignore if browser disallows setting opener.
  }
  if (mode === "practice") {
    showToast("Practice set opened in full tab.");
  }
  return true;
}

function openFullscreenViewer() {
  if (elements.viewerPanel.hidden) return;
  const target = elements.viewerPanel;
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
    return;
  }
  target.requestFullscreen?.().catch(() => {
    showToast("Fullscreen not available on this browser.");
  });
}

function isPracticeSet(item) {
  const text = `${item.title} ${item.type} ${item.section}`.toLowerCase();
  return text.includes("practice") || text.includes("mock") || item.type === "Practice Tool";
}

function showToast(message) {
  if (!elements.appToast) return;
  elements.appToast.textContent = message;
  elements.appToast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    elements.appToast.hidden = true;
  }, 2600);
}

function resetFilters() {
  query = "";
  statusFilter = "all";
  sortMode = "priority";
  quickFilter = "all";
  activeCategory = "All";
  elements.searchInput.value = "";
  elements.statusFilter.value = "all";
  elements.sortFilter.value = "priority";
  renderCategories();
  renderQuickFilters();
  renderLibrary();
  showToast("Filters reset.");
}

function openRecentItem() {
  const id = state.recent[0];
  if (!id) {
    showToast("No recent material yet.");
    return;
  }
  openItem(id);
}

function openMedievalSet() {
  const item = site.items.find((entry) => /medieval|medival/i.test(`${entry.title} ${entry.section} ${entry.entryRoute}`));
  if (!item) {
    showToast("Medieval set is not in this build.");
    return;
  }
  activeCategory = item.category;
  query = "";
  quickFilter = "all";
  statusFilter = "all";
  elements.searchInput.value = "";
  elements.statusFilter.value = "all";
  renderCategories();
  renderQuickFilters();
  renderLibrary();
  openItem(item.id);
}

function openRandomPractice() {
  const pool = site.items.filter((item) => item.openMode !== "download" && isPracticeSet(item));
  if (!pool.length) {
    showToast("No practice set found in library.");
    return;
  }
  const random = pool[Math.floor(Math.random() * pool.length)];
  if (activeCategory !== "All" && random.category !== activeCategory) {
    activeCategory = random.category;
    renderCategories();
  }
  openItem(random.id);
}

function toggleDensity() {
  state.compact = !state.compact;
  saveState();
  elements.appShell.classList.toggle("compact-view", state.compact);
  elements.toggleDensity.textContent = state.compact ? "Comfort View" : "Compact View";
  renderLibrary();
}

function onGlobalKeydown(event) {
  const tag = event.target?.tagName?.toLowerCase();
  const typingField = tag === "input" || tag === "textarea" || tag === "select";
  if (event.key === "/" && !typingField && unlocked) {
    event.preventDefault();
    elements.searchInput.focus();
    return;
  }
  if (event.key === "Escape" && unlocked && !elements.viewerPanel.hidden) {
    closeViewer();
  }
}
