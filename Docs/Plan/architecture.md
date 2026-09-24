# Architecture Plan

## Phase 1 — Chrome Extension (current)

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

### Storage Schema
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
    reminderMinutes: number[],  // e.g. [1440, 60, 15]
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

## Phase 2 — Desktop Widget

### Decision: no PWA, extension + desktop only
A minimal Next.js PWA was scaffolded and verified working (same contest
list + daily challenges, server-rendered, no push/deployment) but was then
dropped: the plan going forward is just the Chrome extension plus a desktop
widget, no separate web app in between. This means the desktop widget is
**not** "wraps a PWA frontend" as originally planned — it needs its own UI,
built directly on the same fetcher logic the extension uses.

### Decisions made
- **Framework: Electron.** No Rust/Cargo toolchain was available in the
  build environment (Tauri needs it, plus platform build tools), while
  Node/npm already worked reliably. Electron ships its own Chromium so
  building doesn't depend on anything OS-specific being pre-installed —
  the tradeoff is ~100MB+ installs per platform.
- **Widget shape: always-visible desktop overlay, Rainmeter-style** —
  not a tray-click popup (the first version built this way; changed after
  the user compared it to their Rainmeter task/note widgets). The window
  is frameless, transparent (semi-transparent "glass" card via CSS, not the
  OS chrome), `alwaysOnTop` at the `"floating"` level, draggable by its
  header (`-webkit-app-region: drag`), and its position persists across
  restarts (`store.json`'s `widgetPosition`). A tray icon still exists
  alongside it — click toggles show/hide, right-click gives a context menu
  (Show/Hide, Refresh, Settings, Quit) — as a way to get the widget back if
  it's ever hidden. This reused the extension's existing popup UI almost
  entirely; only the header (drag region + a hide button) and the window's
  own creation logic in `main.js` changed.
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
  challenges with zero errors. The tray icon, popup window, and native
  notifications themselves still need a real `npm start` in an actual
  terminal to confirm.

## Milestones
| # | Goal | Status |
|---|---|---|
| 1 | Extension loads in Chrome, popup shows cached contests | ✅ |
| 2 | Real notifications firing before CF contests | 🚧 (needs a real-browser soak test) |
| 3 | All 4 platforms working | ✅ |
| 4 | Options page saves correctly | ✅ |
| 5 | Publish to Chrome Web Store | 📋 |
| 6 | Desktop widget shell running (tray icon + popup, reusing fetcher logic) | 🚧 (data/store layer verified; GUI needs a manual `npm start`) |
| 7 | Desktop widget shows live contests + daily challenges | 🚧 (verified at the data layer, not yet seen in the actual window) |
| 8 | Native OS notifications firing from the desktop widget | 📋 (scheduling logic written, unverified — needs a real run) |
