// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Network\MessageBroker.js
var MessageBroker = pc.createScript('messageBroker');

MessageBroker.prototype.initialize = function () {
    this.setupAppEventListeners();
    if (this.app.room) {
        this.setupRoomMessageListeners(this.app.room);
    } else {
        this.app.once('colyseus:connected', this.setupRoomMessageListeners, this);
    }
};

MessageBroker.prototype.setupRoomMessageListeners = function (room) {
    if (!room) return;
    room.onMessage("claimSuccess", (data) => this.app.fire('booth:claimSuccess', data));
    room.onMessage("claimError", (data) => this.app.fire('booth:claimError', data));
    room.onMessage("donationConfirmed", (data) => {
        this.app.fire('effects:donation', { recipient: data.recipient, amount: data.amountSOL });
        this.app.fire('chat:newMessage', { type: 'system', content: `${data.senderUsername} donated ${data.amountSOL} SOL!` });
    });
    room.onMessage("chatMessage", (data) => {
        const senderName = data?.sender?.username || 'Unknown';
        this.app.fire('chat:newMessage', { type: 'user', sender: senderName, content: data.content });
    });
};

MessageBroker.prototype.setupAppEventListeners = function () {
    this.app.on("player:move", (data) => this.sendMessage("updatePosition", data));
    this.app.on('user:setname', (username) => this.sendMessage("setUsername", { username }));
    this.app.on('booth:claimRequest', (data) => this.sendMessage('claimBooth', data));
    this.app.on('network:send:chatMessage', (data) => this.sendMessage("chatMessage", data));
    this.app.on('donation:confirmedForBackend', (data) => this.sendMessage("donationConfirmed", data));
    this.app.on('network:send:updateAddress', (address) => this.sendMessage('updateAddress', { walletAddress: address }));
    
    // [!code ++]
    // FIX: Add the missing listener to handle the unclaim request on logout.
    this.app.on('network:send:unclaimBooth', () => this.sendMessage('unclaimBooth'));
    // [!code --]
};

MessageBroker.prototype.sendMessage = function(type, payload) {
    if (this.app.room) {
        this.app.room.send(type, payload);
    } else {
        console.warn(`MessageBroker: Cannot send '${type}', room not available.`);
    }
};