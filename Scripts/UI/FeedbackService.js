// Scripts/UI/FeedbackService.js
var FeedbackService = pc.createScript('feedbackService');

// --- Attributes for HTML/CSS Assets ---
FeedbackService.attributes.add('cssAsset', {
    type: 'asset',
    assetType: 'css',
    title: 'Feedback UI CSS'
});
FeedbackService.attributes.add('htmlAsset', {
    type: 'asset',
    assetType: 'html',
    title: 'Feedback UI HTML'
});
// --- End Attributes ---

/**
 * @class FeedbackService
 * @description Handles displaying various types of UI feedback messages (toasts, modals)
 * using dynamically injected HTML and CSS.
 */
FeedbackService.prototype.initialize = function() {
    console.log("FeedbackService initializing...");
    this.activeToasts = [];
    this.modalElement = null;
    this.modalOverlay = null;
    this.modalTitle = null;
    this.modalMessage = null;
    this.modalActions = null;
    this.modalCloseBtn = null;
    this.toastContainer = null;
    this.inlineLoadingElements = new Map(); // Store refs to elements with inline loading

    // Inject CSS
    if (this.cssAsset?.resource) {
        const style = document.createElement('style');
        document.head.appendChild(style);
        style.innerHTML = this.cssAsset.resource;
    } else {
        console.warn("FeedbackService: CSS Asset not found or loaded.");
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
        console.warn("FeedbackService: HTML Asset not found or loaded.");
        this.htmlAsset?.ready(asset => this.injectHtml(asset.resource));
    }

    // Register with Services if available (adjust based on your project structure)
    if (this.app.services && typeof this.app.services.register === 'function') {
        this.app.services.register('feedbackService', this);
    } else {
        // Fallback: Make it globally accessible (less ideal but works)
        window.feedbackService = this;
        console.warn("FeedbackService: Services registry not found, registered globally as window.feedbackService.");
    }

    // Listen for Grid-specific events
    this.app.on('grid:showSpendingLimitModal', this.onShowSpendingLimitModal, this);

    console.log("FeedbackService initialized.");
};

FeedbackService.prototype.injectHtml = function(htmlResource) {
    if (this.uiRoot) return; // Already injected

    this.uiRoot = document.createElement('div');
    this.uiRoot.innerHTML = htmlResource;
    document.body.appendChild(this.uiRoot);

    // Find elements
    this.toastContainer = this.uiRoot.querySelector('#feedback-toast-container');
    this.modalOverlay = this.uiRoot.querySelector('#feedback-modal-overlay');
    this.modalElement = this.uiRoot.querySelector('#feedback-modal-content'); // This is the dialog content box
    this.modalTitle = this.uiRoot.querySelector('#feedback-modal-title');
    this.modalMessage = this.uiRoot.querySelector('#feedback-modal-message');
    this.modalActions = this.uiRoot.querySelector('#feedback-modal-actions');
    this.modalCloseBtn = this.uiRoot.querySelector('#feedback-modal-close-btn');

    if (!this.toastContainer || !this.modalOverlay || !this.modalElement || !this.modalTitle || !this.modalMessage || !this.modalActions || !this.modalCloseBtn) {
        console.error("FeedbackService: Could not find all required UI elements in HTML.");
        // Clean up partially injected elements?
        if (this.uiRoot.parentNode) {
            this.uiRoot.parentNode.removeChild(this.uiRoot);
        }
        this.uiRoot = null;
        return;
    }

    // Add inline styles to ensure modal overlay is prominent (Temporary - should be in CSS)
    if (this.modalOverlay) {
        this.modalOverlay.style.position = 'fixed';
        this.modalOverlay.style.top = '0';
        this.modalOverlay.style.left = '0';
        this.modalOverlay.style.width = '100%';
        this.modalOverlay.style.height = '100%';
        this.modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'; // Semi-transparent black background
        this.modalOverlay.style.zIndex = '1000'; // Ensure it's on top
        this.modalOverlay.style.display = 'flex'; // Use flexbox for centering content
        this.modalOverlay.style.justifyContent = 'center';
        this.modalOverlay.style.alignItems = 'center';
    }

    if (!this.toastContainer || !this.modalOverlay || !this.modalElement || !this.modalTitle || !this.modalMessage || !this.modalActions || !this.modalCloseBtn) {
        console.error("FeedbackService: Could not find all required UI elements in HTML.");
        // Clean up partially injected elements?
        if (this.uiRoot.parentNode) {
            this.uiRoot.parentNode.removeChild(this.uiRoot);
        }
        this.uiRoot = null;
        return;
    }

    // --- Add Accessibility Attributes ---
    if (this.toastContainer) {
        this.toastContainer.setAttribute('aria-live', 'polite'); // Announce toasts politely
        this.toastContainer.setAttribute('aria-atomic', 'true'); // Read whole toast
    }
    if (this.modalOverlay) {
        // The overlay itself doesn't need role, the content does
    }
    if (this.modalElement) {
        this.modalElement.setAttribute('role', 'dialog'); // Or 'alertdialog' if always critical
        this.modalElement.setAttribute('aria-modal', 'true');
        // Link title and message for screen readers
        if (this.modalTitle) this.modalElement.setAttribute('aria-labelledby', 'feedback-modal-title');
        if (this.modalMessage) this.modalElement.setAttribute('aria-describedby', 'feedback-modal-message');
    }
    // Close button already has aria-label in HTML

    // Add close listener for modal
    this.modalCloseBtn.addEventListener('click', () => this.hideBlockingPrompt());
    // Close modal if clicking outside the content area (modalElement)
    this.modalOverlay.addEventListener('click', (event) => {
        if (event.target === this.modalOverlay) {
            this.hideBlockingPrompt();
        }
    });


    console.log("FeedbackService: HTML injected and elements found.");
};


