/**
 * Options Page Script
 * Reads settings from chrome.storage.sync on load,
 * saves them back when the user hits Save.
 */

const PLATFORM_IDS = ["Codeforces", "LeetCode", "CodeChef", "AtCoder"];
const REMINDER_MINS = [1440, 60, 15];

async function loadSettings() {
  const { settings } = await chrome.storage.sync.get("settings");
  if (!settings) return;

  for (const p of PLATFORM_IDS) {
    const el = document.getElementById(`toggle-${p}`);
    if (el) el.checked = settings.platforms[p] !== false;
  }

  for (const m of REMINDER_MINS) {
    const el = document.getElementById(`remind-${m}`);
    if (el) el.checked = settings.reminderMinutes.includes(m);
  }
}

async function saveSettings() {
  const platforms = {};
  for (const p of PLATFORM_IDS) {
    platforms[p] = document.getElementById(`toggle-${p}`)?.checked ?? true;
  }

  const reminderMinutes = REMINDER_MINS.filter(
    (m) => document.getElementById(`remind-${m}`)?.checked
  );

  await chrome.storage.sync.set({ settings: { platforms, reminderMinutes } });

  // Trigger a re-poll immediately after saving
  chrome.runtime.sendMessage({ type: "REPOLL" });

  const msg = document.getElementById("saved-msg");
  msg.classList.remove("hidden");
  setTimeout(() => msg.classList.add("hidden"), 2000);
}

document.getElementById("save-btn").addEventListener("click", saveSettings);
loadSettings();
