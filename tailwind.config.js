/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1557FF',
          dark: '#0D3FCC',
          light: '#4D7FFF',
        },
        surface: {
          DEFAULT: '#f7f8fa',
          card: '#ffffff',
          border: '#efefef',
        },
      },
    },
  },
  plugins: [],
}
