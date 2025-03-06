///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var BoothClaim = pc.createScript('boothClaim');

// Attribute for booth ID
BoothClaim.attributes.add('boothId', { type: 'string', default: '' });

BoothClaim.prototype.initialize = function () {
      // Ensure there's a button component and attach a click event
      if (this.entity.button) {
            this.entity.button.on('click', this.claimBooth, this);
      } else {
            console.error("No button component found on booth entity:", this.entity.name);
      }

      if (!this.boothId) {
            this.boothId = this.entity.parent.parent.name;
      }
};

BoothClaim.prototype.claimBooth = function () {
      // Check if NetworkManager/room is available
      if (!this.app.room) {
            console.error("NetworkManager or its room is undefined");
            return;
      }

      console.log(`Attempting to claim booth: ${this.boothId}`);
      // Send the claim request to the server
      this.app.room.send("claimBooth", { boothId: this.boothId });
      //console.log(`Attempted to claim booth: ${this.boothId}`);
};
