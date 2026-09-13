# Contest Reminder 🏆

A cross-platform contest reminder tool for competitive programmers. Get notified before contests on **Codeforces**, **LeetCode**, **CodeChef**, and **AtCoder** — so you never miss a round.

## Platforms Supported
- Codeforces
- LeetCode
- CodeChef
- AtCoder

## Delivery Targets
| Target | Status | Folder |
|---|---|---|
| Browser Extension (Chrome) | 🚧 In Progress | `extension/` |
| PWA (Web App) | 📋 Planned | `pwa/` |
| Desktop Widget (Electron) | 📋 Planned | `desktop/` |

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
│           └── fetchWithTimeout.js
├── Docs/
│   ├── Plan/               # Architecture decisions, milestones
│   └── to-do/              # Task list
└── .gitignore
```

> **Why `shared/` lives inside `extension/`:** a Chrome extension can only load files from within the folder you point "Load unpacked" at — it can't reach a sibling directory one level up. `shared/fetchers/` used to sit next to `extension/` at the repo root (for reuse by the planned PWA/Electron targets), but that broke the extension's own service worker imports. When Phase 2/3 actually get built, revisit whether to hoist `shared/` back to the root with a small copy/symlink step, or just duplicate it — for now, correctness for the one target that exists wins.

## Getting Started

### Load Extension in Chrome
1. Clone this repo
2. Open Chrome → `chrome://extensions`
3. Enable **Developer Mode** (top right toggle)
4. Click **Load unpacked** → select the `extension/` folder
5. Pin the extension and click it to see upcoming contests

### Development
No build step needed for v1 — pure vanilla JS.
```

