/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cricket: {
          green: '#15803d',
          darkgreen: '#0b3d1f',
          pitch: '#f5efe6',
          crease: '#e2e8f0',
          red: '#dc2626',
          gold: '#eab308'
        }
      }
    },
  },
  plugins: [],
}
