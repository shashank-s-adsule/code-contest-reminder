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

### Daily Challenge (new)
- [x] Add LeetCode Daily Challenge + GeeksforGeeks Problem of the Day as a section in the popup — `leetcodeDaily.js` (leetcode.com/graphql, `activeDailyCodingChallengeQuestion` query) and `gfgDaily.js` (practiceapi.geeksforgeeks.org's own POTD endpoint). Both verified live. Refreshes on the same 30-min poll / manual refresh as contests; falls back to yesterday's cached question rather than disappearing if a fetch fails, same pattern as contests.
- [ ] Verify the daily section actually rolls over at midnight in a real browser session (worker only re-fetches on its existing 30-min cadence, so it should pick up the new day within 30 min of midnight rather than exactly at it — confirm that's acceptable)

## Phase 2 — Desktop Widget
A minimal PWA (`pwa/`, Next.js) was scaffolded and verified working, then
removed by decision: no web app, just the extension plus a desktop widget.
See `Docs/Plan/architecture.md`'s "Decision: no PWA" note.

- [x] Decide the framework — **Electron** (no Rust/Cargo toolchain available
      for Tauri; Node/npm already worked reliably)
- [x] Decide what "widget" means — first built as a tray-click popup, then
      changed to an **always-visible, draggable, semi-transparent desktop
      overlay** (Rainmeter-style) after comparing it to the user's actual
      Rainmeter task/note widgets. Tray icon still there as a show/hide
      toggle + Refresh/Settings/Quit menu, but it's no longer the primary
      way to see the widget.
- [x] Decide fetcher reuse — **own copy** in `desktop/lib/fetchers/`, same
      tradeoff as the (removed) PWA
- [x] Scaffold Electron app — `desktop/` (`main.js`, `preload.cjs`,
      `renderer/`, `lib/`)
- [x] Contest list + daily challenge UI — ported the extension's exact
      popup design (`renderer/popup.html/.css/.js`), talking to the main
      process via a `window.api` bridge instead of `chrome.storage`
- [x] Settings window — ported from `extension/options/`, plus a
      desktop-only "Launch at login" toggle the extension doesn't need
- [x] System tray icon — click toggles show/hide of the persistent widget,
      right-click gives a context menu (Show/Hide, Refresh, Settings, Quit)
- [x] Made the widget window itself: frameless, transparent, `alwaysOnTop`
      (`"floating"` level), draggable by its header
      (`-webkit-app-region: drag`, with the header buttons marked
      `no-drag` so they stay clickable), position persisted to
      `store.json` on drag and restored on next launch (defaults to the
      screen's top-right corner on first run). Added a small "✕" button in
      the header to hide it (tray brings it back).
- [x] Native OS notifications — `lib/notifications.js`, plain `setTimeout`
      per contest/offset (main process stays alive, unlike the extension's
      service worker, so no `chrome.alarms`-style scheduler needed)
- [x] Auto-launch on startup option — `app.setLoginItemSettings()`,
      wired to the settings window's toggle
- [x] Hit a real bug getting this running: main process written as ESM
      broke `import ... from "electron"` (named *and* default import both
      resolved to the plain npm package's path string, not the real API —
      `app` came back `undefined`). Converted the whole main process +
      copied fetchers to CommonJS, which is also just the standard, most
      battle-tested way to write Electron apps. See architecture.md's
      "Implementation notes" for the full story.
- [x] Skipped `electron-store` as a persistence dependency — it's ESM-only
      as of v11, same interop problem. Wrote a ~40-line JSON file store
      instead (`lib/store.js`).
- [x] Verified the fetcher + store + polling logic directly under Node
      (mocking only `electron.app.getPath`) — live data from all 4 contest
      platforms + both daily challenges, zero errors, settings persist
      and round-trip correctly.
- [x] GUI confirmed working by manual run (`npm start`) — tray icon,
      widget window, and the first-attempt "nothing happened" issue are
      resolved (root cause not confirmed, but it's working now)
- [x] Notifications confirmed firing at the correct offset — user-verified
      in a real running session
- [ ] Package/distribute for Windows/Linux/Mac — `electron-builder` config
      is in `package.json` (`nsis` for Windows, `AppImage` for Linux, a mac
      category) but untested; still only runs via `npm start` from source,
      no installable build yet. Packaging for an OS generally needs to
      happen on/from that OS, or via a CI matrix.

## Ideas / Stretch
- [x] One-click "Add to Google Calendar" button — each contest card now has a "+ Cal" link next to "Open →" that builds a Google Calendar quick-add URL (`calendar.google.com/calendar/render?action=TEMPLATE&...`) with the contest name, UTC start/end time, and a link back to the contest. No auth, no new API, no manifest changes — it's a plain link, same as "Open →".
- [ ] Timezone display toggle (IST / UTC / Local)
- [ ] IITM-specific handle leaderboard
- [ ] AI weak-spot analysis integration
