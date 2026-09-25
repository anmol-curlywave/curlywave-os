// Curlywave OS desktop app (Windows + Mac).
// A secure window around the hosted web app, so every web update reaches desktop users instantly.
const { app, BrowserWindow, shell, Menu, session, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const appUrl = (!app.isPackaged && process.env.CURLYWAVE_APP_URL) ||
  JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8")).appUrl;
const APP_ORIGIN = new URL(appUrl).origin;
const isMac = process.platform === "darwin";
let win = null;

// ---------- One window only ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
  });
}

// ---------- Remember window size/position ----------
const stateFile = () => path.join(app.getPath("userData"), "window-state.json");
function loadState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), "utf8")); } catch { return { width: 1360, height: 860 }; }
}
function saveState() {
  if (!win || win.isDestroyed()) return;
  try { fs.writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() })); } catch { /* ignore */ }
}

function isAppUrl(url) {
  try { return new URL(url).origin === APP_ORIGIN; } catch { return false; }
}

function showOffline() {
  if (win && !win.isDestroyed()) win.loadFile(path.join(__dirname, "offline.html"), { query: { url: appUrl } });
}

function createWindow() {
  const st = loadState();
  win = new BrowserWindow({
    width: st.width, height: st.height, x: st.x, y: st.y,
    minWidth: 380, minHeight: 500,
    title: "Curlywave OS",
    backgroundColor: "#f6f6fb",
    icon: path.join(__dirname, "build", "icon.png"),
    show: false,
    autoHideMenuBar: !isMac,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });
  if (st.maximized) win.maximize();

  // Let the web app know it's inside the desktop app (hides the "Install app" banner).
  win.webContents.setUserAgent(`${win.webContents.getUserAgent()} CurlywaveDesktop/${app.getVersion()}`);

  win.once("ready-to-show", () => win.show());
  win.on("close", saveState);
  win.on("closed", () => { win = null; });

  // Links to other sites (Drive, client websites, Instagram…) open in the normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^mailto:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!isAppUrl(url) && !url.startsWith("file:")) { e.preventDefault(); if (/^https?:|^mailto:/i.test(url)) shell.openExternal(url); }
  });

  // No internet → friendly offline screen with a retry button.
  win.webContents.on("did-fail-load", (_e, code, _desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && isAppUrl(url)) showOffline();
  });
  win.loadURL(appUrl);
}

function buildMenu() {
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { label: "Home", accelerator: "CmdOrCtrl+Shift+H", click: () => win && win.loadURL(appUrl) },
        { role: "reload" }, { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        { label: "Open in browser", click: () => shell.openExternal(win ? win.webContents.getURL().replace(/^file:.*/, appUrl) : appUrl) },
        { label: "About Curlywave OS", click: () => dialog.showMessageBox({ message: `Curlywave OS ${app.getVersion()}`, detail: appUrl }) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  // Only allow the permissions the app actually needs.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(["clipboard-read", "clipboard-sanitized-write", "notifications", "fullscreen"].includes(permission));
  });
  buildMenu();
  createWindow();
  app.on("activate", () => { if (!win) createWindow(); else win.show(); });
});

app.on("window-all-closed", () => { if (!isMac) app.quit(); });

// Block any attempt to open extra windows or webviews from web content.
app.on("web-contents-created", (_e, contents) => {
  contents.on("will-attach-webview", (e) => e.preventDefault());
});
