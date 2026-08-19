import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta propia de Castigram: terracota, oliva y piedra.
        // Inspirada en los colores de un pueblo castellano.
        brand: {
          50: "#fbf6f1",
          100: "#f5e8dc",
          200: "#ead0ba",
          300: "#dbb08e",
          400: "#c98a60",
          500: "#bd6f42",
          600: "#af5a37",
          700: "#92472f",
          800: "#763b2c",
          900: "#603227",
        },
        olive: {
          100: "#eef0e2",
          300: "#c3caa0",
          500: "#7a8450",
          700: "#565d38",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