// --- Toast Implementation ---

FeedbackService.prototype._showToast = function(message, type = 'info', duration = 5000) {
    if (!this.toastContainer) {
        console.error("FeedbackService: Toast container not found.");
        return;
    }

    const toast = document.createElement('div');
    toast.className = `feedback-toast ${type}`;
    toast.textContent = message; // Use textContent for security
    // Add role="status" for polite announcements or "alert" for assertive ones based on type
    toast.setAttribute('role', (type === 'error' || type === 'warning') ? 'alert' : 'status');


    this.toastContainer.appendChild(toast);
    this.activeToasts.push(toast);

    // Auto-remove after duration
    const timeoutId = setTimeout(() => {
        this.removeToast(toast);
    }, duration);

    // Store timeout ID for potential manual removal
    toast.dataset.timeoutId = timeoutId;

    // Optional: Add click to dismiss
    // toast.addEventListener('click', () => this.removeToast(toast));
};

FeedbackService.prototype.removeToast = function(toastElement) {
    if (!toastElement || !this.toastContainer) return;

    // Clear timeout if it exists
    const timeoutId = toastElement.dataset.timeoutId;
    if (timeoutId) {
        clearTimeout(parseInt(timeoutId, 10));
    }

    // Animate out (optional)
    toastElement.classList.add('fade-out');

    // Remove from DOM after animation
    setTimeout(() => {
        if (toastElement.parentNode === this.toastContainer) {
            this.toastContainer.removeChild(toastElement);
        }
        // Remove from active list
        this.activeToasts = this.activeToasts.filter(t => t !== toastElement);
    }, 300); // Match CSS transition duration
};


/**
 * Shows a success message (e.g., as a toast).
 * @param {string} message - The message to display.
 * @param {number} [duration=5000] - Optional duration in ms before auto-hiding.
 */
FeedbackService.prototype.showSuccess = function(message, duration = 5000) {
    console.log(`[SUCCESS] ${message}`);
    this._showToast(message, 'success', duration);
};

/**
 * Shows an error message (e.g., as a toast or modal).
 * @param {string} message - The primary error message.
 * @param {string} [details] - Optional detailed information for console or expandable view.
 * @param {boolean} [isCritical=false] - Optional flag for critical errors that might need persistence.
 */
FeedbackService.prototype.showError = function(message, details, isCritical = false) {
    console.error(`[ERROR] ${message}${details ? ` | Details: ${details}` : ''} (Critical: ${isCritical})`);
    // For now, always show errors as toasts. Could add logic for critical modals later.
    this._showToast(`${message}${details ? ` (${details.substring(0, 50)}...)` : ''}`, 'error', isCritical ? 15000 : 7000); // Longer duration for errors
};

/**
 * Shows an informational message (e.g., as a toast).
 * @param {string} message - The message to display.
 * @param {number} [duration=5000] - Optional duration in ms before auto-hiding.
 */
FeedbackService.prototype.showInfo = function(message, duration = 5000) {
    console.log(`[INFO] ${message}`);
    this._showToast(message, 'info', duration);
};

/**
 * Shows a warning message (e.g., as a toast).
 * @param {string} message - The message to display.
 * @param {number} [duration=7000] - Optional duration in ms before auto-hiding.
 */
