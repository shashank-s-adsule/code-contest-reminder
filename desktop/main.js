// CommonJS on purpose — Electron's main process is most reliably supported
// this way; its ESM support has real gaps around resolving the built-in
// "electron" module (see git history for the ESM attempt that hit this).
const { app, BrowserWindow, Tray, Menu, ipcMain, shell, screen } = require("electron");
const path = require("node:path");
const { getStore, updateStore, getSettings, saveSettings } = require("./lib/store.js");
const { pollAll } = require("./lib/getData.js");
const { rescheduleNotifications } = require("./lib/notifications.js");

const POLL_INTERVAL_MS = 30 * 60 * 1000; // matches the extension's 30-min cadence
const WIDGET_WIDTH = 320;
const WIDGET_HEIGHT = 480;
const WIDGET_MARGIN = 16;

let tray = null;
let widgetWindow = null;
let optionsWindow = null;
let pollTimer = null;

// Only one instance — a second tray icon for the same app would be confusing.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function iconPath(name) {
  return path.join(__dirname, "assets", "icons", name);
}

// ─── Widget Window (always-visible, Rainmeter-style) ───────────────────────

function defaultWidgetPosition() {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: workArea.x + workArea.width - WIDGET_WIDTH - WIDGET_MARGIN,
    y: workArea.y + WIDGET_MARGIN,
  };
}

async function createWidgetWindow() {
  const store = await getStore();
  const { x, y } = store.widgetPosition || defaultWidgetPosition();

  const win = new BrowserWindow({
    x,
    y,
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: true,
    icon: iconPath("icon48.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // "Floating" keeps it above normal windows without stealing focus/activation
  // the way a plain always-on-top window can on some platforms — this is
  // what gives it the "sits on the desktop like a widget" feel.
  win.setAlwaysOnTop(true, "floating");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.loadFile(path.join(__dirname, "renderer", "popup.html"));

  // Remember where the user dragged it to.
  let moveSaveTimer = null;
  win.on("moved", () => {
    clearTimeout(moveSaveTimer);
    moveSaveTimer = setTimeout(() => {
      const [wx, wy] = win.getPosition();
      updateStore({ widgetPosition: { x: wx, y: wy } });
    }, 400);
  });

  return win;
}

function toggleWidget() {
  if (!widgetWindow) return;
  if (widgetWindow.isVisible()) {
    widgetWindow.hide();
  } else {
    widgetWindow.show();
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
    { label: "Show/Hide Widget", click: toggleWidget },
    { label: "Refresh", click: () => refreshAndBroadcast() },
    { label: "Settings", click: openOptionsWindow },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);

  tray.on("click", toggleWidget);
  tray.on("right-click", () => tray.popUpContextMenu(contextMenu));
}

// ─── Polling ────────────────────────────────────────────────────────────────

async function refreshAndBroadcast() {
  const data = await pollAll();
  await rescheduleNotifications();
  if (widgetWindow) widgetWindow.webContents.send("data-updated", data);
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
ipcMain.on("hide-widget", () => widgetWindow?.hide());

// ─── App Lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  createTray();
  widgetWindow = await createWidgetWindow();
  widgetWindow.show();

  const settings = await getSettings();
  app.setLoginItemSettings({ openAtLogin: !!settings.openAtLogin });

  await refreshAndBroadcast();
  startPolling();
});

app.on("window-all-closed", () => {
  // Widget + tray app — subscribing to this event (even as a no-op)
  // overrides Electron's default of quitting when all windows close.
  // Stay alive; quitting only happens via the tray menu.
});
