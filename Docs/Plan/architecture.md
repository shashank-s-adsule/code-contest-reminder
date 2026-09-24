# Architecture Plan

## Phase 1 — Chrome Extension (built)

### Data Flow
```
chrome.alarms (every 30min)
    └─▶ Background Worker
            ├─▶ Codeforces API       (official, no key)
            ├─▶ LeetCode GraphQL     (leetcode.com/graphql, undocumented)
            ├─▶ CodeChef JSON API    (codechef.com/api/list/contests/all, undocumented)
            ├─▶ AtCoder page scrape  (atcoder.jp/contests/, no API exists)
            ├─▶ LeetCode Daily       (leetcode.com/graphql, different query)
            ├─▶ GfG Problem of Day   (practiceapi.geeksforgeeks.org, undocumented)
            └─▶ chrome.storage.local (cache)
                    └─▶ Popup UI (reads cache, renders cards + daily section)
                    └─▶ Notification Scheduler (fires alarms per contest)
```

### Popup UI
The popup shows a daily-challenge section on top, then one card per upcoming
contest (platform badge, type badge where the API gives a real division, live
countdown, start time, duration). Each card has an **Open →** link and a
**+ Cal** link that builds a Google Calendar quick-add URL
(`calendar.google.com/calendar/render?action=TEMPLATE&…` with the contest
name, UTC start/end and a link back). It's a plain link — no OAuth, no new
permission. A refresh button sends a `REPOLL` message to the worker and awaits
its response; a banner lists any platforms whose last fetch failed.

### Storage Schema
The desktop app uses the same shapes (see Phase 2) — `chrome.storage.local`
becomes top-level keys of `store.json`, and `chrome.storage.sync` becomes its
`settings` key.
```js
// chrome.storage.local
{
  contests: Contest[],    // cached upcoming contests
  lastUpdated: number,    // timestamp of last poll
  fetchErrors: {          // platforms whose last poll failed, mapped to when
    [platform: string]: number,
  },
  dailyQuestions: {       // today's daily challenge per platform
    LeetCode?: DailyQuestion,
    GeeksforGeeks?: DailyQuestion,
  },
  dailyErrors: {          // same shape as fetchErrors, for the daily fetchers
    [platform: string]: number,
  },
}
```

### Daily Question Schema
```js
{
  platform: string,       // "LeetCode" | "GeeksforGeeks"
  title: string,
  difficulty: string,     // "Easy" | "Medium" | "Hard"
  url: string,
  date: string,           // "YYYY-MM-DD"
}
```

```js
// chrome.storage.sync  (synced across devices)
{
  settings: {
    platforms: {
      Codeforces: boolean,
      LeetCode: boolean,
      CodeChef: boolean,
      AtCoder: boolean,
    },
    reminderMinutes: number[],  // subset of [1440, 60, 15]; default [60, 15]
  }
}
```

### Common Contest Schema
```js
{
  id: string,               // e.g. "cf-2063", "leetcode-abc123"
  platform: string,         // "Codeforces" | "LeetCode" | "CodeChef" | "AtCoder"
  name: string,
  startTime: string,        // ISO 8601
  durationMinutes: number,
  url: string,              // contest page
  registerUrl: string,      // direct registration link
  type: string,             // "Div 1", "Div 2", "Educational", etc.
  msUntilStart: number,     // ms from poll time (used for sorting only)
}
```

### On dropping kontests.net
v1 originally used kontests.net as a single aggregator for LeetCode/CodeChef/
AtCoder. It went unreachable for the duration of this build and has a history
of outages, so each platform now hits its own source directly instead:
LeetCode's GraphQL API, CodeChef's own contests-list JSON endpoint, and (since
AtCoder has no public API for upcoming contests) a scrape of AtCoder's own
contests page. The AtCoder scraper is the one piece that can silently break —
if AtCoder changes that page's markup, `fetchAtCoderContests()` throws and the
worker falls back to cached data rather than showing garbage.

## Phase 2 — Desktop App (built, runs from source)

### Decision: no PWA, extension + desktop only
A minimal Next.js PWA was scaffolded and verified working (same contest
list + daily challenges, server-rendered, no push/deployment) but was then
dropped: the plan going forward is just the Chrome extension plus a desktop
app, no separate web app in between. This means the desktop app is
**not** "wraps a PWA frontend" as originally planned — it needs its own UI,
built directly on the same fetcher logic the extension uses.

