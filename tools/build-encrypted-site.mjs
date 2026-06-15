import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content");
const BLOB_DIR = path.join(CONTENT_DIR, "blobs");
const SOURCE_ZIP = process.env.MISSION2026_ZIP || "/Users/sumantraj/Downloads/Mission2026.zip";
const PASSWORD = process.env.MISSION2026_PASSWORD;
const ITERATIONS = Number(process.env.MISSION2026_KDF_ITERATIONS || 220000);
const MAGIC = Buffer.from("M26ENC1\n", "utf8");

if (!PASSWORD) {
  console.error("Set MISSION2026_PASSWORD before building.");
  console.error("Example: MISSION2026_PASSWORD='your private password' npm run build");
  process.exit(1);
}

if (!fs.existsSync(SOURCE_ZIP)) {
  console.error(`Mission2026 zip not found: ${SOURCE_ZIP}`);
  process.exit(1);
}

fs.rmSync(BLOB_DIR, { recursive: true, force: true });
fs.mkdirSync(BLOB_DIR, { recursive: true });

const salt = crypto.randomBytes(16);
const key = crypto.pbkdf2Sync(PASSWORD, salt, ITERATIONS, 32, "sha256");
const files = {};
const items = [];
let encryptedCount = 0;
let totalPlainBytes = 0;

const extraFiles = [
  {
    path: "/Users/sumantraj/Documents/E Doc HTML/divisibility_rules_ssc.html",
    route: "extras/ssc-syllabus/divisibility_rules_ssc.html",
    title: "Divisibility Rules for SSC",
    category: "Maths",
    section: "Quick Reference",
    type: "Reference"
  },
  {
    path: "/Users/sumantraj/Documents/E Doc HTML/ssc_economics_syllabus.html",
    route: "extras/ssc-syllabus/ssc_economics_syllabus.html",
    title: "SSC Economics Syllabus",
    category: "SSC Syllabus",
    section: "Economics",
    type: "Syllabus"
  },
  {
    path: "/Users/sumantraj/Documents/E Doc HTML/ssc_english_complete_syllabus.html",
    route: "extras/ssc-syllabus/ssc_english_complete_syllabus.html",
    title: "SSC English Complete Syllabus",
    category: "SSC Syllabus",
    section: "English",
    type: "Syllabus"
  },
  {
    path: "/Users/sumantraj/Documents/E Doc HTML/ssc_geography_syllabus.html",
    route: "extras/ssc-syllabus/ssc_geography_syllabus.html",
    title: "SSC Geography Syllabus",
    category: "SSC Syllabus",
    section: "Geography",
    type: "Syllabus"
  },
  {
    path: "/Users/sumantraj/Documents/E Doc HTML/ssc_mathematics_complete_syllabus.html",
    route: "extras/ssc-syllabus/ssc_mathematics_complete_syllabus.html",
    title: "SSC Mathematics Complete Syllabus",
    category: "SSC Syllabus",
    section: "Mathematics",
    type: "Syllabus"
  },
  {
    path: "/Users/sumantraj/Documents/E Doc HTML/ssc_mathematics_syllabus.html",
    route: "extras/ssc-syllabus/ssc_mathematics_syllabus.html",
    title: "SSC Mathematics Syllabus",
    category: "SSC Syllabus",
    section: "Mathematics",
    type: "Syllabus"
  },
  {
    path: "/Users/sumantraj/Documents/E Doc HTML/ssc_polity_syllabus.html",
    route: "extras/ssc-syllabus/ssc_polity_syllabus.html",
    title: "SSC Polity Syllabus",
    category: "SSC Syllabus",
    section: "Polity",
    type: "Syllabus"
  },
  {
    path: "/Users/sumantraj/Documents/E Doc HTML/ssc_reasoning_complete_syllabus.html",
    route: "extras/ssc-syllabus/ssc_reasoning_complete_syllabus.html",
    title: "SSC Reasoning Complete Syllabus",
    category: "SSC Syllabus",
    section: "Reasoning",
    type: "Syllabus"
  },
  {
    path: "/Users/sumantraj/Documents/E Doc HTML/ssc_reasoning_full_complete.html",
    route: "extras/ssc-syllabus/ssc_reasoning_full_complete.html",
    title: "SSC Reasoning Full Complete",
    category: "SSC Syllabus",
    section: "Reasoning",
    type: "Syllabus"
  },
  {
    path: "/Users/sumantraj/Documents/E Doc HTML/ssc_static_gk_syllabus.html",
    route: "extras/ssc-syllabus/ssc_static_gk_syllabus.html",
    title: "SSC Static GK Syllabus",
    category: "SSC Syllabus",
    section: "Static GK",
    type: "Syllabus"
  },
  {
    path: "/Users/sumantraj/Documents/Topper Tracker/SSC_CGL_Topper_Growth_Tracker.html",
    route: "extras/trackers/SSC_CGL_Topper_Growth_Tracker.html",
    title: "SSC CGL Topper Growth Tracker",
    category: "Trackers",
    section: "Daily Growth",
    type: "Tracker"
  },
  {
    path: "/Users/sumantraj/Documents/Topper Tracker/ssc_topper_tracker.html",
    route: "extras/trackers/ssc_topper_tracker.html",
    title: "SSC Topper Tracker",
    category: "Trackers",
    section: "Daily Planner",
    type: "Tracker"
  },
  {
    path: "/Users/sumantraj/Downloads/ssc_deep_research_dashboard.html",
    route: "extras/research/ssc_deep_research_dashboard.html",
    title: "SSC Deep Research Dashboard",
    category: "Research",
    section: "Pattern Analysis",
    type: "Dashboard"
  }
];

