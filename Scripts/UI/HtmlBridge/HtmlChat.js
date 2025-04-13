// Scripts/UI/HtmlBridge/HtmlChat.js
var HtmlChat = pc.createScript('htmlChat');

HtmlChat.attributes.add('cssAsset', { type: 'asset', assetType: 'css', title: 'Chat CSS Asset' });
HtmlChat.attributes.add('htmlAsset', { type: 'asset', assetType: 'html', title: 'Chat HTML Asset' });

HtmlChat.prototype.initialize = function() {
    console.log("HtmlChat initializing...");
    this.messages = [];
    this.maxMessages = 50; // Example limit

    // Inject CSS
    if (this.cssAsset?.resource) {
        const style = document.createElement('style');
        document.head.appendChild(style);
        style.innerHTML = this.cssAsset.resource;
    } else {
        console.warn("HtmlChat: CSS Asset not found or loaded.");
        this.cssAsset?.ready(asset => {
             const style = document.createElement('style');
             document.head.appendChild(style);
             style.innerHTML = asset.resource;
        });
    }

    // Inject HTML
    if (this.htmlAsset?.resource) {
        this.injectHtml(this.htmlAsset.resource);
    } else {
        console.warn("HtmlChat: HTML Asset not found or loaded.");
        this.htmlAsset?.ready(asset => this.injectHtml(asset.resource));
    }

    // Listen for events from ChatController to display messages
    this.app.on('chat:displayMessage', this.addMessage, this);
    this.app.on('chat:clear', this.clearMessages, this);

    console.log("HtmlChat initialized.");

    // Add listener for '/' key to focus input
    document.addEventListener('keydown', this.onDocumentKeyDown.bind(this));
};

HtmlChat.prototype.injectHtml = function(htmlResource) {
    if (this.div) return; // Already injected

    this.div = document.createElement('div');
    this.div.innerHTML = htmlResource;
    document.body.appendChild(this.div);

    // Find DOM elements
    this.chatContainer = this.div.querySelector('#chatOverlay'); // Adjust ID
    this.messageList = this.div.querySelector('#chatMessages');     // Adjust ID
    this.messageInput = this.div.querySelector('#chatInput');   // Adjust ID
    this.sendButton = this.div.querySelector('#send-button');       // Adjust ID

    if (!this.chatContainer || !this.messageList || !this.messageInput || !this.sendButton) {
        console.error("HtmlChat: Could not find all required chat elements in HTML.");
        return;
    }

    // Add event listeners for user input
    this.sendButton.addEventListener('click', this.onSendClick.bind(this));
    this.messageInput.addEventListener('keydown', this.onInputKeyDown.bind(this));

    this.messageInput.addEventListener('focus', this.onInputFocus.bind(this));
    this.messageInput.addEventListener('blur', this.onInputBlur.bind(this));

    console.log("HtmlChat: HTML injected and elements found.");
};

HtmlChat.prototype.onDocumentKeyDown = function(event) {
    if (event.key === '/') {
        event.preventDefault(); // Prevent default browser behavior
        this.messageInput.focus();
    }
};

HtmlChat.prototype.onInputFocus = function() {
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
        event.preventDefault(); // Prevent newline in input
        this.sendMessage();
    }
};

HtmlChat.prototype.sendMessage = function() {
    const messageText = this.messageInput.value.trim();
    if (messageText) {
        console.log("HtmlChat: Firing ui:chat:send event:", messageText);
        // Fire event for ChatController to handle sending
        this.app.fire('ui:chat:send', messageText);
        this.messageInput.value = ''; // Clear input field
    }
};

HtmlChat.prototype.addMessage = function(messageData) {
    // messageData expected: { type: 'user'/'system', sender?: string, content: string }
    if (!this.messageList) return;

    const messageElement = document.createElement('div');
    messageElement.classList.add('message', `message-${messageData.type}`); // Add classes for styling

    let formattedMessage = '';
    if (messageData.type === 'user' && messageData.sender) {
        formattedMessage = `<strong>${pc.string.htmlEscape(messageData.sender)}:</strong> ${pc.string.htmlEscape(messageData.content)}`;
    } else { // System message
        formattedMessage = `<em>${pc.string.htmlEscape(messageData.content)}</em>`;
    }
    messageElement.innerHTML = formattedMessage;

    this.messageList.appendChild(messageElement);
    this.messages.push(messageElement);

    // Keep message list trimmed
    while (this.messages.length > this.maxMessages) {
        const oldMessage = this.messages.shift();
        if (oldMessage) {
            this.messageList.removeChild(oldMessage);
        }
    }

    // Auto-scroll to bottom
    this.messageList.scrollTop = this.messageList.scrollHeight;
};

HtmlChat.prototype.clearMessages = function() {
    if (this.messageList) {
        this.messageList.innerHTML = '';
    }
    this.messages = [];
};

// swap method called for script hot-reloading
// HtmlChat.prototype.swap = function(old) { };