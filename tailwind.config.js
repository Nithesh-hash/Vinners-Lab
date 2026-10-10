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
          50: '#f4f6fc',
          100: '#e6ebf8',
          200: '#ccd8f0',
          300: '#a3bae3',
          400: '#7395d2',
          500: '#5075c1',
          600: '#3e5ba8',
          700: '#344988',
          800: '#2d3d72',
          900: '#28345a',
          950: '#1b213b',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
