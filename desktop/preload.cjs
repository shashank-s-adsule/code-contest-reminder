const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getData: () => ipcRenderer.invoke("get-data"),
  refresh: () => ipcRenderer.invoke("refresh"),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  openOptions: () => ipcRenderer.send("open-options"),
  onDataUpdated: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("data-updated", listener);
    return () => ipcRenderer.removeListener("data-updated", listener);
  },
});