FeedbackService.prototype.showWarning = function(message, duration = 7000) {
    console.warn(`[WARNING] ${message}`);
    this._showToast(message, 'warning', duration);
};


// --- Modal Implementation ---

/**
 * Shows a blocking message or prompt (e.g., a modal).
 * @param {string} title - The title for the modal/prompt.
 * @param {string} message - The main message content.
 * @param {Array<object>} [actions] - Optional array of action buttons (e.g., { label: 'OK', callback: () => {}, type: 'primary'/'secondary' }).
 */
FeedbackService.prototype.showBlockingPrompt = function(title, message, actions = []) {
    if (!this.modalOverlay || !this.modalTitle || !this.modalMessage || !this.modalActions) {
        console.error("FeedbackService: Modal elements not found.");
        return;
    }
    console.log(`[PROMPT] Title: ${title} | Message: ${message} | Actions: ${actions.length}`);

    this.modalTitle.textContent = title;
    this.modalMessage.textContent = message;

    // Clear previous actions
    this.modalActions.innerHTML = '';

    // Add new actions
    if (actions.length === 0) {
        // Add a default OK button if no actions provided
        actions.push({ label: 'OK', callback: () => {}, type: 'primary' });
    }

    actions.forEach(action => {
        const button = document.createElement('button');
        button.textContent = action.label;
        button.className = `feedback-modal-button ${action.type || 'secondary'}`; // Default to secondary
        
        // Apply custom inline styles if provided
        if (action.style) {
            for (const key in action.style) {
                if (action.style.hasOwnProperty(key)) {
                    button.style[key] = action.style[key];
                }
            }
        }

        button.onclick = () => {
            this.hideBlockingPrompt(); // Hide modal first
            if (action.callback && typeof action.callback === 'function') {
                action.callback(); // Execute callback
            }
        };
        this.modalActions.appendChild(button);
    });

    // Show modal
    this.modalOverlay.classList.remove('feedback-modal-hidden');

    // Focus management for accessibility
    // Find the first focusable element (button) in the modal actions or the close button
    const firstFocusable = this.modalActions.querySelector('button') || this.modalCloseBtn;
    if (firstFocusable) {
        // Timeout needed to ensure element is visible before focusing
        setTimeout(() => firstFocusable.focus(), 100);
    }
};

/**
 * Hides any currently active blocking prompt/modal.
 */
FeedbackService.prototype.hideBlockingPrompt = function() {
    if (!this.modalOverlay) return;
    console.log("[PROMPT] Hide");
    // Store reference to element that had focus before modal opened, to restore it on close
    this._elementFocusedBeforeModal = document.activeElement;

    this.modalOverlay.classList.add('feedback-modal-hidden');

    // Restore focus to the element that had it before the modal opened
    if (this._elementFocusedBeforeModal && typeof this._elementFocusedBeforeModal.focus === 'function') {
        this._elementFocusedBeforeModal.focus();
    }
    this._elementFocusedBeforeModal = null; // Clear reference
};


// --- Inline Loading Implementation ---

/**
 * Shows an inline loading indicator associated with a specific element.
 * @param {string|HTMLElement} elementRef - A selector string or element reference.
 * @param {string} [message] - Optional message to display alongside the spinner.
 */
FeedbackService.prototype.showInlineLoading = function(elementRef, message = 'Loading...') {
    let element = typeof elementRef === 'string' ? document.querySelector(elementRef) : elementRef;
    if (!element) {
        console.warn(`[LOADING] Element not found for ref: ${elementRef}`);
        return;
    }
    console.log(`[LOADING] Show for Element: ${elementRef} | Message: ${message}`);

    // Prevent adding multiple spinners
    if (this.inlineLoadingElements.has(element)) {
        // Update message if needed
        const existingData = this.inlineLoadingElements.get(element);
        if (existingData.messageElement && message) {
            existingData.messageElement.textContent = message;
        }
        return;
    }

    element.classList.add('element-loading');
    const originalContent = element.innerHTML; // Store original content (simple case)
    // For buttons, might want to store original text and disable
    const isButton = element.tagName === 'BUTTON';
    const originalButtonText = isButton ? element.textContent : null;
    if (isButton) element.disabled = true;


    // Create spinner and message container
    const spinnerContainer = document.createElement('span');
    spinnerContainer.style.display = 'inline-flex'; // Align items nicely
    spinnerContainer.style.alignItems = 'center';

    const spinner = document.createElement('span');
    spinner.className = 'inline-spinner'; // From CSS
    spinner.setAttribute('role', 'status'); // Indicate loading status
    spinner.setAttribute('aria-label', 'Loading'); // Provide accessible name

    spinnerContainer.appendChild(spinner);

    let messageElement = null;
    if (message) {
        messageElement = document.createElement('span');
        messageElement.textContent = message;
        messageElement.style.marginLeft = '8px'; // Space between spinner and text
        spinnerContainer.appendChild(messageElement);
    }

    // Replace element content (adjust if element shouldn't be fully replaced)
    element.innerHTML = '';
    element.appendChild(spinnerContainer);

    // Store references for cleanup
    this.inlineLoadingElements.set(element, {
        spinnerContainer: spinnerContainer,
        messageElement: messageElement, // Store message element ref
        originalContent: originalContent, // Store original HTML
        originalButtonText: originalButtonText, // Store original button text
        isButton: isButton
    });
};

