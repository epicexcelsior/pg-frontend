// Scripts/UI/HtmlBridge/HtmlChat.js
var HtmlChat = pc.createScript('htmlChat');

HtmlChat.attributes.add('cssAsset', { type: 'asset', assetType: 'css', title: 'Chat CSS Asset' });
HtmlChat.attributes.add('htmlAsset', { type: 'asset', assetType: 'html', title: 'Chat HTML Asset' });

HtmlChat.prototype.initialize = function() {
    console.log("HtmlChat initializing...");
    this.messages = [];
    this.maxMessages = 50;

    // Inject CSS from Asset
    if (this.cssAsset) {
        const style = document.createElement('style');
        document.head.appendChild(style);
        style.innerHTML = this.cssAsset.resource || '';
        
        // If resource is not loaded yet (unlikely in init, but possible)
        if (!this.cssAsset.resource) {
             this.cssAsset.ready((asset) => {
                 style.innerHTML = asset.resource;
             });
        }
    } else {
        console.warn("HtmlChat: CSS Asset not assigned.");
    }

    // Inject HTML from Asset
    if (this.htmlAsset) {
        if (this.htmlAsset.resource) {
            this.injectHtml(this.htmlAsset.resource);
        } else {
            this.htmlAsset.ready((asset) => {
                this.injectHtml(asset.resource);
            });
        }
    } else {
        console.warn("HtmlChat: HTML Asset not assigned.");
    }

    // Listen for events
    this.app.on('chat:displayMessage', this.addMessage, this);
    this.app.on('chat:clear', this.clearMessages, this);

    // Add listener for '/' key to focus input
    document.addEventListener('keydown', this.onDocumentKeyDown.bind(this));

    // Listen for scene changes to toggle visibility
    this.app.systems.script.on('postInitialize', this._onScenePostInitialize, this);
    this._checkSceneVisibility();
    
    console.log("HtmlChat initialized.");
};

HtmlChat.prototype._onScenePostInitialize = function() {
    this._checkSceneVisibility();
};

HtmlChat.prototype._checkSceneVisibility = function() {
    if (!this.div) return;
    const currentSceneName = this.app.scene.name;
    if (currentSceneName === 'Login') {
        this.div.style.display = 'none';
    } else {
        this.div.style.display = 'block'; // CSS handles layout, block is safe for container
    }
};

HtmlChat.prototype.injectHtml = function(htmlResource) {
    if (this.div) return;

    this.div = document.createElement('div');
    this.div.innerHTML = htmlResource;
    document.body.appendChild(this.div);

    // Find DOM elements based on IDs in chat_overlay.html
    this.chatContainer = this.div.querySelector('#chatOverlay');
    this.messageList = this.div.querySelector('#chatMessages');
    this.messageInput = this.div.querySelector('#chatInput');
    this.sendButton = this.div.querySelector('#send-button');

    if (!this.chatContainer || !this.messageList || !this.messageInput || !this.sendButton) {
        console.error("HtmlChat: Could not find all required chat elements in HTML asset.");
        return;
    }

    this.sendButton.addEventListener('click', this.onSendClick.bind(this));
    this.messageInput.addEventListener('keydown', this.onInputKeyDown.bind(this));
    this.messageInput.addEventListener('focus', this.onInputFocus.bind(this));
    this.messageInput.addEventListener('blur', this.onInputBlur.bind(this));
    
    console.log("HtmlChat: HTML injected.");
};

HtmlChat.prototype.onDocumentKeyDown = function(event) {
    if (event.key === '/' && document.activeElement !== this.messageInput) {
        event.preventDefault();
        this.messageInput.focus();
    }
};

HtmlChat.prototype.onInputFocus = function() {
    // InputManager handles the global blocking via 'focus' event listener
    // But we can still fire specific events if needed
    this.app.fire('ui:chat:focus');
};

HtmlChat.prototype.onInputBlur = function() {
    this.app.fire('ui:chat:blur');
};

HtmlChat.prototype.onSendClick = function() {
    this.sendMessage();
};

HtmlChat.prototype.onInputKeyDown = function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.sendMessage();
    }
};

HtmlChat.prototype.sendMessage = function() {
    const messageText = this.messageInput.value.trim();
    if (messageText) {
        this.app.fire('ui:chat:send', messageText);
        this.messageInput.value = '';
        this.messageInput.blur();
    }
};

HtmlChat.prototype._htmlEscape = function(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};

HtmlChat.prototype.addMessage = function(messageData) {
    if (!this.messageList) return;

    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    if (messageData.type === 'user') {
        messageElement.classList.add('message-user');
    } else {
        messageElement.classList.add('message-system');
    }

    let formattedMessage = '';
    if (messageData.type === 'user' && messageData.sender) {
        formattedMessage = `<strong>${this._htmlEscape(messageData.sender)}:</strong> ${this._htmlEscape(messageData.content)}`;
    } else {
        formattedMessage = `<em>${this._htmlEscape(messageData.content)}</em>`;
    }
    messageElement.innerHTML = formattedMessage;

    this.messageList.appendChild(messageElement);
    this.messages.push(messageElement);

    while (this.messages.length > this.maxMessages) {
        const oldMessage = this.messages.shift();
        if (oldMessage) this.messageList.removeChild(oldMessage);
    }

    this.messageList.scrollTop = this.messageList.scrollHeight;
};

HtmlChat.prototype.clearMessages = function() {
    if (this.messageList) this.messageList.innerHTML = '';
    this.messages = [];
};

HtmlChat.prototype.destroy = function() {
    this.app.off('chat:displayMessage', this.addMessage, this);
    this.app.off('chat:clear', this.clearMessages, this);
    this.app.systems.script.off('postInitialize', this._onScenePostInitialize, this);
    document.removeEventListener('keydown', this.onDocumentKeyDown.bind(this));

    if (this.div && this.div.parentNode) {
        this.div.parentNode.removeChild(this.div);
    }
};