///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var ChatManager = pc.createScript('chatManager');

// Optionally, allow setting a game instance ID via attributes.
ChatManager.attributes.add('gameInstanceId', { type: 'string', default: 'test', title: 'Game Instance ID' });

ChatManager.prototype.initialize = function () {
     // If the room is available, set up chat immediately.
     if (this.app.room) {
          this.setupChat();
     } else {
          // Otherwise, wait for the event from NetworkManager.
          this.app.once("colyseus:roomJoined", this.setupChat, this);
     }
};

ChatManager.prototype.setupChat = function (room) {
     // If a room was passed, you can update app.room for consistency.
     if (room) {
          this.app.room = room;
     }
     // Now register the onMessage handler for "chatMessage".
     this.app.room.onMessage("chatMessage", (message) => {
          console.log("Received chat message:", message);
          // Relay the chat message to any listeners (e.g., ChatOverlay)
          this.app.fire("chat:newMessage", message);
     });
};

// ChatManager.prototype.initialize = function () {
//      this.channelId = null;

//      // Immediately join if already connected
//      if (window.nakamaSocket) this.joinChannel(window.nakamaSocket);

//      this.app.on("nakama:socketConnected", socket => {
//           console.log("ChatManager: Nakama socket connected.");
//           this.joinChannel(socket);
//      });

//      this.app.on("nakama:socketDisconnected", () => {
//           console.warn("ChatManager: Socket disconnected — clearing channel");
//           this.channelId = null;
//      });
// };

ChatManager.prototype.joinChannel = async function (socket) {
     const channelName = "game_test";  // or use "game_" + instanceId
     try {
          const result = await socket.joinChat(channelName, 1, false, false);
          this.channelId = result.id;
          console.log("ChatManager: Joined chat channel:", channelName, "with channelId:", this.channelId);
     } catch (err) {
          console.error("ChatManager: Failed to join chat channel:", err);
     }
};


// Method to send a chat message.
// ChatManager.prototype.sendMessage = function (text) {
//      if (!window.nakamaSocket || !this.channelId) {
//           console.error("ChatManager: Not connected to a chat channel.");
//           return;
//      }
//      var messageRequest = {
//           channelId: this.channelId,
//           content: text
//      };
//      window.nakamaSocket.writeChatMessage(messageRequest)
//           .then(function (response) {
//                console.log("ChatManager: Sent chat message:", response);
//           })
//           .catch(function (err) {
//                console.error("ChatManager: Failed to send chat message:", err);
//           });
// };

ChatManager.prototype.sendMessage = function (text) {
     if (!this.app.room) {
          console.error("ChatManager: Not connected to a Colyseus room.");
          return;
     }
     // Send a chat message to the server.
     this.app.room.send("chatMessage", { content: text });
     console.log("Sent chat message:", text);
};