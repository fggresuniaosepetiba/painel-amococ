import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tinta institucional (azul-marinho escuro) — base do painel
        ink: {
          50: "#f4f6fa",
          100: "#e8ecf4",
          200: "#cbd4e4",
          300: "#a3b1cb",
          400: "#7687a8",
          500: "#55648a",
          600: "#414e70",
          700: "#35405b",
          800: "#2c354c",
          900: "#1d2537",
          950: "#131a29",
        },
        // Laranja da logo AMOCOC
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea6a0c",
          700: "#c2550a",
          800: "#9a440f",
          900: "#7c3910",
        },
        // Dourado/amarelo da logo
        gold: {
          300: "#ffd95e",
          400: "#ffcc33",
          500: "#f5b301",
          600: "#dd9e00",
        },
        // Azul dos telhados da logo
        azure: {
          400: "#4cc2f1",
          500: "#29abe2",
          600: "#1e8fc0",
        },
      },
      fontFamily: {
        sans: [
          "Inter Variable",
          "Inter",
          "Segoe UI",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 4px 16px -4px rgba(16, 24, 40, 0.08)",
        "card-hover":
          "0 2px 4px rgba(16, 24, 40, 0.06), 0 12px 28px -8px rgba(16, 24, 40, 0.14)",
        popover:
          "0 0 0 1px rgba(16, 24, 40, 0.04), 0 12px 32px -8px rgba(16, 24, 40, 0.22)",
        "inner-brand": "inset 0 1px 0 rgba(255,255,255,0.16)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-fast": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", scale: "0.97" },
          to: { opacity: "1", scale: "1" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(24px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out both",
        "fade-in-fast": "fade-in-fast 0.2s ease-out both",
        "scale-in": "scale-in 0.2s ease-out both",
        "slide-in-right": "slide-in-right 0.3s ease-out both",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
