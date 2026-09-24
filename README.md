# Contest Reminder 🏆

A cross-platform contest reminder tool for competitive programmers. Get notified before contests on **Codeforces**, **LeetCode**, **CodeChef**, and **AtCoder** — so you never miss a round. Also surfaces the daily challenge from **LeetCode** and **GeeksforGeeks**.

## Platforms Supported
- Codeforces
- LeetCode
- CodeChef
- AtCoder
- LeetCode Daily Challenge / GeeksforGeeks Problem of the Day

## Delivery Targets
| Target | Status | Folder |
|---|---|---|
| Browser Extension (Chrome) | 🚧 In Progress | `extension/` |
| Desktop Widget (Electron) | 🚧 In Progress | `desktop/` |

## Structure

```
contest-reminder/
├── extension/              # Chrome Extension (Manifest V3)
│   ├── manifest.json
│   ├── background/         # Service worker — polls APIs, fires notifications
│   ├── popup/              # UI shown when user clicks extension icon
│   ├── options/            # Settings page (platforms, reminder timing)
│   ├── assets/icons/       # Extension icons (16, 48, 128px)
│   └── shared/
│       └── fetchers/       # Platform API adapters — each hits the platform directly
│           ├── codeforces.js     # official public API
│           ├── leetcode.js       # leetcode.com's own GraphQL endpoint
│           ├── codechef.js       # codechef.com's own contests-list JSON endpoint
│           ├── atcoder.js        # scrapes atcoder.jp/contests/ (no public JSON API exists)
│           ├── leetcodeDaily.js  # LeetCode Daily Challenge (same GraphQL endpoint, different query)
│           ├── gfgDaily.js       # GeeksforGeeks Problem of the Day
│           └── fetchWithTimeout.js
├── desktop/                 # Electron desktop widget — tray icon + popup window
│   ├── main.js              # Main process: tray, windows, IPC, polling scheduler
│   ├── preload.cjs          # contextBridge — exposes a minimal `window.api` to the renderer
│   ├── renderer/
│   │   ├── popup.html/.css/.js    # Tray dropdown — same design as the extension popup
│   │   └── options.html/.css/.js  # Settings window
│   └── lib/
│       ├── fetchers/        # Same fetcher logic as the extension, copied in
│       ├── store.js         # JSON file persistence (chrome.storage equivalent)
│       ├── getData.js       # Polling + merge/fallback logic (mirrors worker.js)
│       └── notifications.js # Native OS notifications via setTimeout
├── Docs/
│   ├── Plan/               # Architecture decisions, milestones
│   └── to-do/              # Task list
└── .gitignore
```

> **Why `shared/` lives inside `extension/`, and why `desktop/` has its own copy:** a Chrome extension can only load files from within the folder you point "Load unpacked" at — it can't reach a sibling directory one level up, which is why `extension/shared/fetchers/` lives inside `extension/` rather than at the repo root. The desktop app isn't sandboxed that way, but keeps its own copy anyway for the same reason the (now-removed) PWA did: independent builds while both are still early. Revisit if a fetcher bug gets fixed in one copy and forgotten in another.

## Getting Started

### Load Extension in Chrome
1. Clone this repo
2. Open Chrome → `chrome://extensions`
3. Enable **Developer Mode** (top right toggle)
4. Click **Load unpacked** → select the `extension/` folder
5. Pin the extension and click it to see upcoming contests

No build step needed for the extension — pure vanilla JS.

### Run the Desktop Widget
```
cd desktop
npm install
npm start
```
This opens a small always-visible widget on your desktop (Rainmeter-style) showing contests and daily challenges — semi-transparent, no border/taskbar entry, drag the header to reposition it (remembered across restarts). A tray icon (system tray / menu bar depending on your OS) sits alongside it: click to show/hide the widget, right-click for Refresh/Settings/Quit. Settings and cache are stored in your OS's per-app data directory as a single JSON file (no cloud sync, unlike the extension's `chrome.storage.sync`).

