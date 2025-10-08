// Scripts/UI/Theme/Theme.js

/**
 * @namespace Theme
 * @description A centralized theme management system for the game UI.
 * This object holds the color palette, font styles, and other UI-related
 * styling variables to ensure a consistent look and feel across all components.
 *
 * By defining styles here, we can easily update the entire UI's appearance
 * from a single source of truth. The UIManager will be responsible for
 * injecting these theme properties into the relevant UI components.
 */
const Theme = {
  // Color Palette
  colors: {
    // Primary colors for branding and key actions
    primary: '#1d9bf0', // Twitter blue for primary actions
    primary2: '#1d77f2', // A slightly darker shade for gradients
    
    // Accent colors for secondary actions and highlights
    accent: '#1df2a4', // A vibrant green for positive feedback or highlights
    accent2: '#1de8f2', // A cyan shade for secondary highlights

    // UI Surface colors
    surface: 'rgba(17, 17, 17, 0.92)', // Dark, slightly transparent background
    surface2: 'rgba(34, 34, 34, 0.95)', // A lighter dark shade for elevated surfaces
    
    // Text colors
    text: '#ffffff', // Primary text color (white)
    textMuted: 'rgba(255, 255, 255, 0.85)', // For less important text
    textDark: '#111111', // For light backgrounds
    
    // Feedback colors
    success: '#28a745', // Green for success messages
    warning: '#ffc107', // Yellow for warnings
    error: '#dc3545',   // Red for errors
  },

  // Font Styles
  fonts: {
    family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    size: {
      small: '12px',
      medium: '14px',
      large: '16px',
      xlarge: '20px',
    },
    weight: {
      light: 300,
      regular: 400,
      semibold: 600,
      bold: 700,
    },
  },

  // UI Element Styling
  styles: {
    borderRadius: '14px',
    boxShadow: '0 18px 36px rgba(0, 0, 0, 0.35)',
    button: {
      padding: '10px 14px',
      borderRadius: '10px',
      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    },
    input: {
      padding: '10px',
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
  },
};

// Make it accessible globally
window.Theme = Theme;