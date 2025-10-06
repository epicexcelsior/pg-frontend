(function () {
  var scope = (typeof window !== 'undefined' && window) ||
              (typeof globalThis !== 'undefined' && globalThis) ||
              {};

  function AvatarNetSync(app, opts) {
    opts = opts || {};
    this.app = app;
    this.sendRecipe = opts.sendRecipe || function (recipe) { app.fire('network:send:avatarRecipe', recipe); };
    this.applyRecipeToPlayer = opts.applyRecipeToPlayer || function () { return Promise.resolve(); };
    this.isLocalPlayerId = opts.isLocalPlayerId || function () { return false; };

    this._onLocalApply = this.handleLocalApply.bind(this);
    this._onRemoteRecipe = this.handleRemoteRecipe.bind(this);

    this.app.on('avatar:apply', this._onLocalApply);
    this.app.on('avatar:recipe', this._onRemoteRecipe);
  }

  AvatarNetSync.prototype.handleLocalApply = function (recipe) {
    if (!recipe) return;
    try {
      this.sendRecipe(recipe);
    } catch (err) {
      console.error('AvatarNetSync: Failed to send recipe.', err);
    }
  };

  AvatarNetSync.prototype.handleRemoteRecipe = async function (payload) {
    if (!payload) return;
    var playerId = payload.playerId || payload.sessionId || payload.id;
    var recipe = payload.recipe || payload.data || null;
    if (!playerId || !recipe) {
      console.warn('AvatarNetSync: Invalid remote recipe payload.', payload);
      return;
    }
    if (this.isLocalPlayerId(playerId)) return;
    try {
      await this.applyRecipeToPlayer(playerId, recipe);
    } catch (err) {
      console.error('AvatarNetSync: Failed to apply recipe for player ' + playerId + '.', err);
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
