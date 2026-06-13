import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#090b0f",
        panel: "#11151d",
        line: "#27303d",
        acid: "#c9ff45",
      },
    },
  },
  plugins: [],
};

export default config;
