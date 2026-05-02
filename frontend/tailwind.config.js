/** @type {import('tailwindcss').Config} */
//
// Color tokens are CSS variables so a single class set works for both light
// and dark themes.  See src/index.css for the actual variable definitions.
//
const cssVar = (name) => `rgb(var(--color-${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Manual `.light` toggle on <html> drives the theme — see src/lib/theme.tsx.
  // We keep `darkMode: 'class'` for any explicit `dark:` utilities that show
  // up in components down the line, but the var-based palette below means
  // we generally don't need them.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: cssVar('bg'),
        surface: cssVar('surface'),
        'surface-hover': cssVar('surface-hover'),
        border: cssVar('border'),
        text: {
          1: cssVar('text-1'),
          2: cssVar('text-2'),
          3: cssVar('text-3'),
        },
        accent: {
          DEFAULT: cssVar('accent'),
          hover: cssVar('accent-hover'),
          glow: 'rgba(37, 99, 235, 0.25)',
        },
        success: cssVar('success'),
        warning: cssVar('warning'),
        danger: cssVar('danger'),
        // Fuel colors are intentionally identical in both modes so charts
        // remain comparable across screenshots and themes.
        fuel: {
          coal: '#737373',
          gas: '#f59e0b',
          nuclear: '#a855f7',
          hydro: '#06b6d4',
          wind: '#22d3ee',
          solar: '#fde047',
          oil: '#dc2626',
        },
      },
      fontFamily: {
        sans: [
          '"IBM Plex Sans"',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        mono: ['"IBM Plex Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
      },
      boxShadow: {
        card: '0 2px 12px rgba(0, 0, 0, 0.15)',
        'card-hover': '0 6px 20px rgba(0, 0, 0, 0.25)',
        glow: '0 0 0 3px rgba(37, 99, 235, 0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 240ms ease-out',
        'slide-up': 'slideUp 280ms ease-out',
        'slide-in-right': 'slideInRight 280ms cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 1.6s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        slideUp: {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: 0, transform: 'translateX(16px)' },
          '100%': { opacity: 1, transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
    },
  },
  plugins: [],
}
