import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0a0a0c",
          panel: "#111114",
          subtle: "#16161a",
          hover: "#1c1c22",
        },
        line: {
          DEFAULT: "#22222a",
          subtle: "#1a1a20",
          strong: "#33333d",
        },
        ink: {
          DEFAULT: "#e9e9ee",
          muted: "#a0a0aa",
          faint: "#6a6a74",
        },
        accent: {
          DEFAULT: "#7c8cff",
          glow: "#a0acff",
        },
        diff: {
          add: "#1f3a26",
          addText: "#9fe0a8",
          del: "#3a1f1f",
          delText: "#ff9aa2",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Inter", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(124,140,255,0.4), 0 0 20px rgba(124,140,255,0.15)",
      },
      animation: {
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
