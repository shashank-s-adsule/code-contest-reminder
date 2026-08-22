/**
 * Popup Script
 * Reads cached contests from chrome.storage.local and renders them.
 * Updates countdowns every second live.
 */

const contestList = document.getElementById("contest-list");
const emptyState  = document.getElementById("empty-state");
const lastUpdated = document.getElementById("last-updated");

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Format milliseconds into a human-readable countdown string.
 */
function formatCountdown(ms) {
  if (ms <= 0) return "Starting now!";

  const totalSeconds = Math.floor(ms / 1000);
  const days    = Math.floor(totalSeconds / 86400);
  const hours   = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0)  return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

/**
 * Format duration from minutes to "Xh Ym" or "Xm".
 */
function formatDuration(minutes) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/**
 * Format absolute date/time in local timezone.
 */
function formatStartTime(isoString) {
  return new Date(isoString).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Render ─────────────────────────────────────────────────────────────────

let contests = [];

function renderContests() {
  const { settings } = window.__settings__ || { settings: { platforms: {} } };
  contestList.innerHTML = "";

  const visible = contests.filter(
    (c) => !settings?.platforms || settings.platforms[c.platform] !== false
  );

  if (visible.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  for (const contest of visible) {
    const ms = new Date(contest.startTime) - Date.now();
    const countdown = formatCountdown(ms);
    const urgencyClass = ms < 3600_000 ? "urgent" : ms < 10800_000 ? "soon" : "";

    const card = document.createElement("div");
    card.className = "contest-card";
    card.dataset.contestId = contest.id;
    card.innerHTML = `
      <div class="card-top">
        <span class="contest-name">${contest.name}</span>
        <span class="platform-badge badge-${contest.platform}">${contest.platform}</span>
      </div>
      <div class="card-bottom">
        <div>
          <div class="countdown ${urgencyClass}" data-start="${contest.startTime}">
            ${countdown}
          </div>
          <div class="meta">${formatStartTime(contest.startTime)} · ${formatDuration(contest.durationMinutes)}</div>
        </div>
        <a class="open-btn" href="${contest.url}" target="_blank">Open →</a>
      </div>
    `;
    contestList.appendChild(card);
  }
}

// ─── Live Countdown Update ───────────────────────────────────────────────────

function tickCountdowns() {
  const countdownEls = document.querySelectorAll(".countdown[data-start]");
  for (const el of countdownEls) {
    const ms = new Date(el.dataset.start) - Date.now();
    el.textContent = formatCountdown(ms);
    el.className = `countdown ${ms < 3600_000 ? "urgent" : ms < 10800_000 ? "soon" : ""}`;
  }
}

// ─── Init ────────────────────────────────────────────────────────────────────

async function init() {
  const [{ contests: cached = [], lastUpdated: ts }, { settings }] =
    await Promise.all([
      chrome.storage.local.get(["contests", "lastUpdated"]),
      chrome.storage.sync.get("settings"),
    ]);

  window.__settings__ = { settings };
  contests = cached;

  if (ts) {
    const ago = Math.floor((Date.now() - ts) / 60000);
    lastUpdated.textContent = ago < 1
      ? "Updated just now"
      : `Updated ${ago} min ago`;
  }

  renderContests();
  setInterval(tickCountdowns, 1000);
}

init();
