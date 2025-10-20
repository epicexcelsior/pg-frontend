var ReferralPanel = pc.createScript('referralPanel');

ReferralPanel.prototype.initialize = function () {
    this.configLoader = this.app.services ? this.app.services.get('configLoader') : null;
    this.feedbackService = this.app.services ? this.app.services.get('feedbackService') : null;
    this.privyManager = this.app.services ? this.app.services.get('privyManager') : null;

    this.apiBase = this.resolveApiBase();
    this.gameToken = null;
    this.profile = null;
    this.thresholdText = null;

    this.createUi();

    this.app.on('auth:stateChanged', this.onAuthStateChanged, this);
    this.app.on('auth:gameToken', this.onGameTokenReceived, this);

    try {
        const tokenService = this.app.services && typeof this.app.services.get === 'function'
            ? this.app.services.get('authToken')
            : null;
        if (tokenService && typeof tokenService.getToken === 'function') {
            const existingToken = tokenService.getToken();
            if (existingToken) {
                this.gameToken = existingToken;
            }
        }
    } catch (error) {
        console.warn('ReferralPanel: Failed to resolve authToken service.', error);
    }

    if (!this.gameToken) {
        this.gameToken = this.extractStoredToken();
    }

    if (this.privyManager && typeof this.privyManager.isAuthenticated === 'function' && this.privyManager.isAuthenticated()) {
        if (this.gameToken) {
            this.refreshProfile();
        }
    }
};

ReferralPanel.prototype.createUi = function () {
    if (document.getElementById('referral-panel-styles')) {
        document.getElementById('referral-panel-styles').remove();
    }

    var style = document.createElement('style');
    style.id = 'referral-panel-styles';
    style.innerHTML = this.buildStyles();
    document.head.appendChild(style);

    this.container = document.createElement('div');
    this.container.className = 'referral-widget';

    this.toggleButton = document.createElement('button');
    this.toggleButton.className = 'referral-toggle';
    this.toggleButton.textContent = 'Referral Rewards';
    this.toggleButton.setAttribute('data-sound', 'ui_click_default');
    this.toggleButton.addEventListener('click', this.togglePanel.bind(this));

    this.card = document.createElement('div');
    this.card.className = 'referral-card referral-hidden';

    var heading = document.createElement('h3');
    heading.className = 'referral-heading';
    heading.textContent = 'Referral Rewards';

    this.statusLabel = document.createElement('div');
    this.statusLabel.className = 'referral-status';

    this.codeRow = document.createElement('div');
    this.codeRow.className = 'referral-code-row';

    this.codeText = document.createElement('span');
    this.codeText.className = 'referral-code-text';
    this.codeText.textContent = '--';

    this.copyButton = document.createElement('button');
    this.copyButton.type = 'button';
    this.copyButton.className = 'referral-copy-btn';
    this.copyButton.textContent = 'Copy';
    this.copyButton.setAttribute('data-sound', 'ui_click_default');
    this.copyButton.addEventListener('click', this.copyCode.bind(this));

    this.codeRow.appendChild(this.codeText);
    this.codeRow.appendChild(this.copyButton);

    this.form = document.createElement('form');
    this.form.className = 'referral-form';
    this.form.addEventListener('submit', this.onSubmit.bind(this));

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.placeholder = 'Enter referral code';
    this.input.name = 'referralCode';
    this.input.autocomplete = 'off';
    this.input.maxLength = 8;

    this.submitButton = document.createElement('button');
    this.submitButton.type = 'submit';
    this.submitButton.className = 'referral-submit';
    this.submitButton.textContent = 'Apply';
    this.submitButton.setAttribute('data-sound', 'ui_click_default');

    this.form.appendChild(this.input);
    this.form.appendChild(this.submitButton);

    this.feedback = document.createElement('div');
    this.feedback.className = 'referral-feedback';

    this.card.appendChild(heading);
    this.card.appendChild(this.statusLabel);
    this.card.appendChild(this.codeRow);
    this.card.appendChild(this.form);
    this.card.appendChild(this.feedback);

    this.container.appendChild(this.toggleButton);
    this.container.appendChild(this.card);

    document.body.appendChild(this.container);

    this.updateUiState(false);
};

