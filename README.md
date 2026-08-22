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
│   └── assets/icons/       # Extension icons (16, 48, 128px)
├── shared/
│   └── fetchers/           # Platform API adapters (shared across all targets)
│       ├── codeforces.js
│       ├── leetcode.js
│       ├── codechef.js
│       └── atcoder.js
├── Docs/
│   ├── Plan/               # Architecture decisions, milestones
│   └── to-do/              # Task list
└── .gitignore
```

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

