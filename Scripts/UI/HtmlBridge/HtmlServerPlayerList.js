var HtmlServerPlayerList = pc.createScript('htmlServerPlayerList');

HtmlServerPlayerList.prototype.initialize = function () {
    this.isCollapsed = true;
    this.isAnimating = false;
    this.room = null;
    this.updateInterval = null;
    this.currentTop = 548;
    this.leaderboardObserver = null;
    this.leaderboardElement = null;

    this.injectStyles();
    this.createPanel();
    this.render([]);
    
    this.panelElement.classList.add('collapsed');

    this.app.on('colyseus:connected', this.onConnected, this);
    this.app.on('colyseus:disconnected', this.onDisconnected, this);
    this.app.on('ui:leaderboard:opened', this.onLeaderboardOpened, this);
    this.app.on('ui:leaderboard:closed', this.onLeaderboardClosed, this);
    this.app.on('ui:leaderboard:height-changed', this.onLeaderboardHeightChanged, this);

    this.setupLeaderboardObserver();

    if (this.app.room) {
        this.onConnected();
    }
};

HtmlServerPlayerList.prototype.setupLeaderboardObserver = function () {
    var self = this;
    var checkLeaderboard = function() {
        if (!self.leaderboardElement) {
            self.leaderboardElement = document.getElementById('leaderboard-panel');
        }
        
        if (!self.leaderboardElement) {
            setTimeout(checkLeaderboard, 100);
            return;
        }
        
        if (typeof ResizeObserver !== 'undefined') {
            self.leaderboardObserver = new ResizeObserver(function() {
                self.syncPositionWithLeaderboard();
            });
            self.leaderboardObserver.observe(self.leaderboardElement);
        }
        
        self.syncPositionWithLeaderboard();
    };
    
    checkLeaderboard();
};

HtmlServerPlayerList.prototype.injectStyles = function () {
    if (document.getElementById('server-player-list-styles')) {
        return;
    }

    var style = document.createElement('style');
    style.id = 'server-player-list-styles';
    style.innerHTML = this.buildStyles();
    document.head.appendChild(style);
};

HtmlServerPlayerList.prototype.buildStyles = function () {
    return `
#server-player-list-panel {
  position: fixed;
  top: 548px;
  right: 32px;
  width: 340px;
  max-height: 280px;
  background: var(--surface2-color, rgba(34, 34, 34, 0.95));
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--border-radius, 14px);
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.35);
  color: var(--text-color, #ffffff);
  font-family: var(--font-family, 'Segoe UI', sans-serif);
  font-size: 14px;
  z-index: 898;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  will-change: transform, max-height;
}

#server-player-list-panel.collapsed {
  max-height: 56px;
}

.server-player-list-header {
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
  gap: 8px;
  flex-shrink: 0;
}

.server-player-list-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  flex: 1;
}

.server-player-list-count {
  font-size: 12px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
}

.server-player-list-toggle {
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

.server-player-list-toggle:hover {
  background: rgba(255, 255, 255, 0.14);
  transform: translateY(-1px);
}

.server-player-list-toggle-icon {
  width: 16px;
  height: 16px;
}

#server-player-list-panel.collapsed .server-player-list-toggle-icon {
  transform: rotate(180deg);
}

.server-player-list-content {
  padding: 12px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

#server-player-list-panel.collapsed .server-player-list-content {
  display: none;
}

.server-player-list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  transition: all 0.15s ease;
}

.server-player-list-item:hover {
  background: rgba(255, 255, 255, 0.12);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.server-player-list-item:nth-child(even) {
  background: rgba(255, 255, 255, 0.02);
}

.server-player-list-item:nth-child(even):hover {
  background: rgba(255, 255, 255, 0.14);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.server-player-list-status {
  width: 8px;
  height: 8px;
  background: var(--accent-color, #1df2a4);
  border-radius: 50%;
  flex-shrink: 0;
}

.server-player-list-name {
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.01em;
  color: var(--text-color, #ffffff);
  flex: 1;
}

.server-player-list-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  line-height: 1.5;
}

.server-player-list-content::-webkit-scrollbar {
  width: 6px;
}

.server-player-list-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 3px;
}

.server-player-list-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  transition: background 0.2s ease;
}

.server-player-list-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

@media (max-width: 768px) {
  #server-player-list-panel {
    top: 512px;
    right: 16px;
    width: 320px;
    max-height: 300px;
  }

  .server-player-list-header {
    padding: 14px;
  }

  .server-player-list-title {
    font-size: 14px;
  }

  .server-player-list-item {
    padding: 10px;
  }

  .server-player-list-name {
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  #server-player-list-panel {
    position: fixed;
    top: auto;
    bottom: 100px;
    right: 12px;
    width: calc(100% - 24px);
    max-width: 320px;
    max-height: 260px;
  }

  #server-player-list-panel.collapsed {
    max-height: 48px;
  }

  .server-player-list-header {
    padding: 12px;
  }

  .server-player-list-title {
    font-size: 13px;
  }

  .server-player-list-toggle {
    width: 28px;
    height: 28px;
  }

  .server-player-list-content {
    padding: 10px;
    gap: 6px;
  }

  .server-player-list-item {
    padding: 8px;
  }

  .server-player-list-empty {
    padding: 24px 12px;
    font-size: 12px;
  }
}
    `;
};

