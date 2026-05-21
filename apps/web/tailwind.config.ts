import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        stone: {
          50: "#fafaf9",
          100: "#f5f5f4",
          200: "#e7e5e4",
          300: "#d6d3d1",
          400: "#a8a29e",
          500: "#78716c",
          600: "#57534e",
          700: "#44403c",
          800: "#292524",
          900: "#1c1917",
          950: "#0c0a09"
        },
        primary: {
          DEFAULT: "#1c1917", // Stone 900
          foreground: "#fafaf9" // Stone 50
        },
        secondary: {
          DEFAULT: "#e7e5e4", // Stone 200
          foreground: "#1c1917" // Stone 900
        },
        accent: {
          DEFAULT: "#ca8a04", // Yellow 600 (Goldish) - adjusted to be more "Terra" like
          terra: "#c2410c", // Orange 700
          sage: "#4d7c0f" // Green 700
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
} satisfies Config;
