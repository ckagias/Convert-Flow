/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        /* Body and headings use Inter; code uses DM Mono */
        display: ["'Inter'", "system-ui", "sans-serif"],
        sans:    ["'Inter'", "system-ui", "sans-serif"],
        mono:    ["'DM Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        /* Dark background and gray text */
        slate: {
          950: "#060b14",
          900: "#0d1520",
          800: "#132030",
          700: "#1e3448",
          600: "#2e4a66",
          500: "#4a6380",
          400: "#7a9ab2",
          300: "#a8c4d8",
          200: "#c9dde8",
        },
        /* Main accent color for buttons and links */
        cyan: {
          500: "#06b6d4",
          400: "#22d3ee",
          300: "#67e8f9",
          200: "#a5f3fc",
        },
        /* Same as cyan (for classes that use "lime" in the name) */
        lime: {
          400: "#22d3ee",
          300: "#67e8f9",
          200: "#a5f3fc",
        },
        amber: {
          400: "#a855f7",
        },
        rose: {
          500: "#f43f5e",
          400: "#fb7185",
        },
      },
      animation: {
        "pulse-slow":  "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow":   "spin 2s linear infinite",
        "fade-in":     "fadeIn 0.4s ease forwards",
        "slide-up":    "slideUp 0.35s ease forwards",
        "shimmer":     "shimmer 1.5s infinite",
      },
      keyframes: {
        fadeIn:  { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(16px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
