/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './utils.ts',
    './types.ts',
    './index.tsx',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
