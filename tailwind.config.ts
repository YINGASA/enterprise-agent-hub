import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7ff",
          100: "#d9ecff",
          200: "#b9ddff",
          300: "#86c6ff",
          400: "#4ba4ff",
          500: "#2f7df6",
          600: "#1f64d6",
          700: "#1d4fae",
          800: "#1d438b",
          900: "#1c396f",
        },
        ink: {
          950: "#0b1220",
          900: "#101828",
          800: "#1d2939",
          700: "#344054",
          600: "#475467",
          500: "#667085",
          400: "#98a2b3",
        },
      },
      boxShadow: {
        soft: "0 10px 28px rgba(31, 64, 104, 0.08)",
        panel: "0 1px 2px rgba(31, 64, 104, 0.05), 0 8px 24px rgba(31, 64, 104, 0.04)",
      },
      transitionDuration: {
        180: "180ms",
      },
    },
  },
  plugins: [],
};

export default config;
