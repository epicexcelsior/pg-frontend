var LeaderboardTextRenderer = pc.createScript('leaderboardTextRenderer');

LeaderboardTextRenderer.attributes.add('leaderboardType', {
    type: 'string',
    enum: [
        { 'Top Donators': 'topDonators' },
        { 'Top Receivers': 'topReceivers' },
        { 'Top Referrals': 'topReferrals' }
    ],
    default: 'topDonators'
});

LeaderboardTextRenderer.attributes.add('rankIndex', {
    type: 'number',
    default: 0,
    min: 0,
    max: 2
});

LeaderboardTextRenderer.prototype.initialize = function () {
    this.textComponent = null;
    this.syncScript = null;
    this._initialized = false;

    this.findTextComponent();
    this.findSyncScript();

    if (this.textComponent && this.syncScript) {
        this._setupListeners();
    } else if (this.textComponent && !this.syncScript) {
        this.app.on('leaderboard:data:updated', this._tryLateInit, this);
    }
};

LeaderboardTextRenderer.prototype._setupListeners = function () {
    if (this._initialized) return;
    this._initialized = true;
    this.app.on('leaderboard:data:updated', this.onDataUpdated, this);
    this.updateText();
};

LeaderboardTextRenderer.prototype._tryLateInit = function () {
    if (this._initialized) return;
    if (!this.syncScript) {
        this.findSyncScript();
    }
    if (this.syncScript && this.textComponent) {
        this.app.off('leaderboard:data:updated', this._tryLateInit, this);
        this._setupListeners();
    }
};

LeaderboardTextRenderer.prototype.findTextComponent = function () {
    if (!this.entity) return;

    if (this.entity.element && this.entity.element instanceof pc.TextComponent) {
        this.textComponent = this.entity.element;
        return;
    }

    var textComponent = this.entity.findByName('TextElement');
    if (textComponent && textComponent.element instanceof pc.TextComponent) {
        this.textComponent = textComponent.element;
        return;
    }
};

LeaderboardTextRenderer.prototype.findSyncScript = function () {
    if (!this.app || !this.app.root) return;

    var entity = this.app.root;
    var findSync = function (node) {
        if (!node) return;
        
        if (node.script && node.script.leaderboardTextSync) {
            return node.script.leaderboardTextSync;
        }
        
        if (node.children) {
            for (var i = 0; i < node.children.length; i++) {
                var result = findSync(node.children[i]);
                if (result) return result;
            }
        }
        return null;
    };

    this.syncScript = findSync(entity);
};

LeaderboardTextRenderer.prototype.updateText = function () {
    if (!this.textComponent) {
        return;
    }

    var text = '';
    if (this.syncScript) {
        text = this.syncScript.getFormattedEntry(this.leaderboardType, this.rankIndex) || '';
    }

    this.textComponent.string = text;
};

LeaderboardTextRenderer.prototype.onDataUpdated = function () {
    this.updateText();
};

LeaderboardTextRenderer.prototype.destroy = function () {
    this.app.off('leaderboard:data:updated', this.onDataUpdated, this);
    this.app.off('leaderboard:data:updated', this._tryLateInit, this);
};
