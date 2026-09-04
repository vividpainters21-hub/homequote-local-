import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0e14",
        panel: "#11151f",
        border: "#212636",
        accent: "#22c55e",
        danger: "#ef4444",
        warn: "#f5c451",
      },
    },
  },
  plugins: [],
};

export default config;
