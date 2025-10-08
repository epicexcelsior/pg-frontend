///<reference path="c:\Users\Epic\.vscode-insiders\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts"
var BoothClaimZone = pc.createScript('boothClaimZone');

BoothClaimZone.prototype.initialize = function () {
     this.boothId = this.entity.name;
     this.claimedBy = null;

     this.entity.collision.on('triggerenter', this.onTriggerEnter, this);
     this.entity.collision.on('triggerleave', this.onTriggerLeave, this);

     this.app.on('booth:updated', this.handleBoothUpdate, this);
};

BoothClaimZone.prototype.onTriggerEnter = function (otherEntity) {
     if (!otherEntity || !otherEntity.tags || !otherEntity.tags.has('player')) {
          return;
     }

     var localPlayerEntity = this.app.localPlayer;
     if (!localPlayerEntity || otherEntity !== localPlayerEntity) {
          return;
     }

     const playerDataScript = localPlayerEntity.script && localPlayerEntity.script.playerData;
     if (!playerDataScript) {
          console.warn('BoothClaimZone: Local player entity or PlayerData script not found.');
          return;
     }

     console.log(`BoothClaimZone (${this.boothId}): Trigger Enter. Firing booth:entered event.`);
     this.app.fire('booth:entered', this);
};

BoothClaimZone.prototype.onTriggerLeave = function (otherEntity) {
     const localPlayerEntity = this.app.localPlayer;
     if (otherEntity === localPlayerEntity) {
          console.log(`BoothClaimZone (${this.boothId}): Trigger Leave. Firing booth:left event.`);
          this.app.fire('booth:left', this);
     }
};

BoothClaimZone.prototype.handleBoothUpdate = function(boothData) {
     if (boothData && boothData.boothId === this.boothId) {
         const newClaimedBy = boothData.claimedBy || null;
         if (this.claimedBy !== newClaimedBy) {
             console.log(`BoothClaimZone (${this.boothId}): ClaimedBy updated from '${this.claimedBy}' to '${newClaimedBy}'`);
             this.claimedBy = newClaimedBy;
         }
     }
};

BoothClaimZone.prototype.destroy = function() {
     this.app.off('booth:updated', this.handleBoothUpdate, this);
};
