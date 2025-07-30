// Design System Theme Configuration
// Optimized for performance and accessibility (WCAG 2.1 AA)

export const theme = {
  // Color System - Optimized for contrast and accessibility
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6', // Main brand color
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
    secondary: {
      50: '#faf5ff',
      100: '#f3e8ff',
      200: '#e9d5ff',
      300: '#d8b4fe',
      400: '#c084fc',
      500: '#a855f7',
      600: '#9333ea',
      700: '#7c3aed',
      800: '#6b21a8',
      900: '#581c87',
    },
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
    },
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
    },
    danger: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
    },
    neutral: {
      50: '#fafafa',
      100: '#f4f4f5',
      200: '#e4e4e7',
      300: '#d4d4d8',
      400: '#a1a1aa',
      500: '#71717a',
      600: '#52525b',
      700: '#3f3f46',
      800: '#27272a',
      900: '#18181b',
    },
  },

  // Typography System - Optimized for readability
  typography: {
    fontFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      mono: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
    },
    fontSize: {
      xs: ['0.75rem', { lineHeight: '1rem' }],
      sm: ['0.875rem', { lineHeight: '1.25rem' }],
      base: ['1rem', { lineHeight: '1.5rem' }],
      lg: ['1.125rem', { lineHeight: '1.75rem' }],
      xl: ['1.25rem', { lineHeight: '1.75rem' }],
      '2xl': ['1.5rem', { lineHeight: '2rem' }],
      '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      '5xl': ['3rem', { lineHeight: '1' }],
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },

  // Spacing System - Consistent spacing scale
  spacing: {
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
  },

  // Border Radius - Modern, consistent curves
  borderRadius: {
    none: '0',
    sm: '0.125rem',
    DEFAULT: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    '3xl': '1.5rem',
    full: '9999px',
  },

  // Shadows - Subtle elevation system
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
    none: 'none',
  },

  // Transitions - Smooth, performant animations
  transitions: {
    duration: {
      75: '75ms',
      100: '100ms',
      150: '150ms',
      200: '200ms',
      300: '300ms',
      500: '500ms',
      700: '700ms',
      1000: '1000ms',
    },
    timing: {
      DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
      linear: 'linear',
      in: 'cubic-bezier(0.4, 0, 1, 1)',
      out: 'cubic-bezier(0, 0, 0.2, 1)',
      'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },

  // Breakpoints - Mobile-first responsive design
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },

  // Z-index Scale - Layering system
  zIndex: {
    0: '0',
    10: '10',
    20: '20',
    30: '30',
    40: '40',
    50: '50',
    dropdown: '1000',
    sticky: '1020',
    fixed: '1030',
    modalBackdrop: '1040',
    modal: '1050',
    popover: '1060',
    tooltip: '1070',
  },
};

// CSS Variables for runtime theming
export const cssVariables = `
  :root {
    /* Primary Colors */
    --color-primary: ${theme.colors.primary[500]};
    --color-primary-hover: ${theme.colors.primary[600]};
    --color-primary-active: ${theme.colors.primary[700]};
    
    /* Text Colors */
    --color-text-primary: ${theme.colors.neutral[900]};
    --color-text-secondary: ${theme.colors.neutral[600]};
    --color-text-tertiary: ${theme.colors.neutral[500]};
    --color-text-disabled: ${theme.colors.neutral[400]};
    
    /* Background Colors */
    --color-bg-primary: #ffffff;
    --color-bg-secondary: ${theme.colors.neutral[50]};
    --color-bg-tertiary: ${theme.colors.neutral[100]};
    
    /* Border Colors */
    --color-border: ${theme.colors.neutral[200]};
    --color-border-hover: ${theme.colors.neutral[300]};
    
    /* Status Colors */
    --color-success: ${theme.colors.success[500]};
    --color-warning: ${theme.colors.warning[500]};
    --color-danger: ${theme.colors.danger[500]};
    
    /* Shadows */
    --shadow-sm: ${theme.shadows.sm};
    --shadow-md: ${theme.shadows.md};
    --shadow-lg: ${theme.shadows.lg};
    
    /* Transitions */
    --transition-fast: ${theme.transitions.duration[150]} ${theme.transitions.timing.DEFAULT};
    --transition-base: ${theme.transitions.duration[200]} ${theme.transitions.timing.DEFAULT};
    --transition-slow: ${theme.transitions.duration[300]} ${theme.transitions.timing.DEFAULT};
    
    /* Border Radius */
    --radius-sm: ${theme.borderRadius.sm};
    --radius-md: ${theme.borderRadius.md};
    --radius-lg: ${theme.borderRadius.lg};
  }
  
  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    :root {
      --color-text-primary: ${theme.colors.neutral[50]};
      --color-text-secondary: ${theme.colors.neutral[400]};
      --color-text-tertiary: ${theme.colors.neutral[500]};
      --color-bg-primary: ${theme.colors.neutral[900]};
      --color-bg-secondary: ${theme.colors.neutral[800]};
      --color-bg-tertiary: ${theme.colors.neutral[700]};
      --color-border: ${theme.colors.neutral[700]};
      --color-border-hover: ${theme.colors.neutral[600]};
    }
  }
`;

// Performance optimization utilities
export const performanceUtils = {
  // GPU acceleration for smooth animations
  willChange: (property: string) => ({
    willChange: property,
  }),
  
  // Hardware acceleration
  transform3d: {
    transform: 'translateZ(0)',
  },
  
  // Reduce paint areas
  containPaint: {
    contain: 'paint',
  },
  
  // Optimize for text rendering
  textRendering: {
    textRendering: 'optimizeLegibility',
    '-webkit-font-smoothing': 'antialiased',
    '-moz-osx-font-smoothing': 'grayscale',
  },
};

// Accessibility utilities
export const a11yUtils = {
  // Screen reader only content
  srOnly: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    borderWidth: '0',
  },
  
  // Focus visible styles
  focusVisible: {
    outline: '2px solid transparent',
    outlineOffset: '2px',
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary[500]}`,
      outlineOffset: '2px',
    },
  },
  
  // Reduced motion support
  reducedMotion: {
    '@media (prefers-reduced-motion: reduce)': {
      animation: 'none',
      transition: 'none',
    },
  },
};