buildFromZip();
buildExtras();
writeSiteJson();

console.log(`Encrypted ${encryptedCount} files.`);
console.log(`Catalog items: ${items.length}.`);
console.log(`Plain source size: ${formatBytes(totalPlainBytes)}.`);

function buildFromZip() {
  const entries = execFileSync("zipinfo", ["-1", SOURCE_ZIP], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024
  }).split(/\r?\n/).filter(Boolean);

  const cleanEntries = entries.filter((entry) => !isSkippedZipEntry(entry) && !entry.endsWith("/"));

  for (const entry of cleanEntries) {
    const sourcePath = normalizeSourcePath(entry);
    const route = routeFromMissionPath(sourcePath);
    let bytes = execFileSync("unzip", ["-p", SOURCE_ZIP, entry], {
      maxBuffer: 220 * 1024 * 1024
    });
    bytes = maybeWrapHtml(bytes, route, titleFromFile(sourcePath));
    addEncryptedFile({ route, sourcePath, bytes });
  }

  for (const entry of cleanEntries) {
    const sourcePath = normalizeSourcePath(entry);
    const route = routeFromMissionPath(sourcePath);
    const ext = extension(sourcePath);
    if (isResourceOnly(sourcePath)) continue;
    if (ext === ".html" || ext === ".htm") {
      items.push(itemFromRoute({
        route,
        sourcePath,
        title: titleFromFile(sourcePath),
        category: categoryForMissionPath(sourcePath),
        section: sectionForMissionPath(sourcePath),
        type: typeForPath(sourcePath),
        openMode: "viewer"
      }));
    } else if (isReferenceFile(sourcePath)) {
      const mode = openModeForPath(sourcePath);
      items.push(itemFromRoute({
        route,
        sourcePath,
        title: titleFromFile(sourcePath),
        category: mode === "download" ? "Downloads" : categoryForMissionPath(sourcePath),
        section: mode === "download" ? categoryForMissionPath(sourcePath) : sectionForMissionPath(sourcePath),
        type: typeForPath(sourcePath),
        openMode: mode
      }));
    }
  }
}

function buildExtras() {
  for (const extra of extraFiles) {
    if (!fs.existsSync(extra.path)) {
      console.warn(`Missing extra file: ${extra.path}`);
      continue;
    }
    let bytes = fs.readFileSync(extra.path);
    bytes = maybeWrapHtml(bytes, extra.route, extra.title);
    addEncryptedFile({ route: extra.route, sourcePath: extra.path, bytes });
    items.push(itemFromRoute({
      route: extra.route,
      sourcePath: extra.path,
      title: extra.title,
      category: extra.category,
      section: extra.section,
      type: extra.type,
      openMode: "viewer"
    }));
  }
}

