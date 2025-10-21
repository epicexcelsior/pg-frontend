// Scripts/UI/Theme/AnimationUtils.js

var AnimationUtils = {
    mergeConfig: function (baseConfig, overrides) {
        if (!baseConfig) {
            return overrides || {};
        }
        if (!overrides) {
            return baseConfig;
        }

        var result = Object.assign({}, baseConfig, overrides);
        if (baseConfig.durations || overrides.durations) {
            result.durations = Object.assign({}, baseConfig.durations, overrides.durations);
        }
        if (baseConfig.easings || overrides.easings) {
            result.easings = Object.assign({}, baseConfig.easings, overrides.easings);
        }
        if (typeof overrides.enabled === 'boolean') {
            result.enabled = overrides.enabled;
        }
        if (typeof overrides.stagger === 'number') {
            result.stagger = overrides.stagger;
        }
        if (typeof overrides.multiplier === 'number') {
            result.multiplier = overrides.multiplier;
        }
        return result;
    },

    applyEntrance: function (targets, opts) {
        if (!window.gsap || !targets || !opts) {
            return 0;
        }
        var defaults = {
            opacity: 1,
            scale: 1,
            x: 0,
            y: 0,
            duration: 0.2,
            ease: 'power3.out',
            stagger: 0.05
        };
        var config = Object.assign({}, defaults, opts);

        gsap.killTweensOf(targets);
        gsap.set(targets, {
            opacity: config.fromOpacity !== undefined ? config.fromOpacity : 0,
            scale: config.fromScale !== undefined ? config.fromScale : 0.8,
            x: config.fromX || 0,
            y: config.fromY || 12
        });

        gsap.to(targets, {
            opacity: config.opacity,
            scale: config.scale,
            x: config.x,
            y: config.y,
            duration: config.duration,
            ease: config.ease,
            stagger: config.stagger
        });

        return config.duration + (Array.isArray(targets) ? (config.stagger * (targets.length - 1)) : 0);
    },

    applyExit: function (targets, opts) {
        if (!window.gsap || !targets || !opts) {
            return 0;
        }
        var defaults = {
            toOpacity: 0,
            toScale: 0.8,
            toX: 0,
            toY: 10,
            duration: 0.16,
            ease: 'power2.in',
            stagger: 0.05
        };
        var config = Object.assign({}, defaults, opts);

        gsap.killTweensOf(targets);

        gsap.to(targets, {
            opacity: config.toOpacity,
            scale: config.toScale,
            x: config.toX,
            y: config.toY,
            duration: config.duration,
            ease: config.ease,
            stagger: config.stagger,
            onComplete: config.onComplete
        });

        return config.duration + (Array.isArray(targets) ? (config.stagger * (targets.length - 1)) : 0);
    },

    calculateRadialPositions: function (count, radius, spread, biasDeg) {
        if (!count) {
            return [];
        }
        var r = typeof radius === 'number' ? radius : 80;
        var arc = typeof spread === 'number' ? spread : Math.min(140, 50 + count * 24);
        var bias = typeof biasDeg === 'number' ? biasDeg : 0;
        var start = bias - arc / 2;
        var step = count > 1 ? arc / (count - 1) : 0;
        var positions = [];

        for (var i = 0; i < count; i++) {
            var angle = (start + step * i) * (Math.PI / 180);
            var cos = Math.cos(angle);
            var sin = Math.sin(angle);
            positions.push({
                angle: angle,
                x: cos * r,
                y: -sin * r,
                fromX: cos * (r * 0.35),
                fromY: -sin * (r * 0.35)
            });
        }

        return positions;
    }
};

window.AnimationUtils = AnimationUtils;
