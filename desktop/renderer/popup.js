/**
 * Popup renderer — same structure as extension/popup/popup.js, adapted to
 * talk to the main process via the `api` bridge (preload.cjs) instead of
 * chrome.storage / chrome.runtime.
 */

const contestList  = document.getElementById("contest-list");
const emptyState   = document.getElementById("empty-state");
const loadingState = document.getElementById("loading-state");
const errorBanner  = document.getElementById("error-banner");
const lastUpdated  = document.getElementById("last-updated");
const refreshBtn   = document.getElementById("refresh-btn");
const settingsBtn  = document.getElementById("settings-btn");
const hideBtn      = document.getElementById("hide-btn");
const dailySection = document.getElementById("daily-section");
const dailyCards   = document.getElementById("daily-cards");

const DAILY_PLATFORM_ORDER = ["LeetCode", "GeeksforGeeks"];

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function formatDuration(minutes) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatStartTime(isoString) {
  return new Date(isoString).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? url : "#";
  } catch {
    return "#";
  }
}

function buildGoogleCalendarUrl(contest) {
  const start = new Date(contest.startTime);
  const end = new Date(start.getTime() + (contest.durationMinutes || 0) * 60000);
  const toGCalDate = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${contest.platform}: ${contest.name}`,
    dates: `${toGCalDate(start)}/${toGCalDate(end)}`,
    details: `${contest.platform} contest — ${contest.name}\n${contest.url}`,
    location: contest.url,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Every outbound link goes through the main process's shell.openExternal
 * rather than a plain <a target="_blank">, which in a sandboxed Electron
 * renderer would just try to open another window inside the app. */
function makeExternalLink(tag, href) {
  const el = document.createElement(tag);
  el.href = href;
  el.addEventListener("click", (e) => {
    e.preventDefault();
    window.api.openExternal(href);
  });
  return el;
}

// ─── Render ─────────────────────────────────────────────────────────────────

let contests = [];
let settings = { platforms: {} };

function buildCard(contest) {
  const ms = new Date(contest.startTime) - Date.now();
  const urgencyClass = ms < 3600_000 ? "urgent" : ms < 10800_000 ? "soon" : "";

  const card = document.createElement("div");
  card.className = "contest-card";
  card.dataset.contestId = contest.id;

  const top = document.createElement("div");
  top.className = "card-top";

  const name = document.createElement("span");
  name.className = "contest-name";
  name.textContent = contest.name;

  const badgeGroup = document.createElement("div");
  badgeGroup.className = "badge-group";

  const platformBadge = document.createElement("span");
  platformBadge.className = `platform-badge badge-${contest.platform}`;
  platformBadge.textContent = contest.platform;
  badgeGroup.appendChild(platformBadge);

  if (contest.type && contest.type !== "Other" && contest.type !== contest.name) {
    const typeBadge = document.createElement("span");
    typeBadge.className = "type-badge";
    typeBadge.textContent = contest.type;
    badgeGroup.appendChild(typeBadge);
  }

  top.append(name, badgeGroup);

  const bottom = document.createElement("div");
  bottom.className = "card-bottom";

  const left = document.createElement("div");
  const countdown = document.createElement("div");
  countdown.className = `countdown ${urgencyClass}`;
  countdown.dataset.start = contest.startTime;
  countdown.textContent = formatCountdown(ms);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `${formatStartTime(contest.startTime)} · ${formatDuration(contest.durationMinutes)}`;

  left.append(countdown, meta);

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const calendarBtn = makeExternalLink("a", buildGoogleCalendarUrl(contest));
  calendarBtn.className = "open-btn calendar-btn";
  calendarBtn.title = "Add to Google Calendar";
  calendarBtn.textContent = "+ Cal";

  const openBtn = makeExternalLink("a", safeUrl(contest.url));
  openBtn.className = "open-btn";
  openBtn.textContent = "Open →";

  actions.append(calendarBtn, openBtn);
  bottom.append(left, actions);
  card.append(top, bottom);
  return card;
}

function renderContests() {
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
    contestList.appendChild(buildCard(contest));
  }
}

function buildDailyCard(daily) {
  const card = makeExternalLink("a", safeUrl(daily.url));
  card.className = "daily-card";

  const top = document.createElement("div");
  top.className = "daily-card-top";

  const platformBadge = document.createElement("span");
  platformBadge.className = `platform-badge badge-${daily.platform}`;
  platformBadge.textContent = daily.platform;
  top.appendChild(platformBadge);

  if (daily.difficulty) {
    const diffBadge = document.createElement("span");
    diffBadge.className = `difficulty-badge difficulty-${daily.difficulty}`;
    diffBadge.textContent = daily.difficulty;
    top.appendChild(diffBadge);
  }

  const title = document.createElement("div");
  title.className = "daily-title";
  title.textContent = daily.title;

  card.append(top, title);
  return card;
}

function renderDaily(dailyQuestions) {
  dailyCards.innerHTML = "";
  const available = DAILY_PLATFORM_ORDER.filter((p) => dailyQuestions?.[p]);

  if (available.length === 0) {
    dailySection.classList.add("hidden");
    return;
  }

  dailySection.classList.remove("hidden");
  for (const platform of available) {
    dailyCards.appendChild(buildDailyCard(dailyQuestions[platform]));
  }
}

function renderErrorBanner(fetchErrors, dailyErrors) {
  const failed = [...new Set([
    ...Object.keys(fetchErrors || {}),
    ...Object.keys(dailyErrors || {}),
  ])];
  if (failed.length === 0) {
    errorBanner.classList.add("hidden");
    errorBanner.textContent = "";
    return;
  }
  errorBanner.textContent = `⚠️ Couldn't refresh ${failed.join(", ")} — showing last known data.`;
  errorBanner.classList.remove("hidden");
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

// ─── Data Loading ───────────────────────────────────────────────────────────

function applyData(data) {
  const { contests: cached = [], lastUpdated: ts, fetchErrors, dailyQuestions, dailyErrors } = data || {};
  contests = cached;

  if (ts) {
    const ago = Math.floor((Date.now() - ts) / 60000);
    lastUpdated.textContent = ago < 1 ? "Updated just now" : `Updated ${ago} min ago`;
  }

  renderDaily(dailyQuestions);
  renderErrorBanner(fetchErrors, dailyErrors);

  if (cached.length === 0 && !ts) {
    loadingState.classList.remove("hidden");
    contestList.classList.add("hidden");
  } else {
    loadingState.classList.add("hidden");
    contestList.classList.remove("hidden");
    renderContests();
  }
}

async function loadFromMain() {
  const [data, loadedSettings] = await Promise.all([window.api.getData(), window.api.getSettings()]);
  settings = loadedSettings;
  applyData(data);
}

// ─── Refresh Button ─────────────────────────────────────────────────────────

async function handleRefresh() {
  refreshBtn.disabled = true;
  refreshBtn.classList.add("spinning");
  try {
    const data = await window.api.refresh();
    applyData(data);
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.classList.remove("spinning");
  }
}

refreshBtn.addEventListener("click", handleRefresh);
settingsBtn.addEventListener("click", () => window.api.openOptions());
hideBtn.addEventListener("click", () => window.api.hideWidget());

// ─── Init ────────────────────────────────────────────────────────────────────

async function init() {
  await loadFromMain();
  setInterval(tickCountdowns, 1000);
  window.api.onDataUpdated((data) => applyData(data));
}

init();
