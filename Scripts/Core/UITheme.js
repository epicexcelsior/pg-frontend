var UITheme = pc.createScript('uiTheme');

UITheme.attributes.add('themeConfig', {
    type: 'json',
    title: 'Theme Configuration',
    description: 'Override default theme values'
});

UITheme.prototype.initialize = function() {
    // Default Premium Theme
    this.theme = {
        colors: {
            // Primary Brand Colors
            primary: '#6366f1', // Indigo 500
            primaryHover: '#4f46e5', // Indigo 600
            primaryActive: '#4338ca', // Indigo 700
            
            // Accent Colors
            accent: '#10b981', // Emerald 500
            accentHover: '#059669', // Emerald 600
            
            // Backgrounds / Surfaces (Glassmorphism)
            background: 'rgba(15, 23, 42, 0.6)', // Slate 900 with opacity
            surface: 'rgba(30, 41, 59, 0.7)', // Slate 800 with opacity
            surfaceHighlight: 'rgba(51, 65, 85, 0.8)', // Slate 700 with opacity
            
            // Text
            text: '#f8fafc', // Slate 50
            textSecondary: '#94a3b8', // Slate 400
            textMuted: '#64748b', // Slate 500
            
            // Functional
            success: '#22c55e',
            warning: '#eab308',
            error: '#ef4444',
            info: '#3b82f6',
            
            // Borders
            border: 'rgba(255, 255, 255, 0.1)',
            borderHighlight: 'rgba(255, 255, 255, 0.2)'
        },
        typography: {
            fontFamily: "'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            sizes: {
                xs: '12px',
                sm: '14px',
                base: '16px',
                lg: '18px',
                xl: '24px',
                xxl: '32px'
            },
            weights: {
                regular: 400,
                medium: 500,
                bold: 700
            }
        },
        spacing: {
            xs: '4px',
            sm: '8px',
            md: '16px',
            lg: '24px',
            xl: '32px',
            xxl: '48px'
        },
        borderRadius: {
            sm: '6px',
            md: '12px',
            lg: '16px',
            full: '9999px'
        },
        shadows: {
            sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            glow: '0 0 15px rgba(99, 102, 241, 0.5)'
        },
        animations: {
            fast: '0.15s ease',
            normal: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            slow: '0.5s cubic-bezier(0.4, 0, 0.2, 1)'
        }
    };

    // Merge with user config if provided
    if (this.themeConfig) {
        this.mergeDeep(this.theme, this.themeConfig);
    }

    console.log('UITheme initialized');
};

UITheme.prototype.getTheme = function() {
    return this.theme;
};

// Helper to deep merge objects
UITheme.prototype.mergeDeep = function(target, source) {
    const isObject = (obj) => obj && typeof obj === 'object';

    if (!isObject(target) || !isObject(source)) {
        return source;
    }

    Object.keys(source).forEach(key => {
        const targetValue = target[key];
        const sourceValue = source[key];

        if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
            target[key] = targetValue.concat(sourceValue);
        } else if (isObject(targetValue) && isObject(sourceValue)) {
            target[key] = this.mergeDeep(Object.assign({}, targetValue), sourceValue);
        } else {
            target[key] = sourceValue;
        }
    });

    return target;
};
