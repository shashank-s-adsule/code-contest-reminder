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

## Phase 2 — Desktop App
A minimal PWA (`pwa/`, Next.js) was scaffolded and verified working, then
removed by decision: no web app, just the extension plus a desktop app.
See `Docs/Plan/architecture.md`'s "Decision: no PWA" note.

- [x] Decide the framework — **Electron** (no Rust/Cargo toolchain available
      for Tauri; Node/npm already worked reliably)
- [x] Decide what the UI is — went through three shapes: tray-click popup →
      always-visible Rainmeter-style overlay → **current: a normal resizable
      window with a sidebar (daily challenges + contest list) and a detail
      panel**, backed by the tray. See architecture.md's "UI shape" note.
- [x] Decide fetcher reuse — **own copy** in `desktop/lib/fetchers/`, same
      tradeoff as the (removed) PWA
- [x] Scaffold Electron app — `desktop/` (`main.js`, `preload.cjs`,
      `renderer/`, `lib/`)
- [x] Contest list + daily challenge UI — first ported from the extension's
      popup, talking to the main process via a `window.api` bridge instead
      of `chrome.storage`; since redesigned (see "Sidebar + detail redesign"
      below)
- [x] Settings window — ported from `extension/options/`, plus a
      desktop-only "Launch at login" toggle the extension doesn't need
- [x] System tray icon — click toggles show/hide of the window,
      right-click gives a context menu (Show/Hide, Refresh, Settings, Quit)
- [x] **Sidebar + detail redesign** (`renderer/app.html/.css/.js`, replacing
      `popup.*`): top bar with last-updated / Refresh / Settings; error
      banner; sidebar with Daily Challenge cards and Upcoming Contest rows
      (platform-coloured accent, live mini-countdown); detail panel with
      badges, big countdown, Starts/Duration/Ends grid, **+ Add to Calendar**,
      **Open Contest →**, and "More from <platform>" quick-jump rows.
      Auto-selects the first contest and keeps the selection across refreshes.
- [x] Window lifecycle rework in `main.js`: dropped the frameless /
      transparent / `alwaysOnTop` overlay and `widgetPosition`; now a normal
      window (1080×700, min 820×540) whose size/position is saved as
      `windowBounds`, that **hides to the tray on close** instead of quitting,
      with Quit in the tray menu as the only real exit; single-instance lock.
- [x] Add-to-Google-Calendar on desktop — same URL builder as the extension,
      opened through `shell.openExternal`
- [x] All outbound links routed through the main process (`open-external`,
      http/https only) rather than `target="_blank"` in the sandboxed renderer
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

## Remaining / Next Up

### Must verify (code exists, never confirmed)
- [ ] Extension: alarm fires on the 30-min schedule and the notification
      appears at the right offset (soak test in a real Chrome profile)
- [ ] Extension: settings persist across a full browser restart
- [ ] Extension: daily section rolls over after midnight (30-min lag is the
      expected worst case — decide if that's acceptable)
- [ ] Desktop: systematic manual pass on the **new** sidebar + detail window —
      resize down to the minimum, close-to-tray → tray-click round-trip,
      Refresh while a contest is selected, saving settings while the window is
      open, empty state, all-platforms-failed state, long contest names
- [ ] Desktop: re-confirm notifications after the redesign, and confirm the
      "Launch at login" toggle actually registers on Windows
- [ ] Desktop: build an installer with `electron-builder` on each target OS
      (Windows NSIS first) and run the packaged app — config exists, never run

### Known gaps to fix
- [ ] **Fetcher duplication** — `desktop/lib/fetchers/` and
      `extension/shared/fetchers/` are hand-synced copies. Either add a
      copy/sync script, generate one from the other, or extract a shared
      package; at minimum add a fixture-based test for each fetcher so a
      break is caught in one place
- [ ] No automated tests or CI at all — add fetcher tests (recorded fixtures,
      especially for the AtCoder HTML scrape) and a simple GitHub Actions
      lint/test job
- [ ] Single-instance lock has no `second-instance` handler — launching the
      app again should focus/show the existing window; also don't run
      `whenReady` setup in the losing instance
- [ ] Add a Content-Security-Policy `<meta>` to `app.html` / `options.html`,
      and type-check the URL argument in the `open-external` IPC handler
- [ ] Validate/sanitise the payload in the `save-settings` IPC handler
      (unknown keys, non-array `reminderMinutes`)
- [ ] `store.json` writes are not serialised — two overlapping `updateStore`
      calls (e.g. bounds save + poll) can interleave; queue the writes or
      write atomically (temp file + rename)
- [ ] Notifications are lost if the desktop app isn't running at trigger time
      — on launch, consider firing (or showing) reminders that fell inside
      the last few minutes
- [ ] Desktop tray/app icons: only 16/48/128 PNGs exist; add `.ico` (Windows)
      and `.icns` (macOS) for proper installer/taskbar icons, and a macOS
      template tray icon
- [ ] Extension popup still has the older layout — decide whether to bring the
      sidebar/detail visual language (colours, badges) across for consistency
- [ ] `desktop/package.json` has empty `author` and a placeholder license
      (`ISC`) — set real values before distributing

### Release / distribution
- [ ] Chrome Web Store: store listing text, screenshots, promo tile, privacy
      policy (extension only calls the 5 listed hosts and stores locally),
      justify host permissions, pay the one-off developer fee, submit
- [ ] Add a LICENSE file and bump/track versions consistently between
      `extension/manifest.json` and `desktop/package.json`
- [ ] Decide on desktop auto-update (`electron-updater`) and code signing
- [ ] Screenshots / GIF in the README once the UI settles

## Ideas / Stretch
- [x] One-click "Add to Google Calendar" button — each contest card now has a "+ Cal" link next to "Open →" that builds a Google Calendar quick-add URL (`calendar.google.com/calendar/render?action=TEMPLATE&...`) with the contest name, UTC start/end time, and a link back to the contest. No auth, no new API, no manifest changes — it's a plain link, same as "Open →".
- [ ] Timezone display toggle (IST / UTC / Local)
- [ ] IITM-specific handle leaderboard
- [ ] AI weak-spot analysis integration
