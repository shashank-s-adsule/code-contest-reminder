/**
 * Contest reminder notifications.
 * Unlike the extension (chrome.alarms survives a suspended service worker),
 * the desktop app's main process stays alive the whole time it's running,
 * so plain setTimeout is actually simpler and just as reliable here — no
 * need to re-derive "which alarms already exist" the way worker.js does.
 */
const { Notification, shell } = require("electron");
const { getStore, getSettings } = require("./store.js");

let scheduledTimers = [];

function clearScheduled() {
  for (const t of scheduledTimers) clearTimeout(t);
  scheduledTimers = [];
}

function formatOffset(offsetMins) {
  return offsetMins >= 60 ? `${offsetMins / 60} hour(s)` : `${offsetMins} minutes`;
}

async function rescheduleNotifications() {
  clearScheduled();

  const [store, settings] = await Promise.all([getStore(), getSettings()]);
  const contests = store.contests || [];
  const reminderOffsets = settings.reminderMinutes;
  const now = Date.now();

  for (const contest of contests) {
    for (const offsetMins of reminderOffsets) {
      const triggerMs = new Date(contest.startTime).getTime() - offsetMins * 60 * 1000;
      const delay = triggerMs - now;

      // setTimeout has a 32-bit signed int cap (~24.8 days) — skip anything
      // further out than that; it'll get rescheduled on a later poll anyway.
      if (delay > 0 && delay < 2_147_000_000) {
        const timer = setTimeout(() => fireNotification(contest, offsetMins), delay);
        scheduledTimers.push(timer);
      }
    }
  }
}

function fireNotification(contest, offsetMins) {
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title: `⏰ ${contest.platform} contest in ${formatOffset(offsetMins)}!`,
    body: contest.name,
    silent: false,
  });

  notification.on("click", () => shell.openExternal(contest.url));
  notification.show();
}

module.exports = { rescheduleNotifications };
