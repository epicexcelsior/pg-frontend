///<reference path="c:\Users\Epic\.vscode-insiders\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
// ///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var ScenePreloader = pc.createScript('scenePreloader');

ScenePreloader.attributes.add('sceneName', {
     type: 'string',
     title: 'Scene Name to Preload',
     description: 'The name of the scene whose hierarchy and settings should be preloaded.'
});
ScenePreloader.attributes.add('startDelay', {
     type: 'number',
     default: 2000,
     title: 'Start Delay (ms)',
     description: 'Delay in milliseconds after Login scene is initialized before starting preload.'
});

ScenePreloader.prototype.initialize = function () {
     this.assetsLoaded = false; // Now indicates both hierarchy and settings loaded
     this.preloadError = null;
     this.sceneRegistryItem = null;
     this.preloadStarted = false;
     this.loadedRootEntity = null; // To store the preloaded hierarchy root

     if (!this.sceneName) {
          console.error("ScenePreloader: 'Scene Name to Preload' attribute is not set.");
          return;
     }

     this.sceneRegistryItem = this.app.scenes.find(this.sceneName);
     if (!this.sceneRegistryItem) {
          console.error(`ScenePreloader: Scene '${this.sceneName}' not found in the scene registry.`);
          return;
     }

     setTimeout(() => {
          if (!this.preloadStarted) {
               this.startPreload();
          }
     }, this.startDelay);

     console.log(`ScenePreloader: Initialized. Preload for scene '${this.sceneName}' will start shortly.`);
};

ScenePreloader.prototype.startPreload = function () {
     if (this.preloadStarted || !this.sceneRegistryItem) {
          if (!this.sceneRegistryItem) {
               console.error("ScenePreloader: Cannot start preload, scene registry item not found during initialization.");
               this.preloadError = "Invalid scene data";
          }
          return;
     }

     this.preloadStarted = true;

     if (!this.sceneRegistryItem.url) {
          console.error("ScenePreloader: Invalid scene registry item provided for preloading.");
          this.preloadError = "Invalid scene data";
          return;
     }

     console.log(`ScenePreloader: Starting preload for scene '${this.sceneName}' (hierarchy and settings)...`);

     let hierarchyLoaded = false;
     let settingsLoaded = false;

     this.app.scenes.loadSceneHierarchy(this.sceneRegistryItem.url, (err, loadedRootEntity) => {
          if (err) {
               console.error(`ScenePreloader: Error preloading hierarchy for scene '${this.sceneName}':`, err);
               this.preloadError = this.preloadError || err;
               hierarchyLoaded = false;
          } else {
               console.log(`ScenePreloader: Successfully preloaded hierarchy for scene '${this.sceneName}'. Root entity stored.`);
               hierarchyLoaded = true;
               this.loadedRootEntity = loadedRootEntity;
          }
          checkPreloadComplete();
     });

     this.app.scenes.loadSceneSettings(this.sceneRegistryItem.url, (err) => {
          if (err) {
               console.error(`ScenePreloader: Error preloading scene settings for '${this.sceneName}':`, err);
               this.preloadError = this.preloadError || err;
               settingsLoaded = false;
          } else {
               console.log(`ScenePreloader: Successfully preloaded scene settings for scene '${this.sceneName}'.`);
               settingsLoaded = true;
          }
          checkPreloadComplete();
     });

     const checkPreloadComplete = () => {
          if (hierarchyLoaded && settingsLoaded) {
               if (!this.preloadError) {
                    this.assetsLoaded = true;
                    this.app.fire('scene:preload:success', this.sceneName);
                    console.log("ScenePreloader: Preload of scene hierarchy and settings complete.");
               } else {
                    this.assetsLoaded = false;
                    this.app.fire('scene:preload:error', this.sceneName, this.preloadError);
                    console.error("ScenePreloader: Preload completed with errors.");
               }
          }
     };
};

ScenePreloader.prototype.isLoaded = function () {
     return this.assetsLoaded;
};

ScenePreloader.prototype.getError = function () {
     return this.preloadError;
};

// --- ADDED: Method to get the preloaded root ---
ScenePreloader.prototype.getLoadedRoot = function () {
     if (!this.isLoaded()) {
          console.warn("ScenePreloader: Tried to get root entity before hierarchy was loaded.");
          return null;
     }
     return this.loadedRootEntity;
};

// swap method (keep as is)
// ScenePreloader.prototype.swap = function(old) { };