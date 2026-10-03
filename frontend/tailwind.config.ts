import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4fa",
          100: "#dce6f1",
          600: "#2e75b6",
          700: "#1f4e79",
          800: "#173b5c",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