HtmlServerPlayerList.prototype.createPanel = function () {
    var html = `
<div id="server-player-list-panel">
  <div class="server-player-list-header">
    <h2 class="server-player-list-title">Players</h2>
    <span class="server-player-list-count" id="server-player-list-count">0</span>
    <button class="server-player-list-toggle" aria-label="Toggle player list" aria-expanded="true">
      <svg class="server-player-list-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>
  </div>
  <div class="server-player-list-content">
    <div id="server-player-list-items"></div>
  </div>
</div>
    `;

    var container = document.createElement('div');
    container.innerHTML = html;

    this.panelElement = container.querySelector('#server-player-list-panel');
    this.itemsElement = container.querySelector('#server-player-list-items');
    this.countElement = container.querySelector('#server-player-list-count');
    this.toggleBtn = container.querySelector('.server-player-list-toggle');
    this.headerElement = container.querySelector('.server-player-list-header');

    if (this.panelElement) {
        document.body.appendChild(this.panelElement);
    }

    if (this.toggleBtn) {
        this.toggleBtn.addEventListener('click', this.toggleCollapse.bind(this));
    }

    if (this.headerElement) {
        this.headerElement.addEventListener('click', this.toggleCollapse.bind(this));
    }
};

HtmlServerPlayerList.prototype.toggleCollapse = function () {
    if (this.isAnimating) return;
    
    if (this.isCollapsed) {
        this.expand();
        this.app.fire('ui:player-list:opened', {});
    } else {
        this.collapse();
    }
};

HtmlServerPlayerList.prototype.expand = function () {
    if (this.isCollapsed) {
        this.isCollapsed = false;
    }

    var maxHeightTarget = 280;
    if (window.innerWidth <= 768) {
        maxHeightTarget = 300;
    }
    if (window.innerWidth <= 480) {
        maxHeightTarget = 260;
    }

    if (this.panelElement) {
        this.isAnimating = true;
        gsap.killTweensOf(this.panelElement);
        gsap.to(this.panelElement, {
            maxHeight: maxHeightTarget,
            duration: 0.4,
            ease: 'power2.inOut',
            onComplete: () => { this.isAnimating = false; }
        });
        this.panelElement.classList.remove('collapsed');
    }

    if (this.toggleBtn) {
        var icon = this.toggleBtn.querySelector('.server-player-list-toggle-icon');
        gsap.killTweensOf(icon);
        gsap.to(icon, {
            rotation: 0,
            duration: 0.4,
            ease: 'power2.inOut'
        });
        this.toggleBtn.setAttribute('aria-expanded', true);
    }
};

HtmlServerPlayerList.prototype.collapse = function () {
    if (!this.isCollapsed) {
        this.isCollapsed = true;
    }

    if (this.panelElement) {
        this.isAnimating = true;
        gsap.killTweensOf(this.panelElement);
        gsap.to(this.panelElement, {
            maxHeight: 56,
            duration: 0.4,
            ease: 'power2.inOut',
            onComplete: () => { this.isAnimating = false; }
        });
        this.panelElement.classList.add('collapsed');
    }

    if (this.toggleBtn) {
        var icon = this.toggleBtn.querySelector('.server-player-list-toggle-icon');
        gsap.killTweensOf(icon);
        gsap.to(icon, {
            rotation: 180,
            duration: 0.4,
            ease: 'power2.inOut'
        });
        this.toggleBtn.setAttribute('aria-expanded', false);
    }
};

HtmlServerPlayerList.prototype.onLeaderboardOpened = function () {
    if (!this.isCollapsed && !this.isAnimating) {
        this.collapse();
    }
};

HtmlServerPlayerList.prototype.onLeaderboardClosed = function () {
};

HtmlServerPlayerList.prototype.syncPositionWithLeaderboard = function () {
    if (!this.panelElement || !this.leaderboardElement) {
        return;
    }
    
    this.updatePlayerListPosition(this.leaderboardElement.offsetHeight, this.leaderboardElement.offsetTop);
};

