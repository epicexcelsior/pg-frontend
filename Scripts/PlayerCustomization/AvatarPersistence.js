(function () {
  var scope = (typeof window !== 'undefined' && window) ||
              (typeof globalThis !== 'undefined' && globalThis) ||
              {};

  var DESCRIPTOR_PREFIX = 'avatar:descriptor:';
  var LEGACY_PREFIX = 'avatar:recipe:';

  function isDescriptor(data) {
    return data && typeof data === 'object' && typeof data.avatarId === 'string';
  }

  var AvatarPersistence = {
    save: function (id, data) {
      if (!id || !data) return;
      try {
        localStorage.setItem(DESCRIPTOR_PREFIX + id, JSON.stringify(data));
        // Clear legacy slot-based entry if it exists to prevent stale data reuse.
        localStorage.removeItem(LEGACY_PREFIX + id);
      } catch (err) {
        console.warn('AvatarPersistence: Failed to save avatar descriptor.', err);
      }
    },
    load: function (id) {
      if (!id) return null;
      try {
        var raw = localStorage.getItem(DESCRIPTOR_PREFIX + id);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (isDescriptor(parsed)) {
            return parsed;
          }
        }
        var legacy = localStorage.getItem(LEGACY_PREFIX + id);
        return legacy ? JSON.parse(legacy) : null;
      } catch (err) {
        console.warn('AvatarPersistence: Failed to load avatar descriptor.', err);
        return null;
      }
    },
    clear: function (id) {
      if (!id) return;
      try {
        localStorage.removeItem(DESCRIPTOR_PREFIX + id);
        localStorage.removeItem(LEGACY_PREFIX + id);
      } catch (err) {
        console.warn('AvatarPersistence: Failed to clear avatar descriptor.', err);
      }
    }
  };

  scope.PlayerCustomization = scope.PlayerCustomization || {};
  scope.PlayerCustomization.AvatarPersistence = AvatarPersistence;
  scope.AvatarPersistence = scope.AvatarPersistence || AvatarPersistence;
})();
