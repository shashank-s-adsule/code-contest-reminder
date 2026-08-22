# Architecture Plan

## Phase 1 — Chrome Extension (current)

### Data Flow
```
chrome.alarms (every 30min)
    └─▶ Background Worker
            ├─▶ Codeforces API  (official, no key)
            ├─▶ Kontests API    (LC + CodeChef + AtCoder)
            └─▶ chrome.storage.local (cache)
                    └─▶ Popup UI (reads cache, renders cards)
                    └─▶ Notification Scheduler (fires alarms per contest)
```

### Storage Schema
```js
// chrome.storage.local
{
  contests: Contest[],    // cached upcoming contests
  lastUpdated: number,    // timestamp of last poll
}

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

## Phase 2 — PWA
- Next.js app on Vercel
- Web Push Notifications via `web-push` npm package
- Users enter their handles to filter by platform
- Reuses shared/fetchers/ directly

## Phase 3 — Desktop (Electron)
- Wraps PWA frontend
- System tray icon with contest count badge
- Native OS notifications
- Auto-launch on startup
- Reuses same shared/fetchers/

## Milestones
| # | Goal | Status |
|---|---|---|
| 1 | Extension loads in Chrome, popup shows cached contests | 🚧 |
| 2 | Real notifications firing before CF contests | 📋 |
| 3 | All 4 platforms working | 📋 |
| 4 | Options page saves correctly | 📋 |
| 5 | Publish to Chrome Web Store | 📋 |
| 6 | PWA with web push | 📋 |
| 7 | Electron desktop widget | 📋 |
