import * as fs from "node:fs";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

const baseEnv = process.env.NODE_ENV;
const appEnv = baseEnv === "production" ? "production" : "development";

const locales = fs
  .readdirSync("./locales", { withFileTypes: true })
  .filter((dirent) => dirent.isDirectory())
  .map((dirent) => dirent.name)
  .join(",");

const namespaces = fs
  .readdirSync("./locales/en-US", { withFileTypes: true })
  .filter((dirent) => dirent.isFile())
  .map((dirent) => dirent.name.split(".")[0])
  .join(",");

const isDev = appEnv === "development";

export default defineConfig({
  define: {
    APP_VERSION: JSON.stringify(process.env.npm_package_version),
    APP_ENVIRONMENT: JSON.stringify(appEnv),
    APP_LOCALES: JSON.stringify(locales),
    APP_NAMESPACES: JSON.stringify(namespaces),
  },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: !isDev,
    }),
    react(),
    svgr(),
  ],
  clearScreen: false,
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    // Bound to all interfaces so a physical phone on the same network can load
    // the dev server via Capacitor's `server.url` live-reload setup.
    host: true,
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/android/**", "**/ios/**", "**/.idea/**"],
    },
  },
  envPrefix: ["VITE_", "SF_"],
  build: {
    // Android System WebView and iOS WKWebView on our minimum supported OS
    // versions both handle es2022; no Electron chrome128 target here.
    target: "es2022",
    minify: "esbuild",
    sourcemap: isDev,
    rolldownOptions: {
      checks: {
        circularDependency: true,
      },
      output: {
        strictExecutionOrder: true,
      },
    },
  },
});
