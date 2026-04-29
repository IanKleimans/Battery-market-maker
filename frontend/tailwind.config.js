/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Match the realtime simulator palette exactly so existing
        // screenshots and the embedded Classic mode look identical.
        bg: '#06080f',
        surface: '#0c1221',
        'surface-hover': '#111a2f',
        border: '#162040',
        text: {
          1: '#f1f5f9',
          2: '#64748b',
          3: '#334155',
        },
        accent: {
          DEFAULT: '#2563eb',
          hover: '#1d4ed8',
          glow: 'rgba(37, 99, 235, 0.25)',
        },
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        // Fuel colors used in the network diagram
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
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
    },
  },
  plugins: [],
}
