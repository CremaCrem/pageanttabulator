/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          900: '#0D3320',
          800: '#1B5E37',
          700: '#236B41',
          600: '#2D7E50',
          500: '#3A9162',
          100: '#E8F5EE',
        },
        gold: {
          600: '#9A7020',
          500: '#C9A84C',
          400: '#D4B96B',
          100: '#FBF5E6',
        },
        parchment: '#F9F6F0',
        success: '#27AE60',
        warning: '#F39C12',
        error: '#E74C3C',
        info: '#2980B9',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)',
        panel: '0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.08)',
        modal: '0 20px 60px rgba(0,0,0,0.20)',
        gold: '0 0 20px rgba(201,168,76,0.30), 0 4px 12px rgba(0,0,0,0.10)',
        green: '0 0 12px rgba(27,94,55,0.25)',
      },
    },
  },
  plugins: [],
}