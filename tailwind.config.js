/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        bengali: ['"Hind Siliguri"', 'sans-serif'],
        purno: ['Purno', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
