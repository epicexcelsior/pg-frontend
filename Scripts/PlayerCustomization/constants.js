(function () {
  var scope = (typeof window !== 'undefined' && window) ||
              (typeof globalThis !== 'undefined' && globalThis) ||
              {};

  var constants = {
    AVATAR_SLOTS: ["head", "body", "legs", "feet"],
    DEFAULTS: {
      version: 1,
      gender: "unisex",
      head: "Casual_Head",
      body: "Casual_Body",
      legs: "Casual_Legs",
      feet: "Casual_Feet"
    },
    CACHE: { perSlotKeep: 6, prefetchCount: 2 },
    NET: { rateLimitMs: 1000 }
  };

  scope.PlayerCustomization = scope.PlayerCustomization || {};
  scope.PlayerCustomization.AVATAR_SLOTS = constants.AVATAR_SLOTS;
  scope.PlayerCustomization.DEFAULTS = constants.DEFAULTS;
  scope.PlayerCustomization.CACHE = constants.CACHE;
  scope.PlayerCustomization.NET = constants.NET;
  scope.PlayerCustomization.CONSTANTS = constants;
})();