ReferralPanel.prototype.buildStyles = function () {
    return `
      .referral-widget {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 900;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 12px;
        font-family: var(--font-family, 'Segoe UI');
      }

      .referral-toggle {
        background: var(--surface-color, rgba(17, 17, 17, 0.92));
        color: var(--text-color, #fff);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: var(--border-radius, 12px);
        padding: 10px 18px;
        cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }

      .referral-toggle:hover {
        transform: translateY(-1px);
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.25);
      }

      .referral-card {
        width: min(320px, 90vw);
        background: var(--surface2-color, rgba(34, 34, 34, 0.95));
        color: var(--text-color, #fff);
        border-radius: var(--border-radius, 16px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 18px 36px rgba(0, 0, 0, 0.35);
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .referral-hidden {
        display: none;
      }

      .referral-heading {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        letter-spacing: 0.02em;
      }

      .referral-status {
        font-size: 14px;
        color: var(--text-muted-color, rgba(255, 255, 255, 0.8));
      }

      .referral-code-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(255, 255, 255, 0.06);
        border-radius: 12px;
        padding: 8px 12px;
        font-family: 'Roboto Mono', monospace;
        font-size: 15px;
      }

      .referral-code-text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 200px;
      }

      .referral-copy-btn {
        background: rgba(255, 255, 255, 0.08);
        color: var(--text-color, #fff);
        border: none;
        padding: 4px 10px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 12px;
      }

      .referral-copy-btn:hover {
        background: rgba(255, 255, 255, 0.14);
      }

      .referral-form {
        display: flex;
        gap: 8px;
      }

      .referral-form input {
        flex: 1;
        padding: 10px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.05);
        color: var(--text-color, #fff);
        font-size: 14px;
      }

      .referral-submit {
        background: var(--primary-color, #1d9bf0);
        color: #fff;
        border: none;
        border-radius: 10px;
        padding: 10px 16px;
        cursor: pointer;
        font-weight: 600;
      }

      .referral-submit:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .referral-feedback {
        font-size: 13px;
        min-height: 18px;
        color: var(--text-muted-color, rgba(255, 255, 255, 0.75));
      }

      @media (max-width: 540px) {
        .referral-widget {
          right: 12px;
          bottom: 12px;
        }
      }
    `;
};

ReferralPanel.prototype.togglePanel = function () {
    if (!this.card) {
        return;
    }
    const hidden = this.card.classList.contains('referral-hidden');
    this.card.classList.toggle('referral-hidden', !hidden);
    if (hidden && !this.profile) {
        this.refreshProfile();
    }
};

ReferralPanel.prototype.onAuthStateChanged = function (event) {
    const isConnected = event && event.state === 'connected';
    if (!isConnected) {
        this.gameToken = null;
        this.profile = null;
        this.updateUiState(false);
        this.feedback.textContent = 'Log in to manage referrals.';
        return;
    }

    this.gameToken = this.extractStoredToken();
    this.refreshProfile();
};

ReferralPanel.prototype.onGameTokenReceived = function (payload) {
    var token = null;
    if (payload && typeof payload === 'object') {
        token = typeof payload.token === 'string' ? payload.token : null;
    } else if (typeof payload === 'string') {
        token = payload;
    }

    if (!token || !token.trim().length) {
        return;
    }

    this.gameToken = token.trim();
    this.refreshProfile();
};

ReferralPanel.prototype.updateUiState = function (enabled) {
    if (!this.submitButton || !this.input || !this.copyButton) {
        return;
    }
    this.submitButton.disabled = !enabled;
    this.input.disabled = !enabled;
    this.copyButton.disabled = !enabled || !this.codeText || this.codeText.textContent === '--';
};

ReferralPanel.prototype.resolveApiBase = function () {
    if (!this.configLoader || typeof this.configLoader.get !== 'function') {
        return null;
    }
    const directBase = this.configLoader.get('apiBaseUrl');
    if (typeof directBase === 'string' && directBase.trim().length) {
        return directBase.trim().replace(/\/+$/, '');
    }
    const endpoint = this.configLoader.get('colyseusEndpoint');
    if (!endpoint || typeof endpoint !== 'string') {
        return null;
    }
    try {
        const baseUrl = endpoint.startsWith('ws')
            ? endpoint.replace(/^ws(s)?:/, (_, secure) => (secure ? 'https:' : 'http:'))
            : endpoint;
        const parsed = new URL(baseUrl);
        return `${parsed.protocol}//${parsed.host}`;
    } catch (error) {
        console.error('ReferralPanel: Failed to derive API base from colyseusEndpoint.', error);
        return null;
    }
};

ReferralPanel.prototype.getAuthToken = function () {
    if (this.gameToken) {
        return this.gameToken;
    }
    const stored = this.extractStoredToken();
    if (stored) {
        this.gameToken = stored;
    }
    return this.gameToken;
};

ReferralPanel.prototype.extractStoredToken = function () {
    try {
        const stored = localStorage.getItem('pgGameJwt');
        if (!stored) {
            return null;
        }
        const trimmed = stored.trim();
        if (!trimmed.length) {
            return null;
        }
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed.token === 'string' && parsed.token.length) {
                return parsed.token;
            }
        } catch (error) {
            // Stored value is not JSON - fall back to raw string.
        }
        return trimmed;
    } catch (error) {
        return null;
    }
};

