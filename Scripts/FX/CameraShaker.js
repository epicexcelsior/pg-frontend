// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\FX\CameraShaker.js
var CameraShaker = pc.createScript('cameraShaker');

CameraShaker.attributes.add('target', {
    type: 'entity',
    title: 'Target To Shake',
    description: 'Entity whose local transform will receive shake offsets. Defaults to the entity with the script.'
});
CameraShaker.attributes.add('maxAngleDeg', { type: 'number', default: 1.2, title: 'Max Angle (Deg)' });
CameraShaker.attributes.add('maxOffset', { type: 'number', default: 0.06, title: 'Max Offset' });
CameraShaker.attributes.add('maxOffsetZ', { type: 'number', default: 0.04, title: 'Max Offset Z' });
CameraShaker.attributes.add('decay', { type: 'number', default: 1.8, title: 'Decay Rate' });
CameraShaker.attributes.add('freq', { type: 'number', default: 22, title: 'Frequency (Hz)' });
CameraShaker.attributes.add('posAmount', { type: 'number', default: 0.6, title: 'Position Amount' });
CameraShaker.attributes.add('rotAmount', { type: 'number', default: 1.0, title: 'Rotation Amount' });

CameraShaker.prototype.initialize = function () {
    this.trauma = 0;
    this.time = 0;
    this._target = this.target || this.entity;

    this._basePos = new pc.Vec3();
    this._baseRot = new pc.Quat();
    this._tmpPos = new pc.Vec3();
    this._tmpRot = new pc.Quat();
    this._offsetRot = new pc.Quat();
    this._appliedThisFrame = false;

    this.app.on('fx:shake:addTrauma', this.addTrauma, this);
    this.app.on('fx:shake:impulse', this.addImpulse, this);
    this.app.on('fx:shake:clear', this.clearShake, this);

    this.on('destroy', function () {
        this.app.off('fx:shake:addTrauma', this.addTrauma, this);
        this.app.off('fx:shake:impulse', this.addImpulse, this);
        this.app.off('fx:shake:clear', this.clearShake, this);
    }, this);
};

CameraShaker.prototype.postUpdate = function (dt) {
    if (!this._target || !this._target.enabled) {
        return;
    }

    // Restore baseline from previous frame before sampling the current one
    if (this._appliedThisFrame) {
        this._target.setLocalPosition(this._basePos);
        this._target.setLocalRotation(this._baseRot);
        this._appliedThisFrame = false;
    }

    this._basePos.copy(this._target.getLocalPosition());
    this._baseRot.copy(this._target.getLocalRotation());

    if (this.trauma <= 0) {
        return;
    }

    this.time += dt;
    var shake = this.trauma * this.trauma;

    var angle = this.maxAngleDeg * shake * this.rotAmount * this.noise(this.time * this.freq, 0);
    var offsetX = this.maxOffset * shake * this.posAmount * this.noise(this.time * this.freq, 1);
    var offsetY = this.maxOffset * shake * this.posAmount * this.noise(this.time * this.freq, 2);
    var offsetZ = this.maxOffsetZ * shake * this.posAmount * this.noise(this.time * this.freq, 3);

    this._tmpPos.copy(this._basePos);
    this._tmpPos.x += offsetX;
    this._tmpPos.y += offsetY;
    this._tmpPos.z += offsetZ;

    this._offsetRot.setFromEulerAngles(angle, angle * 0.35, -angle * 0.25);
    this._tmpRot.copy(this._baseRot).mul(this._offsetRot);

    this._target.setLocalPosition(this._tmpPos);
    this._target.setLocalRotation(this._tmpRot);
    this._appliedThisFrame = true;

    this.trauma = pc.math.clamp(this.trauma - this.decay * dt, 0, 1);
};

CameraShaker.prototype.addTrauma = function (amount) {
    if (!amount) return;
    this.trauma = pc.math.clamp(this.trauma + amount, 0, 1);
};

CameraShaker.prototype.addImpulse = function (magnitude) {
    this.addTrauma(pc.math.clamp(magnitude * 0.3, 0, 1));
};

CameraShaker.prototype.clearShake = function () {
    this.trauma = 0;
    if (this._target) {
        this._target.setLocalPosition(this._basePos);
        this._target.setLocalRotation(this._baseRot);
    }
    this._appliedThisFrame = false;
};

CameraShaker.prototype.noise = function (t, seed) {
    return (Math.sin(t * 2.3 + seed * 17.8) + Math.sin(t * 5.1 + seed * 31.2)) * 0.5;
};
