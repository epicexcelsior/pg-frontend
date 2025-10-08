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

    // Listen for scene changes to toggle visibility
    this.app.systems.script.on('postInitialize', this._onScenePostInitialize, this);

    // Initial visibility check
    this._checkSceneVisibility();
};

// --- Scene Visibility Logic ---
HtmlChat.prototype._onScenePostInitialize = function() {
    this._checkSceneVisibility();
};

HtmlChat.prototype._checkSceneVisibility = function() {
    if (!this.div) return; // Ensure HTML is injected

    const currentSceneName = this.app.scene.name;
    console.log(`HtmlChat: Checking visibility for scene: ${currentSceneName}`);

    // Hide chat in the Login scene, show otherwise
    if (currentSceneName === 'Login') { // <<<--- ADJUST 'Login' if your scene name is different
        console.log("HtmlChat: Hiding chat UI in Login scene.");
        this.div.style.display = 'none';
    } else {
        console.log("HtmlChat: Showing chat UI.");
        this.div.style.display = 'block'; // Or 'flex', 'grid', etc., depending on your CSS
    }
};
// --- End Scene Visibility Logic ---

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
    
    // Set maximum character limit
    this.messageInput.setAttribute('maxlength', '128');

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
        this.messageInput.blur(); // Remove focus to return control to game
    }
};

// --- Helper function for basic HTML escaping ---
HtmlChat.prototype._htmlEscape = function(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
};
// --- End Helper ---

HtmlChat.prototype.addMessage = function(messageData) {
    // messageData expected: { type: 'user'/'system', sender?: string, content: string }
    if (!this.messageList) return;

    const messageElement = document.createElement('div');
    messageElement.classList.add('message', `message-${messageData.type}`); // Add classes for styling

    let formattedMessage = '';
    if (messageData.type === 'user' && messageData.sender) {
        // Use the local _htmlEscape function
        formattedMessage = `<strong>${this._htmlEscape(messageData.sender)}:</strong> ${this._htmlEscape(messageData.content)}`;
    } else { // System message
        // Use the local _htmlEscape function
        formattedMessage = `<em>${this._htmlEscape(messageData.content)}</em>`;
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

HtmlChat.prototype.destroy = function() {
    // Clean up event listeners
    this.app.off('chat:displayMessage', this.addMessage, this);
    this.app.off('chat:clear', this.clearMessages, this);
    this.app.systems.script.off('postInitialize', this._onScenePostInitialize, this);
    document.removeEventListener('keydown', this.onDocumentKeyDown.bind(this)); // Ensure correct binding removal if needed

    // Remove DOM elements
    if (this.div && this.div.parentNode) {
        this.div.parentNode.removeChild(this.div);
    }
    this.div = null;
    this.chatContainer = null;
    this.messageList = null;
    this.messageInput = null;
    this.sendButton = null; // Add cleanup for button listener if attached directly without bind

    // Remove CSS (optional, might be shared)
    // Find the style tag and remove it if necessary
};