/**
 * Hides an inline loading indicator associated with a specific element.
 * @param {string|HTMLElement} elementRef - A selector string or element reference.
 */
FeedbackService.prototype.hideInlineLoading = function(elementRef) {
    let element = typeof elementRef === 'string' ? document.querySelector(elementRef) : elementRef;
     if (!element) {
        // Don't warn if element is gone, might have been removed by other logic
        // console.warn(`[LOADING] Hide: Element not found for ref: ${elementRef}`);
        // Clean up map entry if elementRef is the key?
        if (typeof elementRef !== 'string') { // If it was an element reference
             this.inlineLoadingElements.delete(elementRef);
        }
        return;
    }

    if (this.inlineLoadingElements.has(element)) {
        console.log(`[LOADING] Hide for Element: ${elementRef}`);
        const data = this.inlineLoadingElements.get(element);

        // Restore original content/text
        if (data.isButton && data.originalButtonText !== null) {
             element.innerHTML = ''; // Clear spinner container
             element.textContent = data.originalButtonText;
             element.disabled = false;
        } else if (data.originalContent !== null) {
            element.innerHTML = data.originalContent; // Restore original HTML
        } else {
             // Fallback: just remove the spinner container if original wasn't stored well
             if(data.spinnerContainer && data.spinnerContainer.parentNode === element) {
                 element.removeChild(data.spinnerContainer);
             }
        }


        element.classList.remove('element-loading');
        this.inlineLoadingElements.delete(element);
    } else {
         // If hide is called but element wasn't tracked, ensure class/disabled state is reset
         element.classList.remove('element-loading');
         if (element.tagName === 'BUTTON') element.disabled = false;
    }
};

// --- Grid Spending Limit Modal ---

FeedbackService.prototype.onShowSpendingLimitModal = function(data) {
    const { currentAmount, recipient, reason } = data;
    
    this.showSpendingLimitModal(currentAmount, recipient, reason);
};

FeedbackService.prototype.showSpendingLimitModal = function(currentAmount, recipient, reason = 'Spending limit exceeded') {
    const title = "Set Spending Limit";
    const message = `${reason} To complete this ${currentAmount} SOL donation, please set or increase your daily spending limit.`;
    
    const actions = [
        {
            label: 'Set Limit & Continue',
            callback: () => this.promptForSpendingLimit(currentAmount, recipient),
            type: 'primary'
        },
        {
            label: 'Cancel',
            callback: () => {},
            type: 'secondary'
        }
    ];
    
    this.showBlockingPrompt(title, message, actions);
};

