var TouchButton = pc.createScript('touchButton');
TouchButton.attributes.add('identifier', { 
    type: 'string', 
    default: 'button0',
    title: 'Identifier',
    description: 'A unique name for the button to refer to it by in the API. Will give a warning in browser tools if the name is not unique.'
});

TouchButton.attributes.add('vibration', { 
    type: 'number', 
    default: 0,
    title: 'Vibration duration (ms)',
    description: 'If the device supports vibration with \'Navigator.vibrate\', it will vibrate for the duration set here on touch down.Set to 0 to disable.'
});

// initialize code called once per entity
TouchButton.prototype.initialize = function() {
    if (window.touchJoypad && window.touchJoypad.buttonStates[this.identifier] !== undefined) {
        console.warn('Touch button identifier already used, please use another for Entity: ' + this.entity.name);
        return;
    }

    this._canVibrate = !!navigator.vibrate;
    this._chatFocused = false; // Track chat focus state
    this._uiLockedReasons = new Set();

    this._setState(false);

    this.on('state', (state) => {
        this._setEvents(state ? 'on' : 'off');
    });

    this.on('destroy', () => {
        if (window.touchJoypad) {
            window.touchJoypad.buttonStates[this.identifier] = undefined;
        }
        // Clean up chat focus listeners
        this.app.off('ui:chat:focus', this.onChatFocus, this);
        this.app.off('ui:chat:blur', this.onChatBlur, this);
        this.app.off('ui:input:focus', this.onUiInputFocus, this);
        this.app.off('ui:input:blur', this.onUiInputBlur, this);
    });

    // Listen for chat focus/blur events
    this.app.on('ui:chat:focus', this.onChatFocus, this);
    this.app.on('ui:chat:blur', this.onChatBlur, this);
    this.app.on('ui:input:focus', this.onUiInputFocus, this);
    this.app.on('ui:input:blur', this.onUiInputBlur, this);

    this._setEvents('on');
};

TouchButton.prototype._setEvents = function (offOn) {
    this._state = false;

    this.entity.element[offOn]('mousedown', this._onMouseDown, this);
    this.entity.element[offOn]('mouseup', this._onMouseUp, this);

    if (this.app.touch) {
        this.entity.element[offOn]('touchstart', this._onTouchDown, this);
        this.entity.element[offOn]('touchend', this._onTouchUp, this);
        this.entity.element[offOn]('touchcancel', this._onTouchUp, this);
    }
};

TouchButton.prototype._onMouseDown = function (e) {
    if (!this._state) {
        this._onPointerDown();
        e.stopPropagation();
    }
};

TouchButton.prototype._onMouseUp = function (e) {
    if (this._state) {
        this._onPointerUp();
        e.stopPropagation();
    }
};

TouchButton.prototype._onTouchDown = function (e) {
    if (!this._state) {
        this._onPointerDown();
        e.stopPropagation();
    }
};

TouchButton.prototype._onTouchUp = function (e) {
    if (this._state) {
        this._onPointerUp();
        e.stopPropagation();
    }

    e.event.preventDefault();
};

TouchButton.prototype._onPointerDown = function () {
    // Don't respond to input if UI has locked controls
    if (this._isInputLocked()) return;
    
    if (this._canVibrate && this.vibration !== 0) {
        navigator.vibrate(this.vibration);
    }
    
    this._setState(true);
};

TouchButton.prototype._onPointerUp = function () {
    this._setState(false);
};

TouchButton.prototype._setState = function (state) {
    if (window.touchJoypad) {
        window.touchJoypad.buttonStates[this.identifier] = state ? Date.now() : null;
    }

    this._state = state;
};

TouchButton.prototype.onChatFocus = function() {
    this._chatFocused = true;
    // Reset button state when chat is focused
    this._setState(false);
    console.log("TouchButton: Chat focused - input disabled");
};

TouchButton.prototype.onChatBlur = function() {
    this._chatFocused = false;
    console.log("TouchButton: Chat blurred - input enabled");
};

TouchButton.prototype.onUiInputFocus = function(payload) {
    const reason = payload && payload.source ? String(payload.source) : 'ui-input';
    this._uiLockedReasons.add(reason);
    this._setState(false);
};

TouchButton.prototype.onUiInputBlur = function(payload) {
    const reason = payload && payload.source ? String(payload.source) : 'ui-input';
    if (reason) {
        this._uiLockedReasons.delete(reason);
    } else {
        this._uiLockedReasons.clear();
    }
};

TouchButton.prototype._isInputLocked = function() {
    return this._chatFocused || this._uiLockedReasons.size > 0;
};

// swap method called for script hot-reloading
// inherit your script state here
// TouchButton.prototype.swap = function(old) { };

// to learn more about script anatomy, please read:
// https://developer.playcanvas.com/en/user-manual/scripting/

