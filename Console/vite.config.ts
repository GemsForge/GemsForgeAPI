import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const apiPortFile = resolve(dirname(fileURLToPath(import.meta.url)), "../.build/gemlife-api-port");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const configuredApiTarget = env.VITE_API_TARGET || "http://127.0.0.1:8180";
  const apiTargetForRequest = () => {
    try {
      const port = readFileSync(apiPortFile, "utf8").trim();
      if (/^[1-9]\d{0,4}$/.test(port) && Number(port) <= 65535) {
        return `http://127.0.0.1:${port}`;
      }
    } catch {
      // Manual Console workflows can keep using VITE_API_TARGET or port 8081.
    }
    return configuredApiTarget;
  };

  return {
    base: mode === "production" ? "/app/" : "/",
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "design-system": ["tamagui", "@tamagui/config/v5"],
            "data-cache": ["@tanstack/react-query"],
            routing: ["react-router-dom"],
          },
        },
      },
    },
    plugins: [react()],
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode),
      "process.env.TAMAGUI_TARGET": JSON.stringify("web"),
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      globals: true,
    },
    server: {
      // Use the same explicit loopback address as GemLifeHost. Resolving
      // "localhost" can select IPv6 while the native WebView tries IPv4.
      host: "127.0.0.1",
      port: 5173,
      proxy: Object.fromEntries(
        [
          "/domains",
          "/education",
          "/employment",
          "/addresses",
          "/transactions",
          "/expense-categories",
          "/expense-subcategories",
          "/merchants",
          "/service-accounts",
          "/file-metadata",
          "/file-uploads",
          "/forgekeeper",
          "/gemhues",
          "/health",
          "/auth",
          "/local-databases",
          "/live-database",
          "/schema-builder",
          "/home-inventory",
          "/operator",
        ].map((path) => [
          path,
          {
            // GemLife writes the selected API port before starting Vite.
            // Resolve it into the proxy target at startup instead of relying
            // on http-proxy's router callback, which can retain the fallback
            // target for the lifetime of the dev server.
            target: apiTargetForRequest(),
            bypass: (req: import("node:http").IncomingMessage) =>
              req.method === "GET" && req.headers.accept?.includes("text/html") ? "/index.html" : undefined,
          },
        ]),
      ),
    },
  };
});
