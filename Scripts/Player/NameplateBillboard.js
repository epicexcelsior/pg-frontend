// Scripts/UI/NameplateBillboard.js
var NameplateBillboard = pc.createScript('nameplateBillboard');

/**
 * Rotate a world-space UI toward the active camera.
 * - yawOnly: rotate only around Y (prevents tilt)
 * - useDistanceScale: optional distance-based size clamping
 */

// --- Attributes ---
NameplateBillboard.attributes.add('yawOnly', {
    type: 'boolean',
    default: false,            // default OFF since your setup needs full face
    title: 'Yaw Only',
    description: 'Rotate only around Y to prevent tilting'
});

NameplateBillboard.attributes.add('useDistanceScale', { type: 'boolean', default: false, title: 'Scale With Distance' });
NameplateBillboard.attributes.add('near',  { type: 'number', default: 2.0,  title: 'Near (m)' });
NameplateBillboard.attributes.add('far',   { type: 'number', default: 20.0, title: 'Far (m)' });
NameplateBillboard.attributes.add('minScale', { type: 'number', default: 0.85, title: 'Min Scale' });
NameplateBillboard.attributes.add('maxScale', { type: 'number', default: 1.25, title: 'Max Scale' });

NameplateBillboard.attributes.add('cameraEntity', { type: 'entity', title: 'Camera (optional)' });

NameplateBillboard.attributes.add('cullingEnabled', { type: 'boolean', default: true, title: 'Enable Distance Culling' });
NameplateBillboard.attributes.add('cullingDistance', { type: 'number', default: 30, title: 'Culling Distance (m)' });

// --- Internals ---
NameplateBillboard.prototype.initialize = function () {
    this._cam = this.cameraEntity || null;
    this._baseScale = this.entity.getLocalScale().clone();
    this._v = new pc.Vec3();
    this._camPos = new pc.Vec3();
    this._myPos = new pc.Vec3();

    // Precompute reciprocal to avoid per-frame division (handles bad inputs)
    var range = Math.max(0.0001, this.far - this.near);
    this._invRange = 1.0 / range;
};

NameplateBillboard.prototype._getCamera = function () {
    if (this._cam && this._cam.enabled) return this._cam;

    var sys = this.app.systems && this.app.systems.camera;
    if (!sys) return null;

    if (sys.activeCamera && sys.activeCamera.entity && sys.activeCamera.entity.enabled) {
        this._cam = sys.activeCamera.entity;
        return this._cam;
    }

    var cams = sys.cameras;
    for (var i = 0; i < cams.length; i++) {
        var e = cams[i] && cams[i].entity;
        if (e && e.enabled) {
            this._cam = e;
            return this._cam;
        }
    }
    return null;
};

NameplateBillboard.prototype.update = function (dt) {
    var cam = this._getCamera();
    if (!cam) return;

    this._camPos.copy(cam.getPosition());
    this._myPos.copy(this.entity.getPosition());

    this._v.copy(this._camPos).sub(this._myPos);
    var distSq = this._v.lengthSq();

    if (this.cullingEnabled) {
        if (distSq > this.cullingDistance * this.cullingDistance) return;
    }

    if (distSq < 1e-8) return;

    if (this.yawOnly) {
        this._v.y = 0;
        if (this._v.lengthSq() < 1e-8) return;
        this._v.normalize();

        var yaw = Math.atan2(-this._v.x, -this._v.z) * pc.math.RAD_TO_DEG;
        this.entity.setEulerAngles(0, yaw, 0);
    } else {
        this.entity.lookAt(this._camPos);
        this.entity.rotateLocal(0, 180, 0);
    }

    if (this.useDistanceScale) {
        var d = Math.sqrt(distSq);
        var t = pc.math.clamp((d - this.near) * this._invRange, 0, 1);
        var s = pc.math.lerp(this.minScale, this.maxScale, t);
        this.entity.setLocalScale(this._baseScale.x * s, this._baseScale.y * s, this._baseScale.z * s);
    }
};

NameplateBillboard.prototype.destroy = function () {
    this._cam = null;
};