### Process model
```
Main process (main.js)                       Renderer (sandboxed, contextIsolation)
  ├─ setInterval(30 min) ─▶ pollAll()          app.html / app.js       ◀── window.api ──┐
  │     ├─ pollContests()  (lib/getData.js)    options.html / options.js  (preload.cjs)  │
  │     └─ pollDailyQuestions()                                                          │
  ├─ rescheduleNotifications() (setTimeout)                                              │
  ├─ store.json  (lib/store.js, userData dir)                                            │
  ├─ Tray  (click = show/hide, right-click = menu)                                       │
  └─ ipcMain: get-data · refresh · get-settings · save-settings · open-external ─────────┘
              open-options (one-way)  ·  data-updated (main ▶ renderer broadcast)
```
The renderer never touches Node or the filesystem: every capability it has is
one of the `window.api` methods in `preload.cjs`, and all outbound links go
through `open-external` (→ `shell.openExternal`, http/https only) instead of
opening a window inside the app.

### Decisions made
- **Framework: Electron.** No Rust/Cargo toolchain was available in the
  build environment (Tauri needs it, plus platform build tools), while
  Node/npm already worked reliably. Electron ships its own Chromium so
  building doesn't depend on anything OS-specific being pre-installed —
  the tradeoff is ~100MB+ installs per platform.
