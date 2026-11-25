import type { Config } from "tailwindcss";

// Colours match the PostPulse pitch deck so the app and slides look like one product.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#14163A", soft: "#4B4F7A" },
        brand: { DEFAULT: "#5B4BE8", dark: "#4536C9", light: "#A9A3FF", violet: "#8A5CF6" },
        mist: "#F4F5FB",
        line: "#DCDDF0",
        mint: { DEFAULT: "#2EC4A0", dark: "#1A8F74" },
        coral: { DEFAULT: "#F2605C", dark: "#C93D39" },
        sun: { DEFAULT: "#FFB84D", dark: "#B9741A" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,22,58,0.04), 0 4px 16px -4px rgba(20,22,58,0.08)",
        lift: "0 12px 32px -8px rgba(91,75,232,0.35)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
