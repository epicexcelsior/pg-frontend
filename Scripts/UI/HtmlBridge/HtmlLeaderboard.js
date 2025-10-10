// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\UI\HtmlBridge\HtmlLeaderboard.js
var HtmlLeaderboard = pc.createScript('htmlLeaderboard');

HtmlLeaderboard.prototype.initialize = function () {
    this.container = this.createContainer();
    this.list = this.createList();
    this.container.appendChild(this.list);
    document.body.appendChild(this.container);

    this.render([]);

    this.app.on('ui:leaderboard:data', this.onLeaderboardData, this);
    this.app.on('colyseus:disconnected', this.onDisconnected, this);
};

HtmlLeaderboard.prototype.createContainer = function () {
    var el = document.createElement('div');
    el.className = 'leaderboard-panel';
    el.style.position = 'fixed';
    el.style.top = '96px';
    el.style.right = '32px';
    el.style.width = '280px';
    el.style.maxHeight = '360px';
    el.style.padding = '16px';
    el.style.borderRadius = '12px';
    el.style.background = 'rgba(10, 12, 24, 0.88)';
    el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
    el.style.color = '#f5f6ff';
    el.style.fontFamily = 'Inter, sans-serif';
    el.style.fontSize = '13px';
    el.style.lineHeight = '1.5';
    el.style.zIndex = '900';

    var header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '8px';

    var title = document.createElement('div');
    title.textContent = 'Top Donors';
    title.style.fontSize = '14px';
    title.style.fontWeight = '600';
    title.style.letterSpacing = '0.04em';
    title.style.textTransform = 'uppercase';
    header.appendChild(title);

    var refreshBtn = document.createElement('button');
    refreshBtn.textContent = 'Refresh';
    refreshBtn.style.background = 'rgba(255,255,255,0.08)';
    refreshBtn.style.color = '#e1e4ff';
    refreshBtn.style.border = 'none';
    refreshBtn.style.padding = '4px 10px';
    refreshBtn.style.borderRadius = '16px';
    refreshBtn.style.fontSize = '12px';
    refreshBtn.style.cursor = 'pointer';
    refreshBtn.addEventListener('click', this.requestRefresh.bind(this));
    header.appendChild(refreshBtn);

    el.appendChild(header);

    return el;
};

HtmlLeaderboard.prototype.createList = function () {
    var list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.rowGap = '6px';
    return list;
};

HtmlLeaderboard.prototype.render = function (items, meta) {
    this.list.innerHTML = '';
    var payload = meta || {};
    if (!items || !items.length) {
        var empty = document.createElement('div');
        empty.textContent = 'No donations yet. Be the first!';
        empty.style.opacity = '0.7';
        this.list.appendChild(empty);
        return;
    }

    var scale = typeof payload.scale === 'number' && payload.scale > 0 ? payload.scale : 1;
    var currency = payload.currency || 'SOL';

    items.forEach(function (item, index) {
        var row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '6px 8px';
        row.style.background = index % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent';
        row.style.borderRadius = '8px';

        var identity = document.createElement('div');
        identity.style.display = 'flex';
        identity.style.flexDirection = 'column';
        identity.style.gap = '2px';

        var label = document.createElement('div');
        label.textContent = HtmlLeaderboard.prototype.formatAddress(item.wallet);
        label.style.fontWeight = '600';
        label.style.fontSize = '13px';

        identity.appendChild(label);
        row.appendChild(identity);

        var amount = document.createElement('div');
        amount.textContent = HtmlLeaderboard.prototype.formatAmount(item.totalMinor, scale) + ' ' + currency;
        amount.style.fontWeight = '600';
        amount.style.fontSize = '13px';
        amount.style.color = '#8bc6ff';

        row.appendChild(amount);
        this.list.appendChild(row);
    }, this);
};

HtmlLeaderboard.prototype.onLeaderboardData = function (payload) {
    var items = Array.isArray(payload?.items) ? payload.items : [];
    this.render(items, payload);
};

HtmlLeaderboard.prototype.onDisconnected = function () {
    this.render([]);
};

HtmlLeaderboard.prototype.requestRefresh = function () {
    this.app.fire('leaderboard:request', { limit: 10 });
};

HtmlLeaderboard.prototype.destroy = function () {
    this.app.off('ui:leaderboard:data', this.onLeaderboardData, this);
    this.app.off('colyseus:disconnected', this.onDisconnected, this);
    if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
    }
};

HtmlLeaderboard.prototype.formatAddress = function (address) {
    if (!address || typeof address !== 'string') {
        return 'Unknown';
    }
    if (address.length <= 10) {
        return address;
    }
    return address.substring(0, 4) + '...' + address.substring(address.length - 4);
};

HtmlLeaderboard.prototype.formatAmount = function (minor, scale) {
    var amount = Number(minor) / (scale || 1);
    if (!isFinite(amount)) {
        return '0';
    }
    return amount.toFixed(2);
};
