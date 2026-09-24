// CommonJS on purpose — Electron's main process is most reliably supported
// this way; its ESM support has real gaps around resolving the built-in
// "electron" module (see git history for the ESM attempt that hit this).
const { app, BrowserWindow, Tray, Menu, ipcMain, shell, screen } = require("electron");
const path = require("node:path");
const { getStore, updateStore, getSettings, saveSettings } = require("./lib/store.js");
const { pollAll } = require("./lib/getData.js");
const { rescheduleNotifications } = require("./lib/notifications.js");

const POLL_INTERVAL_MS = 30 * 60 * 1000; // matches the extension's 30-min cadence
const APP_WIDTH = 1080;
const APP_HEIGHT = 700;
const APP_MIN_WIDTH = 820;
const APP_MIN_HEIGHT = 540;

let tray = null;
let mainWindow = null;
let optionsWindow = null;
let pollTimer = null;
let isQuitting = false;

// Only one instance — a second tray icon for the same app would be confusing.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function iconPath(name) {
  return path.join(__dirname, "assets", "icons", name);
}

// ─── Main Window (sidebar + detail app, tray-backed) ────────────────────────

function defaultWindowBounds() {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    width: APP_WIDTH,
    height: APP_HEIGHT,
    x: workArea.x + Math.round((workArea.width - APP_WIDTH) / 2),
    y: workArea.y + Math.round((workArea.height - APP_HEIGHT) / 2),
  };
}

async function createMainWindow() {
  const store = await getStore();
  const bounds = store.windowBounds || defaultWindowBounds();

  const win = new BrowserWindow({
    ...bounds,
    minWidth: APP_MIN_WIDTH,
    minHeight: APP_MIN_HEIGHT,
    title: "Contest Reminder",
    backgroundColor: "#0b0d13",
    icon: iconPath("icon48.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, "renderer", "app.html"));

  // Remember size/position across launches.
  let boundsSaveTimer = null;
  const saveBounds = () => {
    clearTimeout(boundsSaveTimer);
    boundsSaveTimer = setTimeout(() => {
      updateStore({ windowBounds: win.getBounds() });
    }, 400);
  };
  win.on("moved", saveBounds);
  win.on("resized", saveBounds);

  // A tray-backed app: closing the window hides it instead of quitting, so
  // background polling/notifications keep running. Tray menu's "Quit" (or
  // app.quit() from there) is the only real exit.
  win.on("close", (e) => {
    if (isQuitting) return;
    e.preventDefault();
    win.hide();
  });

  return win;
}

function toggleMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

// ─── Options Window ─────────────────────────────────────────────────────────

function openOptionsWindow() {
  if (optionsWindow) {
    optionsWindow.focus();
    return;
  }

  optionsWindow = new BrowserWindow({
    width: 420,
    height: 520,
    title: "Contest Reminder — Settings",
    icon: iconPath("icon48.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  optionsWindow.setMenuBarVisibility(false);
  optionsWindow.loadFile(path.join(__dirname, "renderer", "options.html"));
  optionsWindow.on("closed", () => { optionsWindow = null; });
}

// ─── Tray ───────────────────────────────────────────────────────────────────

function createTray() {
  tray = new Tray(iconPath("icon16.png"));
  tray.setToolTip("Contest Reminder");

  const contextMenu = Menu.buildFromTemplate([
    { label: "Show/Hide Window", click: toggleMainWindow },
    { label: "Refresh", click: () => refreshAndBroadcast() },
    { label: "Settings", click: openOptionsWindow },
    { type: "separator" },
    { label: "Quit", click: () => { isQuitting = true; app.quit(); } },
  ]);

  tray.on("click", toggleMainWindow);
  tray.on("right-click", () => tray.popUpContextMenu(contextMenu));
}

// ─── Polling ────────────────────────────────────────────────────────────────

async function refreshAndBroadcast() {
  const data = await pollAll();
  await rescheduleNotifications();
  if (mainWindow) mainWindow.webContents.send("data-updated", data);
  return data;
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(refreshAndBroadcast, POLL_INTERVAL_MS);
}

// ─── IPC ────────────────────────────────────────────────────────────────────

ipcMain.handle("get-data", async () => getStore());
ipcMain.handle("refresh", async () => refreshAndBroadcast());
ipcMain.handle("get-settings", async () => getSettings());
ipcMain.handle("save-settings", async (_event, settings) => {
  await saveSettings(settings);
  app.setLoginItemSettings({ openAtLogin: !!settings.openAtLogin });
  return refreshAndBroadcast();
});
ipcMain.handle("open-external", (_event, url) => {
  if (url.startsWith("https://") || url.startsWith("http://")) shell.openExternal(url);
});
ipcMain.on("open-options", openOptionsWindow);

// ─── App Lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  createTray();
  mainWindow = await createMainWindow();
  mainWindow.show();

  const settings = await getSettings();
  app.setLoginItemSettings({ openAtLogin: !!settings.openAtLogin });

  await refreshAndBroadcast();
  startPolling();
});

app.on("before-quit", () => { isQuitting = true; });

app.on("window-all-closed", () => {
  // Tray-backed app — subscribing to this event (even as a no-op) overrides
  // Electron's default of quitting when all windows close. Stay alive;
  // quitting only happens via the tray menu.
});
