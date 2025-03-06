///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var DonationPrompt = pc.createScript('donationPrompt');

// Called once per entity, during initialization
DonationPrompt.prototype.initialize = function () {
     // Hide the donation UI by setting opacity of all child element components to 0.
     var elems = this.entity.findComponents("element");
     for (var i = 0; i < elems.length; i++) {
          elems[i].opacity = 0;
     }
     this.visible = false;
};

// Call this function to show the donation UI.
DonationPrompt.prototype.show = function () {
     this.visible = true;

     // Unlock the mouse so the player can interact with the UI.
     // Lock the mouse back for camera movement.
     if (this.app.mouse) {
          this.app.mouse.disablePointerLock();
     }

     // Show all child elements by setting their opacity to 1.
     var elems = this.entity.findComponents("element");
     for (var i = 0; i < elems.length; i++) {
          elems[i].opacity = 1;
     }
};

// Call this function to hide the donation UI.
DonationPrompt.prototype.hide = function () {
     this.visible = false;

     // Lock the mouse back for camera movement.
     if (this.app.mouse) {
          this.app.mouse.enablePointerLock();
     }

     // Hide all child elements by setting their opacity to 0.
     var elems = this.entity.findComponents("element");
     for (var i = 0; i < elems.length; i++) {
          elems[i].opacity = 0;
     }
};
