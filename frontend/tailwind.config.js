/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // iOS-like system typography (SF Pro / system UI)
        display: ["-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
        sans:    ["-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
        mono:    ["'DM Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        // Core palette: deep slate + cool cyan accent (no yellow/acid tones)
        slate: {
          950: "#0a0f1a",
          900: "#0f172a",
          800: "#1e293b",
          700: "#334155",
          600: "#475569",
          500: "#64748b",
          400: "#94a3b8",
          300: "#cbd5e1",
        },
        // Retain "lime" name in classes but map to a cyan/teal range
        lime: {
          400: "#22d3ee", // cyan-400
          300: "#67e8f9",
          200: "#a5f3fc",
        },
        // Amber repurposed as a soft violet accent (non-yellow)
        amber: {
          400: "#a855f7",
        },
        rose: {
          500: "#f43f5e",
          400: "#fb7185",
        },
      },
      animation: {
        "pulse-slow":   "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow":    "spin 2s linear infinite",
        "fade-in":      "fadeIn 0.4s ease forwards",
        "slide-up":     "slideUp 0.35s ease forwards",
        "shimmer":      "shimmer 1.5s infinite",
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
