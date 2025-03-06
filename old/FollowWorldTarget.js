///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var FollowWorldTarget = pc.createScript('followWorldTarget');

// Attributes for the target booth and the camera
FollowWorldTarget.attributes.add('target', {
    type: "entity",
    title: "Target Entity"
});
FollowWorldTarget.attributes.add('camera', {
    type: "entity",
    title: "Camera Entity"
});
// Offset in world space (e.g. move above the booth)
FollowWorldTarget.attributes.add('worldOffset', {
    type: 'vec3',
    default: [0, 2, 0],
    title: "World Offset"
});
// Additional offset in normalized screen coordinates
FollowWorldTarget.attributes.add('screenOffset', {
    type: 'vec2',
    default: [0, 0.1],
    title: "Screen Offset (Normalized)"
});

FollowWorldTarget.prototype.postUpdate = function(dt) {
    if (!this.target || !this.camera) return;
    
    // Compute the target's world position plus the world offset.
    var worldPos = this.target.getPosition().clone().add(this.worldOffset);
    var screenPos = new pc.Vec3();
    this.camera.camera.worldToScreen(worldPos, screenPos);
    
    if (screenPos.z > 0) {
        // Make sure the UI element is enabled
        if (this.entity.element) {
            this.entity.element.enabled = true;
        }
        
        // Adjust for device pixel ratio
        var pixelRatio = this.app.graphicsDevice.maxPixelRatio;
        screenPos.x *= pixelRatio;
        screenPos.y *= pixelRatio;
        
        var device = this.app.graphicsDevice;
        // Convert to normalized UI coordinates (-1 to 1)
        var normalizedX = ((screenPos.x / device.width) * 2) - 1;
        var normalizedY = ((1 - (screenPos.y / device.height)) * 2) - 1;
        
        // Apply additional screen offset
        normalizedX += this.screenOffset.x;
        normalizedY += this.screenOffset.y;
        
        this.entity.setPosition(normalizedX, normalizedY, 0);
    } else {
        if (this.entity.element) {
            this.entity.element.enabled = false;
        }
    }
};
