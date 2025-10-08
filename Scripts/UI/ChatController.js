// Scripts/UI/ChatController.js
var ChatController = pc.createScript('chatController');

// Optional: Add attribute for services entity if needed for direct access,
// but primarily rely on events.
// ChatController.attributes.add('servicesEntity', { type: 'entity', title: 'Services Entity' });

ChatController.prototype.initialize = function() {
    console.log("ChatController initializing...");

    // Listen for UI events to send messages
    this.app.on('ui:chat:send', this.sendMessage, this);

    // Listen for network events to display messages
    // This assumes NetworkManager fires 'chat:newMessage'
    this.app.on('chat:newMessage', this.displayMessage, this);

    console.log("ChatController initialized.");
};

ChatController.prototype.sendMessage = function(messageContent) {
    const trimmed = typeof messageContent === 'string' ? messageContent.trim() : '';
    if (!trimmed) {
        console.warn("ChatController: Ignored empty chat message.");
        return;
    }
    console.log("ChatController: Received ui:chat:send event. Forwarding to player:chat.");
    this.app.fire('player:chat', trimmed);

    // Optional: Optimistically display the user's own message immediately?
    // Or wait for the server confirmation via 'chat:newMessage'?
    // Waiting for server confirmation is safer for consistency.
    // If displaying optimistically:
    // const username = this.app.services?.get('playerData')?.getUsername() || 'Me'; // Get local username
    // this.displayMessage({ type: 'user', sender: username, content: messageContent });
};

ChatController.prototype.displayMessage = function(messageData) {
    // messageData expected: { type: 'user'/'system', sender?: string, content: string }
    console.log("ChatController: Received chat:newMessage event. Firing chat:displayMessage for HtmlChat.");
    // Fire an event for the HtmlChat bridge script to handle the actual DOM update
    this.app.fire('chat:displayMessage', messageData);
};

// swap method called for script hot-reloading
// ChatController.prototype.swap = function(old) { };

// to learn more about script anatomy, please read:
// https://developer.playcanvas.com/en/user-manual/scripting/
