// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\UI\HtmlBridge\HtmlLeaderboard.js
var HtmlLeaderboard = pc.createScript('htmlLeaderboard');

HtmlLeaderboard.prototype.initialize = function () {
    this.isCollapsed = false;
    this.isRefreshing = false;

    this.injectStyles();
    this.createPanel();

    this.render([]);

    this.app.on('ui:leaderboard:data', this.onLeaderboardData, this);
    this.app.on('colyseus:disconnected', this.onDisconnected, this);
};

HtmlLeaderboard.prototype.injectStyles = function () {
    if (document.getElementById('leaderboard-panel-styles')) {
        return;
    }

    var style = document.createElement('style');
    style.id = 'leaderboard-panel-styles';
    style.innerHTML = this.buildStyles();
    document.head.appendChild(style);
};

HtmlLeaderboard.prototype.buildStyles = function () {
    return `
#leaderboard-panel {
  position: fixed;
  top: 96px;
  right: 32px;
  width: 340px;
  max-height: 520px;
  background: var(--surface2-color, rgba(34, 34, 34, 0.95));
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--border-radius, 14px);
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.35);
  color: var(--text-color, #ffffff);
  font-family: var(--font-family, 'Segoe UI', sans-serif);
  font-size: 14px;
  z-index: 900;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

#leaderboard-panel.leaderboard-collapsed {
  max-height: 56px;
}

.leaderboard-header {
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
}

.leaderboard-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
  gap: 8px;
}

.leaderboard-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  flex: 1;
}

.leaderboard-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  border-radius: 8px;
  color: var(--text-color, #ffffff);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.leaderboard-toggle:hover {
  background: rgba(255, 255, 255, 0.14);
  transform: translateY(-1px);
}

.leaderboard-toggle:active {
  transform: translateY(0);
}

.leaderboard-toggle-icon {
  width: 16px;
  height: 16px;
}

#leaderboard-panel.leaderboard-collapsed .leaderboard-toggle-icon {
  transform: rotate(180deg);
}

.leaderboard-refresh {
  width: 100%;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: var(--text-color, #ffffff);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
}

.leaderboard-refresh:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.18);
  transform: translateY(-1px);
}

.leaderboard-refresh:active:not(:disabled) {
  transform: translateY(0);
}

.leaderboard-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.leaderboard-content {
  padding: 12px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: opacity 0.2s ease;
}

#leaderboard-panel.leaderboard-collapsed .leaderboard-content {
  display: none;
}

.leaderboard-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.leaderboard-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  transition: all 0.15s ease;
}

.leaderboard-row:hover {
  background: rgba(255, 255, 255, 0.12);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.leaderboard-row:nth-child(even) {
  background: rgba(255, 255, 255, 0.02);
}

.leaderboard-row:nth-child(even):hover {
  background: rgba(255, 255, 255, 0.14);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.leaderboard-rank {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(29, 155, 240, 0.2) 0%, rgba(29, 232, 242, 0.2) 100%);
  border-radius: 6px;
  font-weight: 700;
  font-size: 12px;
  color: var(--accent-color, #1df2a4);
  flex-shrink: 0;
}

.leaderboard-rank.rank-1 {
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.3) 0%, rgba(255, 152, 0, 0.2) 100%);
  color: #ffc107;
}

.leaderboard-rank.rank-2 {
  background: linear-gradient(135deg, rgba(192, 192, 192, 0.3) 0%, rgba(169, 169, 169, 0.2) 100%);
  color: #c0c0c0;
}

.leaderboard-rank.rank-3 {
  background: linear-gradient(135deg, rgba(205, 127, 50, 0.3) 0%, rgba(184, 134, 11, 0.2) 100%);
  color: #cd7f32;
}

.leaderboard-identity {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.leaderboard-name {
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.01em;
  color: var(--text-color, #ffffff);
}

.leaderboard-address {
  font-weight: 500;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.01em;
  color: rgba(255, 255, 255, 0.5);
}

.leaderboard-amount {
  font-weight: 700;
  font-size: 14px;
  color: var(--accent-color, #1df2a4);
  letter-spacing: 0.01em;
  flex-shrink: 0;
}

.leaderboard-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  line-height: 1.5;
}

.leaderboard-content::-webkit-scrollbar {
  width: 6px;
}

.leaderboard-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 3px;
}

.leaderboard-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  transition: background 0.2s ease;
}

.leaderboard-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

@media (max-width: 768px) {
  #leaderboard-panel {
    top: 80px;
    right: 16px;
    width: 320px;
    max-height: 480px;
  }

  .leaderboard-header {
    padding: 14px;
    gap: 10px;
  }

  .leaderboard-title {
    font-size: 14px;
  }

  .leaderboard-row {
    padding: 10px;
  }

  .leaderboard-rank {
    width: 24px;
    height: 24px;
    font-size: 11px;
  }

  .leaderboard-address {
    font-size: 12px;
  }

  .leaderboard-amount {
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  #leaderboard-panel {
    top: auto;
    bottom: 100px;
    right: 12px;
    width: calc(100% - 24px);
    max-width: 320px;
    max-height: 400px;
  }

  #leaderboard-panel.leaderboard-collapsed {
    max-height: 48px;
  }

  .leaderboard-header {
    padding: 12px;
  }

  .leaderboard-title {
    font-size: 13px;
  }

  .leaderboard-toggle {
    width: 28px;
    height: 28px;
  }

  .leaderboard-refresh {
    padding: 8px 12px;
    font-size: 11px;
  }

  .leaderboard-content {
    padding: 10px;
    gap: 6px;
  }

  .leaderboard-row {
    padding: 8px;
  }

  .leaderboard-empty {
    padding: 24px 12px;
    font-size: 12px;
  }
}
    `;
};

