// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\FX\DonationEffects.js
var DonationEffects = pc.createScript('donationEffects');

DonationEffects.attributes.add('confettiPrefab', { type: 'entity', title: 'Confetti Prefab' });
DonationEffects.attributes.add('sparklePrefab', { type: 'entity', title: 'Sparkle Prefab' });
DonationEffects.attributes.add('sfxWhoosh', { type: 'asset', assetType: 'audio', title: 'SFX Whoosh' });
DonationEffects.attributes.add('sfxCoins', { type: 'asset', assetType: 'audio', title: 'SFX Coins' });
DonationEffects.attributes.add('sfxSpark', { type: 'asset', assetType: 'audio', title: 'SFX Spark' });
DonationEffects.attributes.add('fxDirector', {
    type: 'entity',
    title: 'FX Director Entity',
    description: 'Optional entity that hosts an fxDirector script instance.'
});
DonationEffects.attributes.add('fxEffectId', {
    type: 'string',
    default: 'donation',
    title: 'FX Effect Id'
});
DonationEffects.attributes.add('uiFlashMs', { type: 'number', default: 240, title: 'UI Flash Duration (ms)' });
DonationEffects.attributes.add('baseTrauma', { type: 'number', default: 0.22, title: 'Base Trauma' });
DonationEffects.attributes.add('selfBonusTrauma', { type: 'number', default: 0.20, title: 'Self Bonus Trauma' });
DonationEffects.attributes.add('amountScale', { type: 'number', default: 0.08, title: 'Amount Trauma Scale' });
DonationEffects.attributes.add('rumbleMultiplier', { type: 'number', default: 0.15, title: 'Rumble Magnitude Per SOL' });
DonationEffects.attributes.add('flashOpacity', { type: 'number', default: 0.25, title: 'Flash Opacity' });

DonationEffects.prototype.initialize = function () {
    this.app.on('effects:donation', this.onDonation, this);

    this.localPlayerWallet = null;
    this.fxDirectorScript = null;

    this.flashElement = null;
    this.flashTimeout = null;
    this.createFlashOverlay();

    this.app.on('player:data:changed', this.onPlayerDataChanged, this);
    var playerData = this.app.services && this.app.services.get('playerData');
    if (playerData) {
        this.onPlayerDataChanged(playerData);
    }

    this.on('destroy', function () {
        this.app.off('effects:donation', this.onDonation, this);
        this.app.off('player:data:changed', this.onPlayerDataChanged, this);
        if (this.flashElement && this.flashElement.parentElement) {
            this.flashElement.parentElement.removeChild(this.flashElement);
        }
        if (this.flashTimeout) {
            clearTimeout(this.flashTimeout);
        }
    }, this);
};

DonationEffects.prototype._resolveFxDirector = function () {
    var host = this.fxDirector || this.entity;
    if (host && host.script) {
        if (host.script.fxDirector) {
            return host.script.fxDirector;
        }
        if (host.script.instances && host.script.instances.fxDirector) {
            return host.script.instances.fxDirector;
        }
    }

    var searchRoot = this.app && this.app.root;
    if (!searchRoot) {
        return null;
    }

    var tagged = searchRoot.findByTag ? searchRoot.findByTag('fxDirector') : null;
    if (tagged && tagged.length) {
        for (var i = 0; i < tagged.length; i++) {
            if (tagged[i].script && tagged[i].script.fxDirector) {
                return tagged[i].script.fxDirector;
            }
        }
    }

    var entity = searchRoot.findByName && searchRoot.findByName('FxDirector');
    if (entity && entity.script && entity.script.fxDirector) {
        return entity.script.fxDirector;
    }

    return null;
};

DonationEffects.prototype.onPlayerDataChanged = function (playerData) {
    if (!playerData || typeof playerData.getWalletAddress !== 'function') {
        this.localPlayerWallet = null;
        return;
    }
    this.localPlayerWallet = playerData.getWalletAddress();
};

DonationEffects.prototype.onDonation = function (e) {
    if (!this.fxDirectorScript || !this.fxDirectorScript.entity || !this.fxDirectorScript.entity.enabled) {
        this.fxDirectorScript = this._resolveFxDirector();
    }

    var amount = parseFloat(e.amount || e.amountSOL || 0) || 0;
    var isSelf = this.localPlayerWallet &&
        (e.sender === this.localPlayerWallet || e.recipient === this.localPlayerWallet);

    var trauma = pc.math.clamp(this.baseTrauma + (amount * this.amountScale) + (isSelf ? this.selfBonusTrauma : 0), 0, 1);
    var rumbleMagnitude = pc.math.clamp(0.25 + amount * this.rumbleMultiplier, 0.2, 0.9);

    var runtimeOverrides = {
        position: this._getEffectPosition(),
        shake: { trauma: trauma },
        vfx: this._buildVfxEntries(),
        sfx: this._buildSfxEntries(),
        rumble: { magnitude: rumbleMagnitude, durationMs: 220 }
    };

    if (this.fxDirectorScript) {
        this.fxDirectorScript.playEffect(this.fxEffectId, runtimeOverrides);
    } else {
        this._fallbackEffects(runtimeOverrides);
    }

    this.triggerFlash();
};