ReferralPanel.prototype.refreshProfile = async function () {
    if (!this.apiBase) {
        this.apiBase = this.resolveApiBase();
    }
    const token = this.getAuthToken();
    if (!token || !this.apiBase) {
        this.updateUiState(false);
        return;
    }

    try {
        const response = await fetch(`${this.apiBase}/referrals/me`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
            },
            credentials: 'include',
        });

        if (response.status === 401) {
            this.handleUnauthorized();
            return;
        }

        const payload = await response.json().catch(function () { return null; });
        if (!response.ok) {
            const message = payload && payload.message ? payload.message : `Failed to load referral profile (${response.status})`;
            throw new Error(message);
        }
        this.profile = payload;
        this.thresholdText = payload.minDonationSol || null;
        this.renderProfile();
        this.updateUiState(true);
    } catch (error) {
        console.error('ReferralPanel: Failed to fetch profile', error);
        this.feedback.textContent = 'Unable to load referral info. Try again later.';
        this.updateUiState(false);
    }
};

ReferralPanel.prototype.renderProfile = function () {
    if (!this.profile) {
        this.statusLabel.textContent = 'No referral data yet.';
        this.codeText.textContent = '--';
        return;
    }

    const status = this.profile.status;
    const code = this.profile.code || '--';
    const total = Number(this.profile.totalCredited || 0);

    this.codeText.textContent = code;

    if (status === 'credited') {
        this.statusLabel.textContent = `Referral complete! Rewards granted. (${total} friend${total === 1 ? '' : 's'} credited)`;
    } else if (status === 'pending') {
        this.statusLabel.textContent = `Referral saved. Donate at least ${this.thresholdText || 'the minimum'} SOL to unlock rewards.`;
    } else {
        this.statusLabel.textContent = `Share your code and donate ${this.thresholdText || 'the minimum'} SOL to receive bonuses.`;
    }

    this.feedback.textContent = '';
};

ReferralPanel.prototype.copyCode = function () {
    if (!this.profile || !this.profile.code) {
        return;
    }
    try {
        navigator.clipboard.writeText(this.profile.code);
        if (this.feedbackService && typeof this.feedbackService.showSuccess === 'function') {
            this.feedbackService.showSuccess('Referral code copied!');
        } else {
            this.feedback.textContent = 'Code copied to clipboard.';
        }
    } catch (error) {
        console.warn('ReferralPanel: Clipboard copy failed.', error);
        this.feedback.textContent = 'Copy failed. Please copy manually.';
    }
};

ReferralPanel.prototype.onSubmit = async function (event) {
    event.preventDefault();
    const code = this.input.value.trim().toLowerCase();
    if (!code) {
        this.feedback.textContent = 'Enter a referral code to apply it.';
        this.input.focus();
        return;
    }

    const token = this.getAuthToken();
    if (!token || !this.apiBase) {
        this.feedback.textContent = 'Log in to apply a referral code.';
        return;
    }

    this.updateUiState(false);
    this.feedback.textContent = 'Applying referral code...';

    try {
        const response = await fetch(`${this.apiBase}/referrals/redeem-code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            credentials: 'include',
            body: JSON.stringify({ code }),
        });

        if (response.status === 401) {
            this.handleUnauthorized();
            return;
        }

        const payload = await response.json().catch(function () { return null; });
        if (!response.ok) {
            const message = payload && payload.message ? payload.message : 'Unable to apply referral code.';
            throw new Error(message);
        }

        if (this.feedbackService && typeof this.feedbackService.showSuccess === 'function') {
            const statusText = payload && payload.status === 'pending' ? 'saved. Rewards unlock after your first donation.' : 'already applied.';
            this.feedbackService.showSuccess(`Referral code ${statusText}`);
        } else {
            this.feedback.textContent = 'Code saved! Rewards unlock after your first qualifying donation.';
        }

        this.input.value = '';
        this.profile = null;
        await this.refreshProfile();
    } catch (error) {
        console.error('ReferralPanel: Failed to redeem code', error);
        const message = error && error.message ? error.message : 'Unable to apply referral code.';
        if (this.feedbackService && typeof this.feedbackService.showError === 'function') {
            this.feedbackService.showError(message);
        } else {
            this.feedback.textContent = message;
        }
        this.updateUiState(true);
    }
};

ReferralPanel.prototype.handleUnauthorized = function () {
    this.gameToken = null;
    try {
        localStorage.removeItem('pgGameJwt');
    } catch (error) {
        // ignore
    }
    this.updateUiState(false);
    this.feedback.textContent = 'Session expired. Please log in again.';
    this.profile = null;
};

ReferralPanel.prototype.destroy = function () {
    this.app.off('auth:stateChanged', this.onAuthStateChanged, this);
    this.app.off('auth:gameToken', this.onGameTokenReceived, this);
    if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
    }
};



