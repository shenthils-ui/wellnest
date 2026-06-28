/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Soft sage/teal — calm and warm, not clinical.
        brand: {
          50: '#f1f7f4',
          100: '#dcebe3',
          200: '#bcd8c9',
          300: '#92bfa8',
          400: '#69a487',
          500: '#4d8a6e',
          600: '#3c6f59',
          700: '#315a49',
          800: '#29483b',
          900: '#233c32',
        },
        // Warm sand neutrals for backgrounds.
        sand: {
          50: '#faf7f2',
          100: '#f3ede3',
          200: '#e7dccb',
        },
      },
      fontFamily: {
        sans: [
          'ui-rounded',
          '"SF Pro Rounded"',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      boxShadow: {
        soft: '0 2px 12px rgba(40, 60, 50, 0.06)',
        softer: '0 1px 6px rgba(40, 60, 50, 0.05)',
      },
      keyframes: {
        'pop-in': {
          '0%': { transform: 'scale(0.94)', opacity: '0.6' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pop-in': 'pop-in 0.16s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