- **UI shape: a regular sidebar + detail window, tray-backed.** This is the
  *third* shape the desktop UI has had, so the history matters:
  1. tray-click popup (a port of the extension popup),
  2. an always-visible, frameless, transparent, always-on-top Rainmeter-style
     overlay (`widgetPosition` in `store.json`),
  3. **current:** a normal resizable window (default 1080×700, min 820×540,
     `backgroundColor #0b0d13`), replacing both. The overlay window code
     (frameless/transparent/`alwaysOnTop`/drag region, the hide button,
     `widgetPosition`) is gone; `renderer/popup.*` was renamed and rewritten
     as `renderer/app.*`.
  Layout: a **top bar** (logo, "Updated N min ago", Refresh, Settings), an
  **error banner** for failed platforms, a **sidebar** (Daily Challenge cards
  → Upcoming Contests rows with a platform-coloured accent and a live
  mini-countdown), and a **detail panel** for the selected contest (platform +
  type badges, title, large countdown, Starts/Duration/Ends grid, **+ Add to
  Calendar** and **Open Contest →** buttons, and up to 5 "More from
  <platform>" rows to jump between contests). The first visible contest is
  auto-selected; if the selected contest disappears after a refresh, selection
  falls back to the first visible one. Countdowns tick every second in the
  renderer via `[data-start]` elements — no re-render.
- **Tray-backed lifecycle.** Closing the window *hides* it
  (`close` → `preventDefault` + `hide()`), and a no-op `window-all-closed`
  handler stops Electron quitting, so polling and notifications continue in
  the background. The tray's **Quit** (sets `isQuitting`, then `app.quit()`)
  is the only real exit. Tray click toggles the window; right-click opens the
  menu (Show/Hide, Refresh, Settings, Quit). Window bounds are saved
  (debounced 400 ms on `moved`/`resized`) to `store.json`'s `windowBounds` and
  restored on next launch, centred on the primary display the first time.
  A single-instance lock prevents a second tray icon.
- **Fetcher reuse: own copy**, same tradeoff already made for the
  (now-removed) PWA — `desktop/lib/fetchers/` is a copy of
  `extension/shared/fetchers/`, not an import from it, kept independent
  while both targets are still early.

### Implementation notes
- **CommonJS, not ESM.** The main process was first written as ESM
  (`"type": "module"`), which seemed reasonable since the fetcher files
  (copied from the extension) already use `import`/`export`. This broke:
  `import { app } from "electron"` — and even `import electron from
  "electron"` with a manual destructure — both failed with `app` coming
  back `undefined`. Electron's special handling of the built-in `electron`
  module specifier doesn't reliably apply when the entry point loads as an
  ES module. Converted everything (`main.js`, `lib/*.js`, the copied
  fetchers) to CommonJS (`require`/`module.exports`); `preload.cjs` was
  already CommonJS by design. This is also just the better-trodden path —
  the overwhelming majority of real-world Electron apps are CommonJS.
- **No persistence dependency.** `electron-store` (the obvious choice) is
  ESM-only as of v11, which reintroduces the same interop problem. Used a
  ~40-line hand-rolled JSON file store (`lib/store.js`) instead — a single
  `store.json` in `app.getPath("userData")`, playing the role
  `chrome.storage.local`/`.sync` play in the extension.
- **Notifications use plain `setTimeout`**, not a `chrome.alarms`-style
  scheduler. The extension needs `chrome.alarms` because its service
  worker gets suspended and `setTimeout` wouldn't survive that; the desktop
  app's main process stays alive the whole time it's running, so
  `setTimeout` is simpler and just as reliable here.
- **Verified without launching the actual GUI.** The sandboxed shell used
  to build this sets `ELECTRON_RUN_AS_NODE=1`, which forces any Electron
  binary invocation into plain-Node-CLI mode instead of actually launching
  the app — almost certainly a deliberate guard against automated tool
  calls popping up real windows. So: the fetcher + store + polling logic
  was verified directly under Node (mocking only `electron.app.getPath`),
  confirming live data from all 4 contest platforms + both daily
  challenges with zero errors. The GUI and native notifications were
  afterwards confirmed by hand in a real `npm start` session (see
  `Docs/to-do/tasks.md`). Note that this confirmation predates the sidebar +
  detail redesign — the new window has been run by hand but has had no
  systematic pass (resize, tray hide/show round-trip, settings save while the
  window is open, etc.).
- **Desktop-only additions to settings.** `openAtLogin` (default `false`) is
  applied with `app.setLoginItemSettings()` at startup and on every settings
  save. Saving settings triggers an immediate re-poll + reschedule + broadcast,
  so toggling a platform or reminder offset takes effect without waiting for
  the next 30-min tick.

### Desktop store schema (`store.json` in `app.getPath("userData")`)
```js
{
  settings: {
    platforms: { Codeforces, LeetCode, CodeChef, AtCoder: boolean },
    reminderMinutes: number[],   // default [60, 15]
    openAtLogin: boolean,        // default false (desktop-only)
  },
  contests, lastUpdated, fetchErrors,       // same shapes as the extension's
  dailyQuestions, dailyErrors,              // chrome.storage.local
  windowBounds: { x, y, width, height },    // desktop-only
}
```
Loaded once into an in-memory cache; every `updateStore` merges a patch and
rewrites the whole file. Fine at this size (a few KB), but writes aren't
serialised — see the to-do list.

### Known limitations / risks
- **Fetcher duplication.** `desktop/lib/fetchers/` (CommonJS) and
  `extension/shared/fetchers/` (ESM) must be kept in sync by hand; there is no
  shared source or test that would catch drift. The AtCoder scraper is the most
  likely to need a fix.
- **No CSP** on the renderer HTML. Low risk today (no remote content is
  rendered, all text goes through `textContent`, sandbox + contextIsolation are
  on), but worth adding as defence in depth.
- **`open-external` trusts its argument's type** — it only checks the
  `http(s)://` prefix on a value that is assumed to be a string.
- **Daily rollover** is only as fresh as the 30-min poll, in both apps.
- **Notification timers** longer than ~24.8 days are skipped (32-bit
  `setTimeout` cap) and picked up by a later poll; reminders are lost if the
  app isn't running at trigger time (no catch-up on next launch).
- **Single-instance lock** quits the second process but there is no
  `second-instance` handler, so launching again doesn't bring the existing
  window to the front (and the second process may briefly run `whenReady`
  before quitting).

## Milestones
| # | Goal | Status |
|---|---|---|
| 1 | Extension loads in Chrome, popup shows cached contests | ✅ |
| 2 | Real notifications firing before CF contests | 🚧 (needs a real-browser soak test) |
| 3 | All 4 platforms working | ✅ |
| 4 | Options page saves correctly | ✅ (persistence across a browser restart still to be checked by hand) |
| 5 | Add-to-Google-Calendar + daily challenges in the extension | ✅ |
| 6 | Publish to Chrome Web Store | 📋 |
| 7 | Desktop app shell running (tray + window, reusing fetcher logic) | ✅ |
| 8 | Desktop app shows live contests + daily challenges | ✅ |
| 9 | Native OS notifications firing from the desktop app | ✅ (user-verified; not re-verified after the redesign) |
| 10 | Desktop UI redesigned as sidebar + detail window | ✅ (needs a systematic manual pass) |
| 11 | Installable desktop builds (Win / Linux / Mac) | 📋 (config exists, never run) |
| 12 | Tests / CI covering fetchers | 📋 (none exist) |
