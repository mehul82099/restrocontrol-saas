/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tapri Warm theme: the `emerald` scale is remapped to terracotta so every
        // existing emerald-* class across the app renders in the warm palette.
        emerald: {
          50: '#f9ece2',
          100: '#f5ddd2',
          200: '#ecc4b4',
          300: '#dfa18b',
          400: '#d4695a',
          500: '#cb4a3c',
          600: '#c0392b',
          700: '#a32f23',
          800: '#82271d',
          900: '#5f1e17',
          950: '#3b1d12',
        },
        brand: {
          50: '#f9ece2',
          100: '#f5ddd2',
          200: '#ecc4b4',
          500: '#c0392b',
          600: '#a32f23',
          700: '#82271d',
          800: '#5f1e17',
          900: '#3b1d12',
        },
        // Warm neutral scale: `slate` is remapped from blue-gray to brown-gray so
        // utility screens keep their structure but sit inside the warm theme.
        slate: {
          50: '#faf7f2',
          100: '#f4efe8',
          200: '#e7ded2',
          300: '#d4c7b6',
          400: '#a89880',
          500: '#7d6f5c',
          600: '#5c5142',
          700: '#453c30',
          800: '#2e2720',
          900: '#1f1a14',
          950: '#140f0a',
        },
        // Decorative gradient partner (was teal) -> marigold.
        teal: {
          400: '#e8a33d',
        },
        tapri: {
          cream: '#f7ead9',
          card: '#fff8ee',
          ink: '#3b1d12',
          muted: '#7a5138',
          accent: '#c0392b',
          line: 'rgba(59,29,18,.16)',
        },
        sidebar: {
          bg: '#2a1408',
          hover: '#3b1d12',
          active: '#54271a',
          text: '#c9a488',
          textActive: '#fff8ee'
        }
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
