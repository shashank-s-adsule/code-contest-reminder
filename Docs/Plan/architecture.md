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

## Phase 2 — PWA
- Next.js app on Vercel
- Web Push Notifications via `web-push` npm package
- Users enter their handles to filter by platform
- `extension/shared/fetchers/` currently lives inside `extension/` because a
  Chrome extension can't import from outside its loaded root — for the PWA,
  either copy those files in at build time or hoist `shared/` back to the
  repo root once there's a bundler in the picture

## Phase 3 — Desktop (Electron)
- Wraps PWA frontend
- System tray icon with contest count badge
- Native OS notifications
- Auto-launch on startup
- Same fetcher-reuse caveat as Phase 2

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
