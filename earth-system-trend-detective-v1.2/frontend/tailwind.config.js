/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      animation: { "spin-slow": "spin 30s linear infinite" },
    },
  },
  plugins: [],
};
