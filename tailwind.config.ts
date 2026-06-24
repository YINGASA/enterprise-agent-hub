import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7ff",
          100: "#d9ecff",
          500: "#2f7df6",
          600: "#1f64d6",
          700: "#1d4fae",
        },
        ink: {
          900: "#101828",
          700: "#344054",
          500: "#667085",
        },
      },
      boxShadow: {
        soft: "0 10px 30px rgba(16, 24, 40, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
