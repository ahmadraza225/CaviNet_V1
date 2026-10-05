/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Where /api goes: an API started on the host at port 8000 (default), or the running
    // stack through nginx with VITE_API_PROXY=http://localhost:8080.
    proxy: { "/api": process.env.VITE_API_PROXY ?? "http://localhost:8000" },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
