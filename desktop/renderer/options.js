/**
 * Options renderer — same structure as extension/options/options.js,
 * adapted to talk to the main process via the `api` bridge.
 */

const PLATFORM_IDS = ["Codeforces", "LeetCode", "CodeChef", "AtCoder"];
const REMINDER_MINS = [1440, 60, 15];

async function loadSettings() {
  const settings = await window.api.getSettings();
  if (!settings) return;

  for (const p of PLATFORM_IDS) {
    const el = document.getElementById(`toggle-${p}`);
    if (el) el.checked = settings.platforms[p] !== false;
  }

  for (const m of REMINDER_MINS) {
    const el = document.getElementById(`remind-${m}`);
    if (el) el.checked = settings.reminderMinutes.includes(m);
  }

  document.getElementById("open-at-login").checked = !!settings.openAtLogin;
}

async function saveSettings() {
  const platforms = {};
  for (const p of PLATFORM_IDS) {
    platforms[p] = document.getElementById(`toggle-${p}`)?.checked ?? true;
  }

  const reminderMinutes = REMINDER_MINS.filter(
    (m) => document.getElementById(`remind-${m}`)?.checked
  );

  const openAtLogin = document.getElementById("open-at-login").checked;

  await window.api.saveSettings({ platforms, reminderMinutes, openAtLogin });

  const msg = document.getElementById("saved-msg");
  msg.classList.remove("hidden");
  setTimeout(() => msg.classList.add("hidden"), 2000);
}

document.getElementById("save-btn").addEventListener("click", saveSettings);
loadSettings();
