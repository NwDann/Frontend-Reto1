/** Tailwind v4 loads this file through @config in src/index.css. */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: { nexo: { teal: "#0f766e", navy: "#142b37", paper: "#f4f7f8" } },
    },
  },
  plugins: [],
};