HtmlLeaderboard.prototype.createPanel = function () {
    var html = `
<div id="leaderboard-panel" class="leaderboard-panel">
  <div class="leaderboard-header">
    <div class="leaderboard-title-row">
      <h2 class="leaderboard-title">Top Donors</h2>
      <button class="leaderboard-toggle" aria-label="Toggle leaderboard" aria-expanded="true" title="Toggle leaderboard">
        <svg class="leaderboard-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
    </div>
    <button class="leaderboard-refresh" aria-label="Refresh leaderboard" title="Refresh leaderboard" data-sound="ui_click_default">
      Refresh
    </button>
  </div>
  <div class="leaderboard-content">
    <div id="leaderboard-list" class="leaderboard-list"></div>
  </div>
</div>
    `;

    var container = document.createElement('div');
    container.innerHTML = html;

    this.panelElement = container.querySelector('#leaderboard-panel');
    this.listElement = container.querySelector('#leaderboard-list');
    this.refreshBtn = container.querySelector('.leaderboard-refresh');
    this.toggleBtn = container.querySelector('.leaderboard-toggle');
    this.titleRow = container.querySelector('.leaderboard-title-row');

    if (this.panelElement) {
        document.body.appendChild(this.panelElement);
    }

    if (this.refreshBtn) {
        this.refreshBtn.addEventListener('click', this.requestRefresh.bind(this));
    }

    if (this.toggleBtn) {
        this.toggleBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            this.toggleCollapse();
        }.bind(this));
    }

    if (this.titleRow) {
        this.titleRow.addEventListener('click', this.toggleCollapse.bind(this));
    }
};

