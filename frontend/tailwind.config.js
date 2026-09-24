/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#E50914',
          dark: '#141414',
          card: '#1f1f1f',
          accent: '#00df81'
        }
      }
    },
  },
  plugins: [],
}
