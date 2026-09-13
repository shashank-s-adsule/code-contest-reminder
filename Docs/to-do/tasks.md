# To-Do

## Phase 1 — Extension

### Setup
- [x] Generate 16x16, 48x48, 128x128 PNG icons and put in `extension/assets/icons/`
- [x] Load unpacked in Chrome and verify no manifest errors — **found and fixed a real bug**: `worker.js` imported from `../../shared/fetchers/...`, reaching outside the `extension/` folder that gets loaded as the unpacked root. Chrome sandboxes an extension to its own loaded directory, so the service worker's first import failed and it never registered at all — nothing ever ran, which is why the popup was stuck on "Loading contests..." indefinitely. Moved `shared/fetchers/` to `extension/shared/fetchers/` and fixed the import paths. Needs a final reload + click-through to confirm.

### Core
- [x] Verify Codeforces fetcher returns correct data — confirmed live against `codeforces.com/api/contest.list`
- [x] Verify LeetCode / CodeChef / AtCoder fetchers return correct data — **replaced kontests.net entirely** (still down throughout this build, history of outages: [AliOsm/kontests#43](https://github.com/AliOsm/kontests/issues/43), [#72](https://github.com/AliOsm/kontests/issues/72)). Each platform now hits its own source: `leetcode.js` uses LeetCode's GraphQL endpoint, `codechef.js` uses codechef.com's own contests-list JSON endpoint, `atcoder.js` scrapes atcoder.jp/contests/ (no public API exists for upcoming AtCoder contests — the well-known kenkoooo.com mirror only has contests that have already started). All three verified live and returning real upcoming contests.
- [x] Fixed: a hung/timing-out fetch to one platform was blocking `contests` cache updates for *all* platforms (`Promise.allSettled` waits for every promise to settle, and neither fetcher had a timeout — so a dead API could keep even working Codeforces data from ever being cached). Added `shared/fetchers/fetchWithTimeout.js` (8s AbortController timeout) and made every fetcher throw on failure instead of swallowing errors, so the worker's fallback/error-banner logic actually engages.
- [ ] AtCoder fetcher is HTML scraping, not an API — if atcoder.jp changes its contests-page markup, `fetchAtCoderContests()` will throw (worker falls back to cached data, no crash) but will need its regex updated in `extension/shared/fetchers/atcoder.js`. Keep an eye on it.
- [ ] Test background worker alarm fires on schedule
- [ ] Confirm notification appears at correct time offset

### UI
- [x] Polish popup card layout on edge cases (long contest names) — flex min-width + word-break so long titles wrap instead of overflowing
- [x] Add loading spinner while cache is empty
- [x] Add refresh button in popup to force re-poll
- [x] Show contest type badge (Div 1 / Div 2 / Educational) — shown for Codeforces where the API gives a real division distinct from the name

### Options
- [ ] Verify settings persist after browser restart — code path is correct (`chrome.storage.sync`), needs a manual check in a real Chrome profile
- [x] Test REPOLL message triggers a new fetch — worker now has the missing `onMessage` listener and responds when done; popup's refresh button awaits it

### Quality
- [x] Handle API failures gracefully (show stale data with warning) — failed platforms fall back to their last cached contests instead of vanishing, with a banner noting stale data
- [x] Add per-platform error badges if a fetch fails — implemented as one banner listing the failed platform(s), simpler than a badge per card
- [x] Ensure alarms don't duplicate on repeated polls — orphaned `notify-*` alarms are cleared before each reschedule

## Phase 2 — PWA
- [ ] Scaffold Next.js app
- [ ] Set up web-push notifications
- [ ] Deploy to Vercel

## Phase 3 — Electron
- [ ] Wrap PWA in Electron shell
- [ ] System tray with badge count
- [ ] Auto-launch on startup option

## Ideas / Stretch
- [ ] One-click "Add to Google Calendar" button
- [ ] Timezone display toggle (IST / UTC / Local)
- [ ] IITM-specific handle leaderboard
- [ ] AI weak-spot analysis integration
