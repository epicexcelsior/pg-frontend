///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var ChatOverlay = pc.createScript('chatOverlay');

// Attributes for HTML and CSS assets.
ChatOverlay.attributes.add('css', { type: 'asset', assetType: 'css', title: 'Chat CSS' });
ChatOverlay.attributes.add('html', { type: 'asset', assetType: 'html', title: 'Chat HTML' });

// Utility method to load an asset and run a callback with its text data.
ChatOverlay.prototype.loadAsset = function (asset, callback) {
     if (asset && asset.resource) {
          // If the resource is already loaded.
          callback(asset.resource.data || asset.resource);
     } else if (asset) {
          // Wait for the asset to load.
          asset.once('load', function () {
               callback(asset.resource.data || asset.resource);
          });
          this.app.assets.load(asset);
     } else {
          callback(null);
     }
};

ChatOverlay.prototype.initialize = function () {
     var self = this;

     // Load CSS
     this.loadAsset(this.css, function (cssData) {
          if (cssData) {
               let style = document.createElement('style');
               style.innerHTML = cssData;
               document.head.appendChild(style);
          }
     });

     // Load HTML
     this.loadAsset(this.html, function (htmlData) {
          if (!htmlData) {
               console.warn("ChatOverlay: No HTML asset provided.");
               return;
          }

          self.container = document.createElement('div');
          self.container.innerHTML = htmlData;
          document.body.appendChild(self.container);

          // Cache DOM references
          self.chatMessagesEl = self.container.querySelector('#chatMessages');
          self.chatInputEl = self.container.querySelector('#chatInput');

          if (!self.chatMessagesEl || !self.chatInputEl) {
               console.error("ChatOverlay: Missing #chatMessages or #chatInput!");
               return;
          }

          // Hotkey "/" opens chat
          self.app.keyboard.on(pc.EVENT_KEYDOWN, self.onKeyDown, self);

          // Listen for Enter → send
          self.chatInputEl.addEventListener('keydown', self.onInputKeyDown.bind(self));

          // To avoid walking around with the chat open
          self.chatInputEl.addEventListener('focus', () => window.isChatActive = true);
          self.chatInputEl.addEventListener('blur', () => window.isChatActive = false);

          // Receive new chat messages
          self.app.on("chat:newMessage", self.addMessage.bind(self));

          // Register with UIManager if available
          if (self.app.uiManager) {
               self.app.uiManager.registerComponent(self);
          }

          console.log("ChatOverlay: Initialized.");
     });
};


// Hotkey activation: when "/" is pressed and the input is not focused, focus it.
ChatOverlay.prototype.onKeyDown = function (event) {
     if (event.key === pc.KEY_SLASH && document.activeElement !== this.chatInputEl) {
          this.chatInputEl.focus();
          // Optionally clear previous text.
          this.chatInputEl.value = "";
          event.event.preventDefault();
     }
};

// When the user presses Enter in the chat input, send the message.
ChatOverlay.prototype.onInputKeyDown = function (event) {
     if (event.key === "Enter") {
          var messageText = this.chatInputEl.value.trim();
          if (messageText.length > 0) {
               // Send the message via ChatManager.
               var chatManagerEntity = this.app.root.findByName("ChatManager");
               if (chatManagerEntity && chatManagerEntity.script && chatManagerEntity.script.chatManager) {
                    chatManagerEntity.script.chatManager.sendMessage(messageText);
               } else {
                    console.error("ChatOverlay: ChatManager not found!");
               }
               // Optionally, add the message to the UI as an optimistic update.
               //this.addMessage({ sender: { username: "You" }, content: messageText });
          }
          // Clear the input and remove focus.
          this.chatInputEl.value = "";
          this.chatInputEl.blur();
     }
};

// Append a chat message to the chat log.
ChatOverlay.prototype.addMessage = function (message) {
     var messageElem = document.createElement('div');
     var senderName = (message.sender && message.sender.username) ? message.sender.username : "Unknown";
     messageElem.textContent = senderName + ": " + message.content;
     this.chatMessagesEl.appendChild(messageElem);

     // Auto-scroll to the bottom.
     this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;
};

// Optional theming method.
ChatOverlay.prototype.setTheme = function (theme) {
     if (this.chatMessagesEl) {
          this.chatMessagesEl.style.fontFamily = theme.fontFamily;
     }
};