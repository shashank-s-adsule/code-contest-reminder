/**
 * Minimal JSON file store — plays the role chrome.storage.local/sync play
 * in the extension. Deliberately not a dependency (electron-store v11+ is
 * ESM-only and pulls in more than this app needs); a single JSON file in
 * the OS's per-app data directory is all a cache + settings blob needs.
 */
const { app } = require("electron");
const { readFile, writeFile, mkdir } = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_SETTINGS = {
  platforms: { Codeforces: true, LeetCode: true, CodeChef: true, AtCoder: true },
  reminderMinutes: [60, 15],
  openAtLogin: false,
};

function storePath() {
  return path.join(app.getPath("userData"), "store.json");
}

let cache = null;

async function load() {
  if (cache) return cache;
  try {
    const raw = await readFile(storePath(), "utf-8");
    cache = JSON.parse(raw);
  } catch {
    cache = { settings: DEFAULT_SETTINGS };
  }
  cache.settings = { ...DEFAULT_SETTINGS, ...cache.settings };
  return cache;
}

async function save() {
  await mkdir(path.dirname(storePath()), { recursive: true });
  await writeFile(storePath(), JSON.stringify(cache, null, 2), "utf-8");
}

async function getStore() {
  return load();
}

async function updateStore(patch) {
  await load();
  cache = { ...cache, ...patch };
  await save();
  return cache;
}

async function getSettings() {
  const store = await load();
  return store.settings;
}

async function saveSettings(settings) {
  return updateStore({ settings: { ...DEFAULT_SETTINGS, ...settings } });
}

module.exports = { getStore, updateStore, getSettings, saveSettings };
