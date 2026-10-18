import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_TARGET || "http://127.0.0.1:8081";

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
        ].map((path) => [
          path,
          {
            target: apiTarget,
            bypass: (req: import("node:http").IncomingMessage) =>
              req.method === "GET" && req.headers.accept?.includes("text/html") ? "/index.html" : undefined,
          },
        ]),
      ),
    },
  };
});
