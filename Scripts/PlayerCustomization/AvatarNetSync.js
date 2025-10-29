(function () {
  var scope = (typeof window !== 'undefined' && window) ||
              (typeof globalThis !== 'undefined' && globalThis) ||
              {};

  function AvatarNetSync(app, opts) {
    opts = opts || {};
    this.app = app;
    this.sendDescriptor = opts.sendDescriptor || opts.sendRecipe || function (descriptor) { app.fire('player:avatar:recipe', descriptor); };
    this.applyDescriptorToPlayer = opts.applyDescriptorToPlayer || opts.applyRecipeToPlayer || function () { return Promise.resolve(); };
    this.isLocalPlayerId = opts.isLocalPlayerId || function () { return false; };

    this._onLocalApply = this.handleLocalApply.bind(this);
    this._onRemoteRecipe = this.handleRemoteRecipe.bind(this);

    this.app.on('avatar:apply', this._onLocalApply);
    this.app.on('avatar:recipe', this._onRemoteRecipe);
  }

  function isDescriptor(data) {
    return data && typeof data === 'object' && typeof data.avatarId === 'string';
  }

  AvatarNetSync.prototype.handleLocalApply = function (descriptor) {
    if (!isDescriptor(descriptor)) return;
    try {
      this.sendDescriptor(descriptor);
    } catch (err) {
      console.error('AvatarNetSync: Failed to send avatar descriptor.', err);
    }
  };

  AvatarNetSync.prototype.handleRemoteRecipe = async function (payload) {
    if (!payload) return;
    var playerId = payload.playerId || payload.sessionId || payload.id;
    var descriptor = payload.recipe || payload.descriptor || payload.data || payload;
    if (!playerId || !isDescriptor(descriptor)) {
      console.warn('AvatarNetSync: Invalid remote avatar descriptor payload.', payload);
      return;
    }
    if (this.isLocalPlayerId(playerId)) return;
    try {
      await this.applyDescriptorToPlayer(playerId, descriptor);
    } catch (err) {
      console.error('AvatarNetSync: Failed to apply avatar descriptor for player ' + playerId + '.', err);
    }
  };

  AvatarNetSync.prototype.destroy = function () {
    this.app.off('avatar:apply', this._onLocalApply);
    this.app.off('avatar:recipe', this._onRemoteRecipe);
  };

  scope.PlayerCustomization = scope.PlayerCustomization || {};
  scope.PlayerCustomization.AvatarNetSync = AvatarNetSync;
  scope.AvatarNetSync = scope.AvatarNetSync || AvatarNetSync;
})();
