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
    // [!code ++]
    // Renamed to match server-side refactor
    room.onMessage("announceDonation", (data) => {
        const donationEvent = {
            signature: data.signature || null,
            recipient: data.recipient || null,
            recipientUsername: data.recipientUsername || null,
            sender: data.sender || null,
            senderUsername: data.senderUsername || null,
            amount: data.amountSOL || 0,
            senderTwitter: data.senderTwitter || null,
            senderTwitterId: data.senderTwitterId || null,
            recipientTwitter: data.recipientTwitter || null,
            recipientTwitterId: data.recipientTwitterId || null,
            tweetId: data.tweetId || null,
            tweetUrl: data.tweetUrl || null,
            tweetText: data.tweetText || null
        };
        this.app.fire('effects:donation', donationEvent);
        const senderLabel = donationEvent.senderTwitter ? `@${donationEvent.senderTwitter}` : this.formatIdentity(data.senderUsername, data.sender);
        const recipientLabel = donationEvent.recipientTwitter ? `@${donationEvent.recipientTwitter}` : this.formatIdentity(data.recipientUsername, data.recipient);
        const solAmount = this.formatSolAmount(data.amountSOL);
        this.app.fire('chat:newMessage', { type: 'system', content: `${senderLabel} donated ${solAmount} SOL to ${recipientLabel}!` });
        if (data.sender) {
            this.app.fire('wallet:refreshBalance', { address: data.sender, source: 'donation:announce:sender' });
        }
        if (data.recipient) {
            this.app.fire('wallet:refreshBalance', { address: data.recipient, source: 'donation:announce:recipient' });
        }
        if (donationEvent.tweetUrl) {
            this.app.fire('donation:tweetPublished', donationEvent);
        }
    });
    room.onMessage("announceDonationError", (data) => this.app.fire('donation:announcementFailed', data));
    room.onMessage("boothUnclaimed", (data) => this.app.fire('booth:unclaimed', data));
    // [!code --]
    room.onMessage("chatMessage", (data) => {
        const senderName = data?.sender?.username || 'Unknown';
        this.app.fire('chat:newMessage', { type: 'user', sender: senderName, content: data.content });
    });
    room.onMessage("avatar:recipe", (data) => this.app.fire('avatar:recipe', data));
    room.onMessage("animation:play", (data) => this.app.fire('animation:play:network', data));
};

MessageBroker.prototype.setupAppEventListeners = function () {
    this.app.on("player:move", (data) => this.sendMessage("updatePosition", data));
    this.app.on('user:setname', (username) => this.sendMessage("setUsername", { username }));
    this.app.on('booth:claimRequest', (data) => this.sendMessage('claimBooth', data));
    this.app.on('network:send:chatMessage', (data) => this.sendMessage("chatMessage", data));
    // [!code ++]
    // Renamed to match server-side refactor
    this.app.on('network:send:announceDonation', (data) => this.sendMessage("announceDonation", data)); 
    // [!code --]
    this.app.on('network:send:avatarRecipe', (data) => this.sendMessage('avatar:recipe', data));
    this.app.on('network:send:updateAddress', (data) => {
        var payload = { walletAddress: '' };

        if (typeof data === 'string') {
            payload.walletAddress = data || '';
        } else if (data && typeof data === 'object') {
            if (typeof data.walletAddress === 'string') {
                payload.walletAddress = data.walletAddress || '';
            }
            if (Object.prototype.hasOwnProperty.call(data, 'twitterHandle')) {
                payload.twitterHandle = data.twitterHandle || '';
            }
            if (Object.prototype.hasOwnProperty.call(data, 'twitterUserId')) {
                payload.twitterUserId = data.twitterUserId || '';
            }
        }

        this.sendMessage('updateAddress', payload);
    });
    
    // [!code ++]
    // FIX: Add the missing listener to handle the unclaim request on logout.
    this.app.on('network:send:unclaimBooth', () => this.sendMessage('unclaimBooth'));
    this.app.on('network:send:animation', (data) => this.sendMessage('animation:play', data));
    // [!code --]
};

MessageBroker.prototype.formatIdentity = function (username, address) {
    if (typeof username === 'string') {
        const trimmed = username.trim();
        if (trimmed.length) {
            return trimmed;
        }
    }
    if (typeof address === 'string' && address.length) {
        if (address.length <= 8) {
            return address;
        }
        return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
    }
    return 'Someone';
};

MessageBroker.prototype.formatSolAmount = function (value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return value;
    }
    const fixed = numeric.toFixed(4);
    const trimmed = fixed.replace(/0+$/, '').replace(/\.$/, '');
    return trimmed.length ? trimmed : '0';
};
MessageBroker.prototype.sendMessage = function(type, payload) {
    if (this.app.room && this.app.room.connection.isOpen) {
        this.app.room.send(type, payload);
    } else {
        console.warn(`MessageBroker: Cannot send '${type}', room not available or connection closed.`);
    }
};


