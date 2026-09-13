# To-Do

## Phase 1 — Extension

### Setup
- [x] Generate 16x16, 48x48, 128x128 PNG icons and put in `extension/assets/icons/`
- [ ] Load unpacked in Chrome and verify no manifest errors

### Core
- [x] Verify Codeforces fetcher returns correct data — confirmed live against `codeforces.com/api/contest.list`
- [ ] Verify Kontests fetcher for LeetCode / CodeChef / AtCoder — **blocked**: `kontests.net` is currently unreachable (connection times out on all endpoints). It has a history of outages (see [AliOsm/kontests#43](https://github.com/AliOsm/kontests/issues/43), [#72](https://github.com/AliOsm/kontests/issues/72)). Re-test once it's back up; consider a fallback/direct-API plan if it stays flaky.
- [ ] Test background worker alarm fires on schedule
- [ ] Confirm notification appears at correct time offset

### UI
- [ ] Polish popup card layout on edge cases (long contest names)
- [ ] Add loading spinner while cache is empty
- [ ] Add refresh button in popup to force re-poll
- [ ] Show contest type badge (Div 1 / Div 2 / Educational)

### Options
- [ ] Verify settings persist after browser restart
- [ ] Test REPOLL message triggers a new fetch

### Quality
- [ ] Handle API failures gracefully (show stale data with warning)
- [ ] Add per-platform error badges if a fetch fails
- [ ] Ensure alarms don't duplicate on repeated polls

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
