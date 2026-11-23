import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        glass: {
          light: "rgba(255, 255, 255, var(--glass-opacity-light, 0.65))",
          dark: "rgba(22, 27, 34, var(--glass-opacity-dark, 0.55))",
          border: "var(--glass-border)",
          highlight: "var(--glass-highlight)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
          muted: "var(--accent-muted)",
        },
      },
      backdropBlur: {
        xs: "2px",
        glass: "var(--glass-blur, 20px)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      animation: {
        "orb-slow-1": "orbFloat1 24s ease-in-out infinite alternate",
        "orb-slow-2": "orbFloat2 28s ease-in-out infinite alternate",
        "orb-slow-3": "orbFloat3 32s ease-in-out infinite alternate",
        "pulse-subtle": "pulseSubtle 3s ease-in-out infinite",
      },
      keyframes: {
        orbFloat1: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "50%": { transform: "translate(60px, -40px) scale(1.12)" },
          "100%": { transform: "translate(-30px, 50px) scale(0.95)" },
        },
        orbFloat2: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "50%": { transform: "translate(-70px, 60px) scale(1.15)" },
          "100%": { transform: "translate(40px, -30px) scale(0.92)" },
        },
        orbFloat3: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "50%": { transform: "translate(50px, 60px) scale(1.08)" },
          "100%": { transform: "translate(-40px, -40px) scale(1.02)" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
