import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",
        "primary-hover": "var(--color-primary-hover)",
        "primary-soft": "var(--color-primary-soft)",
        "mint-surface": "var(--color-mint-surface)",
        paper: "var(--color-paper)",
        "paper-2": "var(--color-paper-2)",
        "paper-3": "var(--color-paper-3)",
        card: "var(--color-card)",
        rule: "var(--color-rule)",
        edge: "var(--color-edge)",
        muted: "var(--color-muted)",
        ink: "var(--color-ink)",
        accent: "var(--color-accent)",
        "accent-deep": "var(--color-accent-deep)",
        highlight: "var(--color-highlight)",
        "highlight-soft": "var(--color-highlight-soft)",
        coral: "var(--color-coral)",
        yellow: "var(--color-yellow)",
      },
      fontFamily: {
        display: [
          "var(--font-display)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        sans: [
          "var(--font-body)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        eco: "0 4px 20px -2px rgba(23, 107, 77, 0.08), 0 2px 6px -1px rgba(24, 48, 42, 0.04)",
        "eco-hover": "0 10px 25px -4px rgba(23, 107, 77, 0.12), 0 4px 10px -2px rgba(24, 48, 42, 0.06)",
        "eco-sm": "0 2px 8px 0 rgba(23, 107, 77, 0.06)",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
      },
      transitionDuration: {
        quick: "var(--dur-quick)",
      },
      maxWidth: {
        prose: "65ch",
      },
    },
  },
  plugins: [],
};

export default config;
