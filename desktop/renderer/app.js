/**
 * App renderer — sidebar (daily challenge + upcoming contest list) and a
 * detail panel for the selected contest. Talks to the main process via the
 * `api` bridge (preload.cjs) instead of chrome.storage / chrome.runtime.
 */

const contestList  = document.getElementById("contest-list");
const emptyState   = document.getElementById("empty-state");
const loadingState = document.getElementById("loading-state");
const errorBanner  = document.getElementById("error-banner");
const lastUpdated  = document.getElementById("last-updated");
const refreshBtn   = document.getElementById("refresh-btn");
const settingsBtn  = document.getElementById("settings-btn");
const dailySection = document.getElementById("daily-section");
const dailyCards   = document.getElementById("daily-cards");
const detailPanel  = document.getElementById("detail-panel");

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

function urgencyClass(ms) {
  return ms < 3600_000 ? "urgent" : ms < 10800_000 ? "soon" : "";
}

function formatDuration(minutes) {
  if (!minutes) return "—";
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

// ─── State ──────────────────────────────────────────────────────────────────

let contests = [];
let settings = { platforms: {} };
let selectedId = null;

function visibleContests() {
  return contests.filter((c) => !settings?.platforms || settings.platforms[c.platform] !== false);
}

// ─── Sidebar: Contest List ──────────────────────────────────────────────────

function buildSidebarRow(contest) {
  const ms = new Date(contest.startTime) - Date.now();

  const row = document.createElement("button");
  row.type = "button";
  row.className = `contest-row badge-accent-${contest.platform}${contest.id === selectedId ? " active" : ""}`;
  row.dataset.contestId = contest.id;

  const top = document.createElement("div");
  top.className = "row-top";

  const platformBadge = document.createElement("span");
  platformBadge.className = `platform-badge badge-${contest.platform}`;
  platformBadge.textContent = contest.platform;

  const countdown = document.createElement("span");
  countdown.className = `countdown-mini ${urgencyClass(ms)}`;
  countdown.dataset.start = contest.startTime;
  countdown.textContent = formatCountdown(ms);

  top.append(platformBadge, countdown);

  const name = document.createElement("div");
  name.className = "row-name";
  name.textContent = contest.name;

  row.append(top, name);
  row.addEventListener("click", () => selectContest(contest.id));
  return row;
}

function renderSidebarList() {
  contestList.innerHTML = "";
  const visible = visibleContests();

  if (visible.length === 0) {
    emptyState.classList.remove("hidden");
    contestList.classList.add("hidden");
  } else {
    emptyState.classList.add("hidden");
    contestList.classList.remove("hidden");
    for (const contest of visible) {
      contestList.appendChild(buildSidebarRow(contest));
    }
  }
}

// ─── Detail Panel ───────────────────────────────────────────────────────────

function buildDetailInfoCell(label, value) {
  const cell = document.createElement("div");
  cell.className = "info-cell";
  const l = document.createElement("div");
  l.className = "info-label";
  l.textContent = label;
  const v = document.createElement("div");
  v.className = "info-value";
  v.textContent = value;
  cell.append(l, v);
  return cell;
}

function buildRelatedRow(contest) {
  const ms = new Date(contest.startTime) - Date.now();
  const row = document.createElement("button");
  row.type = "button";
  row.className = "related-row";
  const name = document.createElement("span");
  name.className = "related-name";
  name.textContent = contest.name;
  const countdown = document.createElement("span");
  countdown.className = `countdown-mini ${urgencyClass(ms)}`;
  countdown.dataset.start = contest.startTime;
  countdown.textContent = formatCountdown(ms);
  row.append(name, countdown);
  row.addEventListener("click", () => selectContest(contest.id));
  return row;
}

function renderDetail() {
  detailPanel.innerHTML = "";

  const visible = visibleContests();
  const contest = visible.find((c) => c.id === selectedId);

  if (!contest) {
    const placeholder = document.createElement("div");
    placeholder.className = "detail-placeholder";
    placeholder.innerHTML = `<p>👈 Select a contest to see details</p>`;
    detailPanel.appendChild(placeholder);
    return;
  }

  const ms = new Date(contest.startTime) - Date.now();
  const end = new Date(new Date(contest.startTime).getTime() + (contest.durationMinutes || 0) * 60000);

  const header = document.createElement("div");
  header.className = "detail-header";

  const badges = document.createElement("div");
  badges.className = "badge-group";
  const platformBadge = document.createElement("span");
  platformBadge.className = `platform-badge badge-${contest.platform}`;
  platformBadge.textContent = contest.platform;
  badges.appendChild(platformBadge);
  if (contest.type && contest.type !== "Other" && contest.type !== contest.name) {
    const typeBadge = document.createElement("span");
    typeBadge.className = "type-badge";
    typeBadge.textContent = contest.type;
    badges.appendChild(typeBadge);
  }

  const name = document.createElement("h1");
  name.className = "detail-name";
  name.textContent = contest.name;

  header.append(badges, name);

  const countdown = document.createElement("div");
  countdown.className = `detail-countdown ${urgencyClass(ms)}`;
  countdown.dataset.start = contest.startTime;
  countdown.textContent = formatCountdown(ms);

  const infoGrid = document.createElement("div");
  infoGrid.className = "info-grid";
  infoGrid.append(
    buildDetailInfoCell("Starts", formatStartTime(contest.startTime)),
    buildDetailInfoCell("Duration", formatDuration(contest.durationMinutes)),
    buildDetailInfoCell("Ends", formatStartTime(end.toISOString())),
  );

  const actions = document.createElement("div");
  actions.className = "detail-actions";
  const calendarBtn = makeExternalLink("a", buildGoogleCalendarUrl(contest));
  calendarBtn.className = "action-btn calendar-btn";
  calendarBtn.textContent = "+ Add to Calendar";
  const openBtn = makeExternalLink("a", safeUrl(contest.url));
  openBtn.className = "action-btn primary-btn";
  openBtn.textContent = "Open Contest →";
  actions.append(calendarBtn, openBtn);

  detailPanel.append(header, countdown, infoGrid, actions);

  const related = visible
    .filter((c) => c.platform === contest.platform && c.id !== contest.id)
    .slice(0, 5);

  if (related.length > 0) {
    const relatedSection = document.createElement("div");
    relatedSection.className = "related-section";
    const relatedLabel = document.createElement("div");
    relatedLabel.className = "sidebar-label";
    relatedLabel.textContent = `More from ${contest.platform}`;
    relatedSection.appendChild(relatedLabel);
    for (const c of related) {
      relatedSection.appendChild(buildRelatedRow(c));
    }
    detailPanel.appendChild(relatedSection);
  }
}

function selectContest(id) {
  selectedId = id;
  renderSidebarList();
  renderDetail();
}

// ─── Daily Challenge ────────────────────────────────────────────────────────

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
  const countdownEls = document.querySelectorAll("[data-start]");
  for (const el of countdownEls) {
    const ms = new Date(el.dataset.start) - Date.now();
    const urgency = urgencyClass(ms);
    el.textContent = formatCountdown(ms);
    el.className = el.className.replace(/\b(urgent|soon)\b/g, "").trim();
    if (urgency) el.classList.add(urgency);
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

    const visible = visibleContests();
    if (!visible.some((c) => c.id === selectedId)) {
      selectedId = visible[0]?.id ?? null;
    }
    renderSidebarList();
    renderDetail();
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

// ─── Init ────────────────────────────────────────────────────────────────────

async function init() {
  await loadFromMain();
  setInterval(tickCountdowns, 1000);
  window.api.onDataUpdated((data) => applyData(data));
}

init();
