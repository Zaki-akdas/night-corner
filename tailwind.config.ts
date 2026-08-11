import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        night: {
          950: "#05060f",
          900: "#0a0c1e",
          800: "#0f1230",
          700: "#161a42",
          600: "#1f2560",
        },
        neon: {
          purple: "#a855f7",
          blue: "#38bdf8",
          cyan: "#22d3ee",
          pink: "#ec4899",
        },
        warm: {
          yellow: "#fbbf24",
          amber: "#f59e0b",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        neon: "0 0 20px rgba(168,85,247,0.45), 0 0 40px rgba(56,189,248,0.25)",
        "neon-blue": "0 0 20px rgba(56,189,248,0.5)",
        "neon-yellow": "0 0 18px rgba(251,191,36,0.5)",
        glass: "inset 0 1px 0 0 rgba(255,255,255,0.08)",
      },
      backgroundImage: {
        "night-radial":
          "radial-gradient(1200px 600px at 50% -10%, rgba(168,85,247,0.18), transparent 60%), radial-gradient(900px 500px at 85% 20%, rgba(56,189,248,0.14), transparent 60%), radial-gradient(800px 500px at 10% 30%, rgba(236,72,153,0.10), transparent 60%)",
        "glass-gradient":
          "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "float-slow": {
          "0%,100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-18px) rotate(3deg)" },
        },
        twinkle: {
          "0%,100%": { opacity: "0.2" },
          "50%": { opacity: "1" },
        },
        "pulse-glow": {
          "0%,100%": { boxShadow: "0 0 16px rgba(168,85,247,0.4)" },
          "50%": { boxShadow: "0 0 32px rgba(168,85,247,0.7)" },
        },
        "gradient-x": {
          "0%,100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "spin-slow": { to: { transform: "rotate(360deg)" } },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        float: "float 4s ease-in-out infinite",
        "float-slow": "float-slow 7s ease-in-out infinite",
        twinkle: "twinkle 3s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2.5s ease-in-out infinite",
        "gradient-x": "gradient-x 6s ease infinite",
        "spin-slow": "spin-slow 18s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
