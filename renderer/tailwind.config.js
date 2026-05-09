/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: "#0f172a", light: "#1e293b", lighter: "#334155" },
        accent: { DEFAULT: "#3b82f6", hover: "#2563eb" },
      },
    },
  },
  plugins: [],
};
