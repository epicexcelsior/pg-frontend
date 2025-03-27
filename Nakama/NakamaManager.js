///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var NakamaManager = pc.createScript('nakamaManager');

NakamaManager.prototype.initialize = function () {
     const host = "127.0.0.1";
     const port = 7350;
     const useSSL = false;
     this.client = new nakamajs.Client("defaultkey", host, port, useSSL);
     this.client.ssl = useSSL;
     window.nakamaClient = this.client;
     console.log("✅ Nakama client initialized", this.client);
     // Fire event that Nakama client is ready.
     this.app.fire("nakama:initialized", this.client);
     // this.app.on("nakama:authenticated", async function (session) {
     //      console.log("NakamaManager: Received authenticated event.");
     //      try {
     //           await this.connectSocket();
     //      } catch (err) {
     //           console.error("NakamaManager: Socket connection failed:", err);
     //      }
     // }.bind(this));
};

async function authenticateDevice(username) {
     username = `${username}`;
     var deviceId = getDeviceId();
     console.log("Device ID:", deviceId);

     try {
          let session = await window.nakamaClient.authenticateDevice(deviceId, true, username, {});
          console.log("Device authentication successful. Session:", session);
          window.nakamaSession = session;
          localStorage.setItem('nakamaSessionToken', session.token);
          return session;
     } catch (err) {
          console.error("Error during device authentication:", err);
          throw err;
     }
}


async function authenticateCustom(sessionToken) {
     // Restore or refresh session
     let session = nakamajs.Session.restore(sessionToken, sessionToken);
     if (session.isexpired(Date.now() / 1000)) {
          session = await window.nakamaClient.sessionRefresh(session);
     }
     window.nakamaSession = session;
     return session;
}

function getDeviceId() {
     // Try to retrieve an existing device id from localStorage
     let deviceId = localStorage.getItem('deviceId');
     if (!deviceId) {
          // Generate a new UUID (supported in most modern browsers)
          if (crypto.randomUUID) {
               deviceId = crypto.randomUUID();
          } else {
               // Fallback: a simple random string (consider using a proper UUID library in production)
               deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
               });
          }
          localStorage.setItem('deviceId', deviceId);
     }
     return deviceId;
}

// NakamaManager.prototype.connectSocket = async function () {
//      if (!window.nakamaSession) {
//           console.error("NakamaManager: Cannot connect socket — no session");
//           throw new Error("Session undefined.");
//      }

//      // Create & store the socket so we can re‑use it
//      this.socket = this.client.createSocket(false, false);

//      // Attach disconnect handler
//      this.socket.ondisconnect = this._onSocketDisconnect.bind(this);

//      try {
//           await this.socket.connect(window.nakamaSession, true);
//           window.nakamaSocket = this.socket;
//           console.log("🔌 Nakama socket connected");
//           this.app.fire("nakama:socketConnected", this.socket);
//           this._reconnectAttempts = 0;
//      } catch (err) {
//           console.error("NakamaManager: Initial socket connect failed:", err);
//           this._scheduleReconnect();
//      }
// };

// NakamaManager.prototype._onSocketDisconnect = function (err) {
//      console.warn("Nakama socket disconnected:", err);
//      this.app.fire("nakama:socketDisconnected", err);
//      this._scheduleReconnect();
// };

// NakamaManager.prototype._scheduleReconnect = function () {
//      this._reconnectAttempts = (this._reconnectAttempts || 0) + 1;
//      const delay = Math.min(30000, Math.pow(2, this._reconnectAttempts) * 1000);
//      clearTimeout(this._reconnectTimer);
//      console.log(`🔄 Reconnecting Nakama socket in ${delay}ms`);
//      this._reconnectTimer = setTimeout(async () => {
//           // Refresh session if expired
//           if (window.nakamaSession.isexpired(Date.now() / 1000)) {
//                try {
//                     window.nakamaSession = await window.nakamaClient.sessionRefresh(window.nakamaSession);
//                     localStorage.setItem('nakamaSessionToken', window.nakamaSession.token);
//                } catch (refreshErr) {
//                     console.error("NakamaManager: Session refresh failed:", refreshErr);
//                }
//           }
//           try {
//                await this.connectSocket();
//           } catch (err) {
//                console.error("NakamaManager: Reconnect attempt failed:", err);
//           }
//      }, delay);
// };