FeedbackService.prototype.promptForSpendingLimit = function(currentAmount, recipient) {
    // Create a more advanced modal with input fields
    const title = "Set Daily Spending Limit";
    const suggestedLimit = Math.max(currentAmount * 2, 1); // Suggest at least double the current amount, minimum 1 SOL
    
    // Create custom modal content for spending limit input
    const customContent = `
        <div style="margin: 16px 0;">
            <label for="spending-limit-input" style="display: block; margin-bottom: 8px; color: #ccc; font-size: 14px;">
                Daily spending limit (SOL):
            </label>
            <input type="number" 
                   id="spending-limit-input" 
                   placeholder="${suggestedLimit}" 
                   min="0.001" 
                   step="0.001" 
                   style="width: 100%; padding: 12px; border: 2px solid #333; border-radius: 8px; background: #1a1a2e; color: #fff; font-size: 16px;">
            <div style="margin-top: 8px; font-size: 12px; color: #888;">
                Suggested: ${suggestedLimit} SOL (for this ${currentAmount} SOL donation)
            </div>
        </div>
        <div style="margin: 16px 0;">
            <label for="otp-limit-input" style="display: block; margin-bottom: 8px; color: #ccc; font-size: 14px;">
                Email verification code:
            </label>
            <input type="text" 
                   id="otp-limit-input" 
                   placeholder="Enter OTP from email" 
                   style="width: 100%; padding: 12px; border: 2px solid #333; border-radius: 8px; background: #1a1a2e; color: #fff; font-size: 16px;">
            <div style="margin-top: 8px; font-size: 12px; color: #888;">
                Check your email for the verification code
            </div>
        </div>
    `;
    
    // Replace modal message with custom input form
    if (this.modalMessage) {
        this.modalMessage.innerHTML = customContent;
    }
    
    if (this.modalTitle) {
        this.modalTitle.textContent = title;
    }
    
    // Clear and set up new actions
    if (this.modalActions) {
        this.modalActions.innerHTML = '';
        
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Update Limit';
        confirmBtn.className = 'feedback-modal-button primary';
        confirmBtn.onclick = () => this.submitSpendingLimit(currentAmount, recipient);
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'feedback-modal-button secondary';
        cancelBtn.onclick = () => this.hideBlockingPrompt();
        
        this.modalActions.appendChild(confirmBtn);
        this.modalActions.appendChild(cancelBtn);
    }
    
    // Show modal if not already visible
    if (this.modalOverlay) {
        this.modalOverlay.classList.remove('feedback-modal-hidden');
    }
    
    // Focus the spending limit input
    setTimeout(() => {
        const limitInput = document.getElementById('spending-limit-input');
        if (limitInput) limitInput.focus();
    }, 100);
};

FeedbackService.prototype.submitSpendingLimit = async function(currentAmount, recipient) {
    const limitInput = document.getElementById('spending-limit-input');
    const otpInput = document.getElementById('otp-limit-input');
    
    if (!limitInput || !otpInput) {
        console.error("FeedbackService: Spending limit inputs not found");
        return;
    }
    
    const limitValue = parseFloat(limitInput.value.trim());
    const otpValue = otpInput.value.trim();
    
    if (!limitValue || limitValue <= 0) {
        this.showError("Invalid Limit", "Please enter a valid spending limit amount.");
        return;
    }
    
    if (!otpValue) {
        this.showError("Missing OTP", "Please enter the verification code from your email.");
        return;
    }
    
    try {
        // Get services
        const authService = this.app.services?.get('authService');
        const configLoader = this.app.config;
        
        if (!authService || !configLoader) {
            throw new Error("Required services not available");
        }
        
        const gridSpendingLimitUrl = configLoader.get('cloudflareWorkerGridSpendingLimitEndpoint');
        const sessionToken = authService.getSessionToken();
        
        if (!gridSpendingLimitUrl || !sessionToken) {
            throw new Error("Grid configuration or session not available");
        }
        
        // Show loading state
        this.showInfo("Updating spending limit...", 10000);
        
        // Convert SOL to lamports for Grid API
        const limitLamports = Math.round(limitValue * 1000000000);
        
        const response = await fetch(gridSpendingLimitUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
                policy: {
                    daily_limit: {
                        amount: limitLamports,
                        currency: 'lamports'
                    }
                },
                otp: otpValue
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to update spending limit');
        }
        
        this.hideBlockingPrompt();
        this.showSuccess(`Daily spending limit updated to ${limitValue} SOL! You can now retry your donation.`);
        
        console.log("FeedbackService: Spending limit updated successfully");
        
    } catch (error) {
        console.error("FeedbackService: Failed to update spending limit:", error);
        this.showError("Update Failed", error.message);
    }
};

FeedbackService.prototype.destroy = function() {
    // Clean up event listeners
    this.app.off('grid:showSpendingLimitModal', this.onShowSpendingLimitModal, this);
    
    // Clean up injected elements
    if (this.uiRoot && this.uiRoot.parentNode) {
        this.uiRoot.parentNode.removeChild(this.uiRoot);
    }
    this.uiRoot = null;
    this.toastContainer = null;
    this.modalOverlay = null;
    // ... nullify other element refs

    // Clear any remaining timeouts for toasts
    this.activeToasts.forEach(toast => {
        const timeoutId = toast.dataset.timeoutId;
        if (timeoutId) clearTimeout(parseInt(timeoutId, 10));
    });
    this.activeToasts = [];

    // Clear inline loading map
    this.inlineLoadingElements.clear();

    console.log("FeedbackService destroyed.");
};

// --- Global Instance (Adjust based on project structure) ---
// var feedbackService = new FeedbackService(); // This is handled by PlayCanvas script system