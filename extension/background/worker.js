/**
 * Background Service Worker
 * - Polls contest APIs every 30 minutes via chrome.alarms
 * - Caches results in chrome.storage.local
 * - Fires chrome.notifications before each contest
 */

import { fetchCodeforcesContests } from "../shared/fetchers/codeforces.js";
import { fetchLeetCodeContests } from "../shared/fetchers/leetcode.js";
import { fetchCodeChefContests } from "../shared/fetchers/codechef.js";
import { fetchAtCoderContests } from "../shared/fetchers/atcoder.js";

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

const PLATFORM_ORDER = ["Codeforces", "LeetCode", "CodeChef", "AtCoder"];
const FETCHERS = {
  Codeforces: fetchCodeforcesContests,
  LeetCode: fetchLeetCodeContests,
  CodeChef: fetchCodeChefContests,
  AtCoder: fetchAtCoderContests,
};

async function pollAndCache() {
  const { settings } = await chrome.storage.sync.get("settings");
  const { platforms } = settings;
  const { contests: prevContests = [] } = await chrome.storage.local.get("contests");

  const results = await Promise.allSettled(
    PLATFORM_ORDER.map((p) => (platforms[p] ? FETCHERS[p]() : Promise.resolve([])))
  );

  const fetchErrors = {};
  const now = Date.now();
  const merged = [];

  results.forEach((result, i) => {
    const platform = PLATFORM_ORDER[i];
    if (!platforms[platform]) return;

    if (result.status === "fulfilled") {
      merged.push(...result.value);
    } else {
      // Fetch failed — fall back to whatever we still have cached for this
      // platform rather than dropping it from the popup entirely.
      console.error(`[Worker] ${platform} fetch failed:`, result.reason);
      fetchErrors[platform] = now;
      merged.push(
        ...prevContests
          .filter((c) => c.platform === platform && new Date(c.startTime) > now)
          .map((c) => ({ ...c, msUntilStart: new Date(c.startTime) - now }))
      );
    }
  });

  merged.sort((a, b) => a.msUntilStart - b.msUntilStart);

  await chrome.storage.local.set({
    contests: merged,
    lastUpdated: now,
    fetchErrors,
  });

  console.log(`[Worker] Cached ${merged.length} upcoming contests.`);
}

// ─── Notification Scheduling ─────────────────────────────────────────────────

async function scheduleNotifications() {
  const [{ contests = [] }, { settings }] = await Promise.all([
    chrome.storage.local.get("contests"),
    chrome.storage.sync.get("settings"),
  ]);

  // Drop any leftover per-contest alarms (contest ended, got un-cached, or its
  // reminder offsets changed) before scheduling fresh ones, so orphaned alarms
  // don't pile up indefinitely.
  const existingAlarms = await chrome.alarms.getAll();
  await Promise.all(
    existingAlarms
      .filter((a) => a.name.startsWith("notify-"))
      .map((a) => chrome.alarms.clear(a.name))
  );

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

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "REPOLL") {
    pollAndCache()
      .then(scheduleNotifications)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // keep the message channel open for the async response
  }
});

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
