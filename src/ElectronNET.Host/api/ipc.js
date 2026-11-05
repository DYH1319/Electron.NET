"use strict";
const electron_1 = require("electron");
let electronSocket;
// Each invoke carries a request id that .NET sends back, so replies can't reach the wrong caller.
// Calls on one channel still run in order, because handlers such as settings writes rely on it
// and several renderers (windows) can't coordinate that themselves. A slow handler only holds up
// its channel for this long; its reply still reaches its own caller.
const HANDLE_TURN_TIMEOUT_MS = 30000;
const handleQueues = new Map();
const pendingInvokes = new Map();
let lastRequestId = 0;
function takePendingInvoke(requestId) {
    const pending = pendingInvokes.get(requestId);
    pendingInvokes.delete(requestId);
    return pending;
}
function waitForTurn(previous) {
    let timer;
    const timeout = new Promise((resolve) => {
        timer = setTimeout(resolve, HANDLE_TURN_TIMEOUT_MS);
    });
    return Promise.race([previous, timeout]).finally(() => clearTimeout(timer));
}
module.exports = (socket) => {
    electronSocket = socket;
    socket.on("registerIpcMainChannel", (channel) => {
        electron_1.ipcMain.on(channel, (event, args) => {
            electronSocket.emit(channel, [event.preventDefault(), args]);
        });
    });
    socket.on("registerSyncIpcMainChannel", (channel) => {
        electron_1.ipcMain.on(channel, (event, args) => {
            const x = socket;
            x.removeAllListeners(channel + "Sync");
            socket.on(channel + "Sync", (result) => {
                event.returnValue = result;
            });
            electronSocket.emit(channel, [event.preventDefault(), args]);
        });
    });
    socket.on("registerOnceIpcMainChannel", (channel) => {
        electron_1.ipcMain.once(channel, (event, args) => {
            electronSocket.emit(channel, [event.preventDefault(), args]);
        });
    });
    socket.on("removeAllListenersIpcMainChannel", (channel) => {
        electron_1.ipcMain.removeAllListeners(channel);
    });
    socket.on("sendToIpcRenderer", (browserWindow, channel, data) => {
        const window = electron_1.BrowserWindow.fromId(browserWindow.id);
        if (window) {
            window.webContents.send(channel, ...data);
        }
    });
    socket.on("sendToIpcRendererBrowserView", (id, channel, data) => {
        const browserViews = (global["browserViews"] =
            global["browserViews"] || []);
        let view = null;
        for (let i = 0; i < browserViews.length; i++) {
            if (browserViews[i]["id"] === id) {
                view = browserViews[i];
                break;
            }
        }
        if (view) {
            view.webContents.send(channel, ...data);
        }
    });
    socket.on("registerHandleIpcMainChannel", (channel) => {
        socket.on(channel + "Handle", (requestId, result) => {
            takePendingInvoke(requestId)?.resolve(result);
        });
        socket.on(channel + "HandleError", (requestId, message) => {
            takePendingInvoke(requestId)?.reject(new Error(message));
        });
        electron_1.ipcMain.handle(channel, (event, args) => {
            const previous = handleQueues.get(channel) ?? Promise.resolve();
            const current = waitForTurn(previous).then(() => new Promise((resolve, reject) => {
                const requestId = `r${++lastRequestId}`;
                pendingInvokes.set(requestId, { resolve, reject });
                electronSocket.emit(channel, [
                    event.preventDefault(),
                    args,
                    requestId,
                ]);
            }));
            // A failed call only fails its own caller, not the ones queued behind it
            handleQueues.set(channel, current.catch(() => undefined));
            return current;
        });
    });
    socket.on("registerHandleOnceIpcMainChannel", (channel) => {
        electron_1.ipcMain.handleOnce(channel, (event, args) => {
            return new Promise((resolve, _reject) => {
                socket.removeAllListeners(channel + "HandleOnce");
                socket.once(channel + "HandleOnce", (result) => {
                    resolve(result);
                });
                electronSocket.emit(channel, [event.preventDefault(), args]);
            });
        });
    });
    socket.on("removeHandlerIpcMainChannel", (channel) => {
        electron_1.ipcMain.removeHandler(channel);
    });
    // Integration helpers: programmatically click menu items from renderer tests
    electron_1.ipcMain.on("integration-click-application-menu", (event, id) => {
        try {
            const menu = electron_1.Menu.getApplicationMenu();
            const mi = menu ? menu.getMenuItemById(id) : null;
            if (mi && typeof mi.click === "function") {
                const bw = electron_1.BrowserWindow.fromWebContents(event.sender);
                mi.click(undefined, bw, undefined);
            }
        }
        catch {
            /* ignore */
        }
    });
    electron_1.ipcMain.on("integration-click-context-menu", (event, windowId, id) => {
        try {
            const entries = global["contextMenuItems"] || [];
            const entry = entries.find((x) => x.browserWindowId === windowId);
            const mi = entry?.menu?.items?.find((i) => i.id === id);
            if (mi && typeof mi.click === "function") {
                const bw = electron_1.BrowserWindow.fromId(windowId);
                mi.click(undefined, bw, undefined);
            }
        }
        catch {
            /* ignore */
        }
    });
};
//# sourceMappingURL=ipc.js.map