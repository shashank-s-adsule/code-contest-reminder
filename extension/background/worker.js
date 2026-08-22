/**
 * Background Service Worker
 * - Polls contest APIs every 30 minutes via chrome.alarms
 * - Caches results in chrome.storage.local
 * - Fires chrome.notifications before each contest
 */

import { fetchCodeforcesContests } from "../../shared/fetchers/codeforces.js";
import {
  fetchLeetCodeContests,
  fetchCodeChefContests,
  fetchAtCoderContests,
} from "../../shared/fetchers/kontests.js";

const POLL_ALARM = "poll-contests";
const POLL_INTERVAL_MINUTES = 30;

// ─── Startup ────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  console.log("[Worker] Extension installed — initializing.");

  // Set defaults if first install
  const existing = await chrome.storage.sync.get("settings");
  if (!existing.settings) {
    await chrome.storage.sync.set({
      settings: {
        platforms: {
          Codeforces: true,
          LeetCode: true,
          CodeChef: true,
          AtCoder: true,
        },
        reminderMinutes: [60, 15], // notify 1hr before and 15min before
      },
    });
  }

  // Create polling alarm
  chrome.alarms.create(POLL_ALARM, {
    delayInMinutes: 0,             // fire immediately on install
    periodInMinutes: POLL_INTERVAL_MINUTES,
  });
});

// ─── Alarm Handler ──────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === POLL_ALARM) {
    await pollAndCache();
    await scheduleNotifications();
  }

  // Individual contest notification alarms
  if (alarm.name.startsWith("notify-")) {
    const contestId = alarm.name.replace("notify-", "");
    await fireNotification(contestId);
  }
});

// ─── Polling ────────────────────────────────────────────────────────────────

async function pollAndCache() {
  const { settings } = await chrome.storage.sync.get("settings");
  const { platforms } = settings;

  const fetches = await Promise.allSettled([
    platforms.Codeforces ? fetchCodeforcesContests() : [],
    platforms.LeetCode   ? fetchLeetCodeContests()   : [],
    platforms.CodeChef   ? fetchCodeChefContests()   : [],
    platforms.AtCoder    ? fetchAtCoderContests()    : [],
  ]);

  const allContests = fetches
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => a.msUntilStart - b.msUntilStart);

  await chrome.storage.local.set({
    contests: allContests,
    lastUpdated: Date.now(),
  });

  console.log(`[Worker] Cached ${allContests.length} upcoming contests.`);
}

// ─── Notification Scheduling ─────────────────────────────────────────────────

async function scheduleNotifications() {
  const [{ contests = [] }, { settings }] = await Promise.all([
    chrome.storage.local.get("contests"),
    chrome.storage.sync.get("settings"),
  ]);

  const reminderOffsets = settings.reminderMinutes; // e.g. [60, 15]

  for (const contest of contests) {
    for (const offsetMins of reminderOffsets) {
      const triggerMs = new Date(contest.startTime) - offsetMins * 60 * 1000;
      const alarmName = `notify-${contest.id}-${offsetMins}`;

      if (triggerMs > Date.now()) {
        chrome.alarms.create(alarmName, {
          when: triggerMs,
        });
      }
    }
  }
}

// ─── Fire Notification ───────────────────────────────────────────────────────

async function fireNotification(alarmName) {
  // alarmName format: "cf-12345-60" → contestId = "cf-12345", offset = 60
  const parts = alarmName.split("-");
  const offsetMins = parseInt(parts[parts.length - 1]);
  const contestId = parts.slice(0, -1).join("-");

  const { contests = [] } = await chrome.storage.local.get("contests");
  const contest = contests.find((c) => c.id === contestId);
  if (!contest) return;

  const timeLabel =
    offsetMins >= 60 ? `${offsetMins / 60} hour(s)` : `${offsetMins} minutes`;

  chrome.notifications.create(`notif-${contestId}-${offsetMins}`, {
    type: "basic",
    iconUrl: "../assets/icons/icon48.png",
    title: `⏰ ${contest.platform} contest in ${timeLabel}!`,
    message: contest.name,
    buttons: [{ title: "Open Contest" }],
    priority: 2,
  });
}

// ─── Notification Click Handler ──────────────────────────────────────────────

chrome.notifications.onButtonClicked.addListener(async (notifId) => {
  // Extract contest id from notifId: "notif-cf-12345-60"
  const parts = notifId.replace("notif-", "").split("-");
  const offsetMins = parts[parts.length - 1];
  const contestId = parts.slice(0, -1).join("-");

  const { contests = [] } = await chrome.storage.local.get("contests");
  const contest = contests.find((c) => c.id === contestId);
  if (contest) chrome.tabs.create({ url: contest.url });
});