HtmlLeaderboard.prototype.toggleCollapse = function () {
    this.isCollapsed = !this.isCollapsed;

    if (this.panelElement) {
        gsap.killTweensOf(this.panelElement);

        if (this.isCollapsed) {
            gsap.to(this.panelElement, {
                maxHeight: 56,
                duration: 0.16,
                ease: 'back.out'
            });
            this.panelElement.classList.add('leaderboard-collapsed');
        } else {
            gsap.to(this.panelElement, {
                maxHeight: 520,
                duration: 0.18,
                ease: 'back.out'
            });
            this.panelElement.classList.remove('leaderboard-collapsed');
        }
    }

    if (this.toggleBtn) {
        gsap.killTweensOf(this.toggleBtn.querySelector('.leaderboard-toggle-icon') || this.toggleBtn);
        gsap.to(this.toggleBtn.querySelector('.leaderboard-toggle-icon') || this.toggleBtn, {
            rotation: this.isCollapsed ? 180 : 0,
            duration: 0.16,
            ease: 'back.out'
        });
        this.toggleBtn.setAttribute('aria-expanded', !this.isCollapsed);
    }
};

HtmlLeaderboard.prototype.render = function (items, meta) {
    if (!this.listElement) {
        return;
    }

    this.listElement.innerHTML = '';
    var payload = meta || {};

    if (!items || !items.length) {
        var empty = document.createElement('div');
        empty.className = 'leaderboard-empty';
        empty.textContent = 'No donations yet. Be the first!';
        this.listElement.appendChild(empty);
        return;
    }

    var scale = typeof payload.scale === 'number' && payload.scale > 0 ? payload.scale : 1;
    var currency = payload.currency || 'SOL';

    items.forEach(function (item, index) {
        var row = document.createElement('div');
        row.className = 'leaderboard-row';

        var rank = document.createElement('div');
        rank.className = 'leaderboard-rank';
        var rankNum = index + 1;
        rank.textContent = rankNum;
        if (rankNum <= 3) {
            rank.classList.add('rank-' + rankNum);
        }
        row.appendChild(rank);

        var identity = document.createElement('div');
        identity.className = 'leaderboard-identity';

        var name = document.createElement('div');
        name.className = 'leaderboard-name';
        name.textContent = item.name || HtmlLeaderboard.prototype.formatAddress(item.wallet);
        identity.appendChild(name);

        var address = document.createElement('div');
        address.className = 'leaderboard-address';
        address.textContent = item.wallet_short || HtmlLeaderboard.prototype.formatAddress(item.wallet);
        identity.appendChild(address);

        row.appendChild(identity);

        var amount = document.createElement('div');
        amount.className = 'leaderboard-amount';
        amount.textContent = HtmlLeaderboard.prototype.formatAmount(item.totalMinor, scale) + ' ' + currency;
        row.appendChild(amount);

        this.listElement.appendChild(row);
    }, this);

    if (this.refreshBtn) {
        this.refreshBtn.disabled = false;
    }
    this.isRefreshing = false;
};

HtmlLeaderboard.prototype.onLeaderboardData = function (payload) {
    var items = Array.isArray(payload?.items) ? payload.items : [];
    this.render(items, payload);
};

HtmlLeaderboard.prototype.onDisconnected = function () {
    this.render([]);
};

HtmlLeaderboard.prototype.requestRefresh = function () {
    if (this.isRefreshing) {
        return;
    }

    this.isRefreshing = true;
    if (this.refreshBtn) {
        this.refreshBtn.disabled = true;
    }

    this.app.fire('leaderboard:request', { limit: 10 });

    setTimeout(function () {
        if (this.refreshBtn) {
            this.refreshBtn.disabled = false;
        }
        this.isRefreshing = false;
    }.bind(this), 2000);
};

HtmlLeaderboard.prototype.destroy = function () {
    this.app.off('ui:leaderboard:data', this.onLeaderboardData, this);
    this.app.off('colyseus:disconnected', this.onDisconnected, this);

    if (this.refreshBtn) {
        this.refreshBtn.removeEventListener('click', this.requestRefresh.bind(this));
    }
    if (this.toggleBtn) {
        this.toggleBtn.removeEventListener('click', this.toggleCollapse.bind(this));
    }
    if (this.titleRow) {
        this.titleRow.removeEventListener('click', this.toggleCollapse.bind(this));
    }

    if (this.panelElement && this.panelElement.parentNode) {
        this.panelElement.parentNode.removeChild(this.panelElement);
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