function addEncryptedFile({ route, sourcePath, bytes }) {
  const id = crypto.createHash("sha256").update(route).digest("hex").slice(0, 24);
  const blob = `content/blobs/${id}.enc`;
  const encrypted = encrypt(bytes);
  fs.writeFileSync(path.join(ROOT, blob), encrypted);
  files[route] = {
    blob,
    mime: mimeForPath(route),
    name: path.basename(route),
    sizeBytes: bytes.length,
    sourcePath
  };
  encryptedCount += 1;
  totalPlainBytes += bytes.length;
}

function itemFromRoute({ route, sourcePath, title, category, section, type, openMode }) {
  const file = files[route];
  const id = crypto.createHash("sha256").update(route).digest("hex").slice(0, 16);
  return {
    id,
    title,
    category,
    section,
    type,
    entryRoute: route,
    fileName: path.basename(route),
    sizeBytes: file?.sizeBytes || 0,
    openMode,
    tags: tagsFor({ sourcePath, title, category, section, type })
  };
}

function writeSiteJson() {
  const check = encryptSmall("MISSION2026_UNLOCK_OK");
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    crypto: {
      algorithm: "AES-256-GCM",
      kdf: "PBKDF2-SHA256",
      iterations: ITERATIONS,
      salt: salt.toString("base64"),
      check
    },
    items: items.sort((a, b) => `${a.category} ${a.title}`.localeCompare(`${b.category} ${b.title}`)),
    files
  };
  fs.writeFileSync(path.join(CONTENT_DIR, "site.json"), `${JSON.stringify(payload, null, 2)}\n`);
}

function encrypt(bytes) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, iv, ciphertext, tag]);
}

