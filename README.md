# Contest Reminder 🏆

A cross-platform contest reminder tool for competitive programmers. Get notified before contests on **Codeforces**, **LeetCode**, **CodeChef**, and **AtCoder** — so you never miss a round. Also surfaces the daily challenge from **LeetCode** and **GeeksforGeeks**.

Ships as two independent apps that share the same data logic: a **Chrome extension** and an **Electron desktop app**.

## Features
- Upcoming contests from 4 platforms, sorted by start time, with a live countdown (turns orange < 3h, red < 1h)
- Daily challenge section — LeetCode Daily + GeeksforGeeks Problem of the Day, with difficulty badges
- Native notifications before each contest (choose any of: 1 day / 1 hour / 15 min before; default 1 hour + 15 min)
- One-click **Add to Google Calendar** for any contest (plain link, no sign-in or API)
- Per-platform on/off toggles
- Graceful failure: if one platform is down, its last cached contests are still shown with a "showing last known data" banner — one dead API never blocks the others
- Desktop only: launch at login, window size/position remembered, runs in the background from the system tray

## Platforms Supported
- Codeforces
- LeetCode
- CodeChef
- AtCoder
- LeetCode Daily Challenge / GeeksforGeeks Problem of the Day

## Delivery Targets
| Target | Status | Folder |
|---|---|---|
| Browser Extension (Chrome) | ✅ Working — needs a real-browser soak test, not yet on the Web Store | `extension/` |
| Desktop App (Electron) | ✅ Working from source — no installable build yet | `desktop/` |

## Structure

```
contest-reminder/
├── extension/              # Chrome Extension (Manifest V3)
│   ├── manifest.json
│   ├── background/         # Service worker — polls APIs, schedules alarms, fires notifications
│   ├── popup/              # UI shown when user clicks extension icon
│   ├── options/            # Settings page (platforms, reminder timing)
│   ├── assets/icons/       # Extension icons (PNG 16/48/128 + SVGs used in the UI)
│   └── shared/
│       └── fetchers/       # Platform API adapters — each hits the platform directly
│           ├── codeforces.js     # official public API
│           ├── leetcode.js       # leetcode.com's own GraphQL endpoint
│           ├── codechef.js       # codechef.com's own contests-list JSON endpoint
│           ├── atcoder.js        # scrapes atcoder.jp/contests/ (no public JSON API exists)
│           ├── leetcodeDaily.js  # LeetCode Daily Challenge (same GraphQL endpoint, different query)
│           ├── gfgDaily.js       # GeeksforGeeks Problem of the Day
│           └── fetchWithTimeout.js
├── desktop/                # Electron desktop app — sidebar + detail window, tray-backed
│   ├── main.js             # Main process: window, tray, IPC, polling scheduler
│   ├── preload.cjs         # contextBridge — exposes a minimal `window.api` to the renderer
│   ├── renderer/
│   │   ├── app.html/.css/.js      # Main window: topbar, sidebar (daily + contest list), detail panel
│   │   └── options.html/.css/.js  # Settings window
│   ├── lib/
│   │   ├── fetchers/        # Same fetcher logic as the extension, copied in (CommonJS)
│   │   ├── store.js         # JSON file persistence (chrome.storage equivalent)
│   │   ├── getData.js       # Polling + merge/fallback logic (mirrors worker.js)
│   │   └── notifications.js # Native OS notifications via setTimeout
│   └── assets/icons/        # Window + tray icons
├── Docs/
│   ├── Plan/               # Architecture decisions, data schemas, milestones
│   └── to-do/              # Task list, open items and next steps
└── .gitignore
```

> **Why `shared/` lives inside `extension/`, and why `desktop/` has its own copy:** a Chrome extension can only load files from within the folder you point "Load unpacked" at — it can't reach a sibling directory one level up, which is why `extension/shared/fetchers/` lives inside `extension/` rather than at the repo root. The desktop app isn't sandboxed that way, but keeps its own copy anyway so the two targets can be built independently while both are still early. **Trade-off:** a fetcher bug fixed in one copy has to be fixed in the other by hand — see the to-do list.

## Getting Started

### Load Extension in Chrome
1. Clone this repo
2. Open Chrome → `chrome://extensions`
3. Enable **Developer Mode** (top right toggle)
4. Click **Load unpacked** → select the `extension/` folder
5. Pin the extension and click it to see upcoming contests

No build step needed for the extension — pure vanilla JS. Settings live in `chrome.storage.sync` (follow you across Chrome profiles); the contest/daily cache lives in `chrome.storage.local`.

### Run the Desktop App
```
cd desktop
npm install
npm start
```
Opens a normal resizable window:

- **Top bar** — last-updated time, Refresh, Settings
- **Sidebar** — today's daily challenges (LeetCode, GfG) on top, then the list of upcoming contests
- **Detail panel** — select a contest to see its countdown, start/end/duration, **+ Add to Calendar** and **Open Contest →**, plus other upcoming contests from the same platform

Closing the window **hides it to the system tray** rather than quitting, so polling and notifications keep running in the background. Click the tray icon to show/hide the window; right-click for Show/Hide, Refresh, Settings and Quit (Quit is the only real exit). Only one instance can run at a time.

Window size and position, settings, and the contest cache are stored as a single `store.json` in your OS's per-app data directory (no cloud sync, unlike the extension's `chrome.storage.sync`).

### Build an installer (untested)
`electron-builder` is configured in `desktop/package.json` (NSIS for Windows, AppImage for Linux, a productivity category for macOS) but has not been run yet. Each OS generally has to be built on that OS.

## How it works
Both apps poll every **30 minutes** (and on manual refresh). Each platform is fetched independently with an 8-second timeout via `Promise.allSettled`, results are merged and sorted by start time, cached, and then per-contest reminders are scheduled — `chrome.alarms` in the extension (a service worker gets suspended, so `setTimeout` wouldn't survive), plain `setTimeout` in the desktop app (its main process stays alive). Full details, schemas and design decisions are in [`Docs/Plan/architecture.md`](Docs/Plan/architecture.md).

## Status & Roadmap
See [`Docs/to-do/tasks.md`](Docs/to-do/tasks.md) for the full checklist, including what's done, what's still unverified, and what's next.
