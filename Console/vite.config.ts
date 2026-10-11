import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_TARGET || "http://127.0.0.1:8080";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/domains": apiTarget,
        "/education": apiTarget,
        "/employment": apiTarget,
        "/addresses": apiTarget,
        "/transactions": apiTarget,
        "/forgekeeper": apiTarget,
        "/gemhues": apiTarget,
        "/health": apiTarget,
        "/local-databases": apiTarget
      }
    }
  };
});