function encryptSmall(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(text, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return {
    iv: iv.toString("base64"),
    data: ciphertext.toString("base64")
  };
}

function isSkippedZipEntry(entry) {
  if (entry.startsWith("__MACOSX/")) return true;
  return entry.split("/").some((segment) => (
    !segment ||
    segment === ".DS_Store" ||
    segment.startsWith("._")
  ));
}

function normalizeSourcePath(entry) {
  return entry.replace(/^Mission2026\/?/, "");
}

function routeFromMissionPath(sourcePath) {
  const cleanSegments = sourcePath.split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  return ["mission2026", ...cleanSegments].join("/");
}

function maybeWrapHtml(bytes, route, title) {
  if (![".html", ".htm"].includes(extension(route))) return bytes;
  const text = bytes.toString("utf8");
  if (/<html[\s>]/i.test(text.slice(0, 1200))) return bytes;
  const wrapped = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>${escapeHtml(title)}</title>
<style>
:root {
  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "SFMono-Regular", Consolas, monospace;
  --border-radius-md: 8px;
  --border-radius-lg: 8px;
  --color-background-primary: #ffffff;
  --color-background-secondary: #f5f7fb;
  --color-background-info: #e6f1fb;
  --color-background-warning: #fff7ed;
  --color-background-danger: #fee2e2;
  --color-background-success: #dcfce7;
  --color-border-primary: #94a3b8;
  --color-border-secondary: #d7deea;
  --color-border-tertiary: #e5eaf2;
  --color-border-info: #85b7eb;
  --color-text-primary: #172033;
  --color-text-secondary: #647084;
  --color-text-tertiary: #8a94a6;
  --color-text-info: #0c447c;
  --color-text-warning: #92400e;
  --color-text-danger: #991b1b;
  --color-text-success: #166534;
}
body {
  margin: 0;
  padding: 18px;
  background: #f8fafc;
  color: var(--color-text-primary);
  font-family: var(--font-sans);
}
.doc-shell {
  max-width: 1180px;
  margin: 0 auto;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
</head>
<body>
<main class="doc-shell">
${text}
</main>
</body>
</html>`;
  return Buffer.from(wrapped, "utf8");
}

function isResourceOnly(sourcePath) {
  const normalized = sourcePath.toLowerCase();
  return normalized.includes("sumants_english_vocab_cbt_master/assets/") ||
    normalized.endsWith("/questions.js") ||
    normalized.endsWith("/questions.json") ||
    normalized.endsWith("/readme.txt");
}

function isReferenceFile(sourcePath) {
  const ext = extension(sourcePath);
  if ([".zip", ".pptx", ".txt"].includes(ext)) return true;
  if (ext === ".json" && /answer[_ -]?key/i.test(sourcePath)) return true;
  return false;
}

function openModeForPath(sourcePath) {
  const ext = extension(sourcePath);
  if ([".zip", ".pptx"].includes(ext)) return "download";
  return "viewer";
}

function typeForPath(sourcePath) {
  const lower = sourcePath.toLowerCase();
  const ext = extension(sourcePath);
  if (lower.includes("typing")) return "Typing Tool";
  if (lower.includes("tracker")) return "Tracker";
  if (lower.includes("answer_key") || lower.includes("answer-key")) return "Answer Key";
  if (lower.includes("coverage")) return "Coverage";
  if (ext === ".pptx") return "Slides";
  if (ext === ".zip") return "Offline Pack";
  if (ext === ".json") return "Answer Key";
  if (lower.includes("syllabus")) return "Syllabus";
  return ext === ".html" || ext === ".htm" ? "Practice Tool" : "Download";
}

function categoryForMissionPath(sourcePath) {
  const lower = sourcePath.toLowerCase();
  if (lower.includes("typing")) return "Typing";
  if (lower.includes("eng - gram") || lower.includes("eng-vocab") || lower.includes("english")) return "English";
  if (lower.includes("math") || lower.includes("quant")) return "Maths";
  if (lower.includes("reasoning")) return "Reasoning";
  if (lower.includes("bihar")) return "Bihar GK/GS";
  if (lower.includes("for si") || lower.includes("s i teaching") || lower.includes("sanitary") || lower.includes("malaria")) return "Sanitary Inspector";
  if (["polity", "economy", "geo", "static", "medival", "medieval"].some((word) => lower.includes(word))) return "GS/GK";
  return "Downloads";
}

function sectionForMissionPath(sourcePath) {
  const segments = sourcePath.split("/").map((segment) => segment.trim()).filter(Boolean);
  if (segments.length <= 1) return categoryForMissionPath(sourcePath);
  const first = segments[0].toLowerCase();
  if (first.includes("for si") && segments[1]) return cleanTitle(segments[1]);
  return cleanTitle(segments[0]);
}

function titleFromFile(sourcePath) {
  const lower = sourcePath.toLowerCase();
  if (lower.includes("bihar gk gs/index 2.html")) return "Bihar GK/GS Practice";
  if (lower.includes("sumants_english_vocab_cbt_master/index.html")) return "English Vocab CBT Master";
  if (lower.includes("start_here_sumants_english_vocab_cbt_master")) return "English Vocab CBT Start Here";
  const fileName = path.basename(sourcePath);
  return cleanTitle(fileName.replace(/\.[^.]+$/, ""));
}

function cleanTitle(value) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\bssc\b/ig, "SSC")
    .replace(/\bcgl\b/ig, "CGL")
    .replace(/\brrb\b/ig, "RRB")
    .replace(/\bsi\b/ig, "SI")
    .replace(/\bgk\b/ig, "GK")
    .replace(/\bgs\b/ig, "GS")
    .trim()
    .replace(/\w\S*/g, (word) => (
      /^(SSC|CGL|RRB|SI|GK|GS|MCQ|PYQ|CBT)$/i.test(word)
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1)
    ));
}

function tagsFor({ sourcePath, title, category, section, type }) {
  const raw = `${sourcePath} ${title} ${category} ${section} ${type}`.toLowerCase();
  const tags = new Set([category, section, type].filter(Boolean));
  for (const word of ["ssc", "cgl", "sanitary", "inspector", "english", "math", "reasoning", "polity", "economy", "geography", "static", "bihar", "typing", "tracker", "syllabus", "practice"]) {
    if (raw.includes(word)) tags.add(word);
  }
  return [...tags];
}

function mimeForPath(sourcePath) {
  const ext = extension(sourcePath);
  const map = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".zip": "application/zip",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  };
  return map[ext] || "application/octet-stream";
}

function extension(sourcePath) {
  return path.extname(sourcePath).toLowerCase();
}

function formatBytes(bytes = 0) {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}
