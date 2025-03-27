///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var LoginManager = pc.createScript('loginManager');

LoginManager.prototype.initialize = function () {
     // Remove Nakama initialization waiting
     // this.app.once("nakama:initialized", function (client) {
     //      console.log("Received nakama:initialized event", client);
     //      this.autoLogin();
     // }, this);

     // Set up UI elements.
     this.usernameInput = this.app.root.findByName("UsernameInputText").element;
     this.submitButton = this.app.root.findByName("SubmitButton");
     if (!this.usernameInput || !this.submitButton) {
          console.error("Required UI elements not found.");
          return;
     }
     this.submitButton.element.on('click', this.onSubmitClick, this);
};

LoginManager.prototype.onSubmitClick = async function () {
     var username = this.usernameInput.text.trim();
     if (!username) {
          console.error("Username is empty.");
          return;
     }
     // Save username globally and optionally store it locally.
     window.userName = username;
     localStorage.setItem('userName', username);
     this.submitButton.enabled = false;

     // Immediately change to the main scene.
     this.app.scenes.changeScene("Main", (err) => {
          if (err) console.error("Scene change failed:", err);
          else console.log("Main game scene loaded.");
     });
};


// LoginManager.prototype.autoLogin = async function () {
//      const storedToken = localStorage.getItem('nakamaSessionToken');
//      const deviceId = localStorage.getItem('deviceId');
//      const storedUsername = localStorage.getItem('userName');  // you may save this on first manual login

//      if (storedToken && deviceId && window.nakamaClient && window.nakamaClient.authenticateDevice) {
//           console.log("Attempting auto-login with stored device ID:", deviceId);
//           const username = storedUsername || "Guest";
//           try {
//                // Call authenticateDevice with create=false so it refreshes the session rather than creating a new one.
//                let session = await window.nakamaClient.authenticateDevice(deviceId, false, username, {});
//                console.log("Auto-login successful. Session:", session);
//                window.nakamaSession = session;
//                localStorage.setItem('nakamaSessionToken', session.token);

//                // Fire an event to indicate authentication succeeded.
//                // This will trigger the NakamaManager to connect the socket.
//                this.app.fire("nakama:authenticated", session);

//                this.app.scenes.changeScene("Main", (err) => {
//                     if (err) console.error("Scene change failed:", err);
//                     else console.log("Main game scene loaded via auto-login.");
//                });
//           } catch (err) {
//                console.error("Auto-login failed:", err);
//                // Fallback to manual login
//           }
//      } else {
//           console.warn("Auto-login skipped; missing stored token/device ID or nakamaClient not available.");
//      }
// };
