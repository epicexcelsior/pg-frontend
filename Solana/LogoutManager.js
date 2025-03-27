///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var LogoutManager = pc.createScript('logoutManager');

// Called once after all resources are loaded and before the first update
LogoutManager.prototype.initialize = function () {
     // Set up a click event on the LogoutButton
     this.entity.element.on('click', this.onLogoutClick, this);
};

LogoutManager.prototype.onLogoutClick = function () {
     // Clear stored session token (and optionally the device ID)
     localStorage.removeItem('nakamaSessionToken');
     // Optionally, you may also clear the username or device ID if you want a fresh login:
     // localStorage.removeItem('deviceId');
     // localStorage.removeItem('userName');

     // Clear the global session
     window.nakamaSession = null;

     // Disconnect the Nakama socket if connected
     if (window.nakamaSocket) {
          window.nakamaSocket.disconnect();
          window.nakamaSocket = null;
     }

     console.log("User logged out.");

     // Optionally, change the scene back to the login screen
     this.app.scenes.changeScene("Login", function (err) {
          if (err) {
               console.error("Scene change failed:", err);
          } else {
               console.log("Returned to login scene.");
          }
     });
};