DonationEffects.prototype._getEffectPosition = function () {
    if (!this.entity || !this.entity.getPosition) {
        return null;
    }
    return this.entity.getPosition().clone();
};

DonationEffects.prototype._buildVfxEntries = function () {
    var entries = [];
    if (this.confettiPrefab) {
        entries.push({
            entity: this.confettiPrefab,
            lifetime: 1.6,
            parentEntity: this.entity
        });
    }
    if (this.sparklePrefab) {
        entries.push({
            entity: this.sparklePrefab,
            lifetime: 1.0,
            parentEntity: this.entity
        });
    }
    return entries;
};

DonationEffects.prototype._buildSfxEntries = function () {
    var entries = [];
    if (this.sfxWhoosh) {
        entries.push({ key: 'donationWhoosh', asset: this.sfxWhoosh, delayMs: 0, stopBeforePlay: true });
    }
    if (this.sfxCoins) {
        entries.push({ key: 'donationCoins', asset: this.sfxCoins, delayMs: 60 });
    }
    if (this.sfxSpark) {
        entries.push({ key: 'donationSpark', asset: this.sfxSpark, delayMs: 140 });
    }
    return entries;
};

DonationEffects.prototype._fallbackEffects = function (payload) {
    if (!payload) {
        return;
    }
    if (payload.shake && payload.shake.trauma) {
        this.app.fire('fx:shake:addTrauma', payload.shake.trauma);
    }
    if (payload.vfx) {
        for (var i = 0; i < payload.vfx.length; i++) {
            var vfx = payload.vfx[i];
            if (vfx && vfx.entity) {
                this.spawnBurst(vfx.entity, vfx.lifetime || 1.0);
            }
        }
    }
    if (payload.sfx) {
        for (var j = 0; j < payload.sfx.length; j++) {
            var sfx = payload.sfx[j];
            if (sfx && sfx.asset) {
                this.playSound(sfx.asset, sfx.delayMs || 0);
            }
        }
    }
    if (payload.rumble && payload.rumble.magnitude && this.app.gamepads && typeof this.app.gamepads.rumble === 'function') {
        this.app.gamepads.rumble(payload.rumble.index || 0, payload.rumble.magnitude, payload.rumble.durationMs || 200);
    }
};

DonationEffects.prototype.spawnBurst = function (prefab, duration) {
    if (!prefab || !this.entity) {
        return;
    }
    var instance = prefab.clone();
    this.entity.addChild(instance);
    instance.enabled = true;

    var ps = instance.particlesystem || instance.particleSystem;
    if (ps && typeof ps.play === 'function') {
        ps.reset();
        ps.play();
    }

    setTimeout(function () {
        if (instance && !instance._destroyed) {
            instance.destroy();
        }
    }, Math.max(0.1, duration || 1.0) * 1000);
};

DonationEffects.prototype.playSound = function (asset, delayMs) {
    if (!asset || !asset.resource || !this.entity || !this.entity.sound) {
        return;
    }
    var slot = this.entity.sound.slots[asset.name];
    if (!slot) {
        this.entity.sound.addSlot(asset.name, {
            asset: asset.id,
            volume: 1,
            loop: false,
            autoPlay: false,
            overlap: true
        });
        slot = this.entity.sound.slots[asset.name];
    }
    var playFn = function () {
        if (slot) {
            slot.stop();
            slot.play();
        }
    };
    if (delayMs && delayMs > 0) {
        setTimeout(playFn, delayMs);
    } else {
        playFn();
    }
};

DonationEffects.prototype.createFlashOverlay = function () {
    if (document.getElementById('fx-flash')) return;

    var style = document.createElement('style');
    style.id = 'fx-flash-style';
    style.innerHTML = '\n        #fx-flash {\n            position: fixed;\n            top: 0; left: 0; width: 100%; height: 100%;\n            background: white;\n            opacity: 0;\n            pointer-events: none;\n            z-index: 9998;\n            transition: opacity 0.12s ease-out;\n        }\n        #fx-flash.active {\n            opacity: ' + pc.math.clamp(this.flashOpacity, 0.02, 0.9) + ';\n            transition-duration: 0.05s;\n        }\n    ';
    document.head.appendChild(style);

    this.flashElement = document.createElement('div');
    this.flashElement.id = 'fx-flash';
    document.body.appendChild(this.flashElement);
};

DonationEffects.prototype.triggerFlash = function () {
    if (!this.flashElement || this.uiFlashMs <= 0) return;

    if (this.flashTimeout) {
        clearTimeout(this.flashTimeout);
    }

    this.flashElement.classList.add('active');

    var self = this;
    this.flashTimeout = setTimeout(function () {
        if (self.flashElement) {
            self.flashElement.classList.remove('active');
        }
        self.flashTimeout = null;
    }, this.uiFlashMs);
};
