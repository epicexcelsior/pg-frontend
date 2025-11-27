var InputManager = pc.createScript('inputManager');

InputManager.prototype.initialize = function() {
    this.blockers = new Set();
    this.isFocusedOnInput = false;
    
    // Bind events
    this._onFocus = this._handleFocus.bind(this);
    this._onBlur = this._handleBlur.bind(this);
    
    // Listen to global focus/blur events to detect input interaction
    window.addEventListener('focus', this._onFocus, true);
    window.addEventListener('blur', this._onBlur, true);
    
    // Expose to app
    this.app.inputManager = this;
    
    console.log('InputManager initialized');
};

InputManager.prototype.swap = function(old) {
    this.blockers = old.blockers;
    this.isFocusedOnInput = old.isFocusedOnInput;
    
    // Bind events
    this._onFocus = this._handleFocus.bind(this);
    this._onBlur = this._handleBlur.bind(this);
    
    // Listen to global focus/blur events
    window.addEventListener('focus', this._onFocus, true);
    window.addEventListener('blur', this._onBlur, true);
    
    // Expose to app
    this.app.inputManager = this;
    
    console.log('InputManager hot-reloaded');
};

InputManager.prototype._handleFocus = function(event) {
    const target = event.target;
    if (this._isInputElement(target)) {
        this.isFocusedOnInput = true;
        this.app.fire('input:blocked', { source: 'focus', target: target });
    }
};

InputManager.prototype._handleBlur = function(event) {
    const target = event.target;
    if (this._isInputElement(target)) {
        // Small delay to check if we moved to another input
        setTimeout(() => {
            if (document.activeElement && this._isInputElement(document.activeElement)) {
                return;
            }
            this.isFocusedOnInput = false;
            this.app.fire('input:unblocked', { source: 'blur', target: target });
        }, 10);
    }
};

InputManager.prototype._isInputElement = function(element) {
    if (!element || typeof element.tagName !== 'string') return false;
    const tagName = element.tagName.toLowerCase();
    const isEditable = element.isContentEditable;
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || isEditable;
};

/**
 * Manually add a blocker (e.g. when a modal is open)
 * @param {string} id - Unique identifier for the blocker
 */
InputManager.prototype.addBlocker = function(id) {
    this.blockers.add(id);
    this.app.fire('input:blocked', { source: 'manual', id: id });
};

/**
 * Remove a manual blocker
 * @param {string} id - Unique identifier for the blocker
 */
InputManager.prototype.removeBlocker = function(id) {
    this.blockers.delete(id);
    if (!this.isGameInputBlocked()) {
        this.app.fire('input:unblocked', { source: 'manual', id: id });
    }
};

/**
 * Check if game input should be blocked
 * @returns {boolean}
 */
InputManager.prototype.isGameInputBlocked = function() {
    return this.isFocusedOnInput || this.blockers.size > 0;
};

InputManager.prototype.destroy = function() {
    window.removeEventListener('focus', this._onFocus, true);
    window.removeEventListener('blur', this._onBlur, true);
    if (this.app.inputManager === this) {
        this.app.inputManager = null;
    }
};