HtmlServerPlayerList.prototype.updatePlayerListPosition = function (lbHeight, lbTop) {
    if (!this.panelElement) {
        return;
    }
    
    var gap = 12;
    var isMobile = window.innerWidth <= 480;
    
    if (isMobile) {
        var newBottom = 100 + lbHeight + gap;
        if (Math.abs(this.currentTop - newBottom) > 2) {
            this.currentTop = newBottom;
            
            if (this.isAnimating) {
                gsap.to(this.panelElement, {
                    bottom: newBottom,
                    duration: 0.5,
                    ease: 'power2.inOut',
                    overwrite: 'auto'
                });
            } else {
                this.panelElement.style.bottom = newBottom + 'px';
                this.panelElement.style.top = 'auto';
            }
        }
    } else {
        var newTop = lbTop + lbHeight + gap;
        if (Math.abs(this.currentTop - newTop) > 2) {
            this.currentTop = newTop;
            
            if (this.isAnimating) {
                gsap.to(this.panelElement, {
                    top: newTop,
                    duration: 0.5,
                    ease: 'power2.inOut',
                    overwrite: 'auto'
                });
            } else {
                this.panelElement.style.top = newTop + 'px';
                this.panelElement.style.bottom = 'auto';
            }
        }
    }
};

HtmlServerPlayerList.prototype.onLeaderboardHeightChanged = function (data) {
    if (!this.panelElement) {
        return;
    }
    
    var lbHeight = data.height || 520;
    var lbTop = data.top || 16;
    
    this.updatePlayerListPosition(lbHeight, lbTop);
};

HtmlServerPlayerList.prototype.onConnected = function () {
    var self = this;
    
    if (!this.app.room) {
        return;
    }

    this.room = this.app.room;
    var playersMap = this.room.state.players;
    
    if (playersMap) {
        playersMap.onAdd((player, key) => {
            if (player.onChange) {
                player.onChange((changes) => {
                    self.updatePlayerList();
                });
            }
            self.updatePlayerList();
        });
        
        playersMap.onRemove((player, key) => {
            self.updatePlayerList();
        });
    }
    
    this.updatePlayerList();
    
    if (this.updateInterval) {
        clearInterval(this.updateInterval);
    }
    this.updateInterval = setInterval(function () {
        self.updatePlayerList();
    }, 1000);

    this.app.on('ui:leaderboard:toggled', this.onLeaderboardToggled, this);
};

HtmlServerPlayerList.prototype.onDisconnected = function () {
    if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
    }
    this.room = null;
    this.render([]);
};

HtmlServerPlayerList.prototype.updatePlayerList = function () {
    if (!this.room || !this.room.state || !this.room.state.players) {
        this.render([]);
        return;
    }

    var players = [];
    var playersMap = this.room.state.players;
    
    playersMap.forEach(function (player, key) {
        var name = player.username || 'Guest';
        players.push({
            name: name,
            sessionId: key
        });
    });

    this.render(players);
};

HtmlServerPlayerList.prototype.render = function (players) {
    if (!this.itemsElement || !this.countElement) {
        return;
    }

    this.itemsElement.innerHTML = '';

    if (!players || players.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'server-player-list-empty';
        empty.textContent = 'No players connected.';
        this.itemsElement.appendChild(empty);
        if (this.countElement) {
            this.countElement.textContent = '0';
        }
        return;
    }

    if (this.countElement) {
        this.countElement.textContent = String(players.length);
    }

    players.forEach(function (player) {
        var item = document.createElement('div');
        item.className = 'server-player-list-item';

        var status = document.createElement('div');
        status.className = 'server-player-list-status';
        item.appendChild(status);

        var name = document.createElement('div');
        name.className = 'server-player-list-name';
        name.textContent = player.name || 'Player';
        name.title = player.name || '';
        item.appendChild(name);

        this.itemsElement.appendChild(item);
    }, this);
};

HtmlServerPlayerList.prototype.destroy = function () {
    this.app.off('colyseus:connected', this.onConnected, this);
    this.app.off('colyseus:disconnected', this.onDisconnected, this);
    this.app.off('ui:leaderboard:opened', this.onLeaderboardOpened, this);
    this.app.off('ui:leaderboard:closed', this.onLeaderboardClosed, this);
    this.app.off('ui:leaderboard:height-changed', this.onLeaderboardHeightChanged, this);
    
    if (this.leaderboardObserver) {
        this.leaderboardObserver.disconnect();
        this.leaderboardObserver = null;
    }
    
    gsap.killTweensOf(this.panelElement);
    if (this.toggleBtn) {
        gsap.killTweensOf(this.toggleBtn.querySelector('.server-player-list-toggle-icon'));
    }
    
    if (this.panelElement && this.panelElement.parentNode) {
        this.panelElement.parentNode.removeChild(this.panelElement);
    }

    if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
    }

    if (this.toggleBtn) {
        this.toggleBtn.removeEventListener('click', this.toggleCollapse.bind(this));
    }
    if (this.headerElement) {
        this.headerElement.removeEventListener('click', this.toggleCollapse.bind(this));
    }

    this.room = null;
    this.leaderboardElement = null;
};
