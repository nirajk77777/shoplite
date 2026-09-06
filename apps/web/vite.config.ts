import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// The storefront runs on its own port next to the API. Browser calls go to
// `/api/...` and the dev server forwards them to the API, so the `x-trace-id`
// response header arrives untouched without the API needing CORS.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = env.SHOPLITE_API_URL ?? "http://localhost:4000";
  const port = Number(env.WEB_PORT ?? 4001);

  return {
    plugins: [react()],
    server: {
      port,
      strictPort: true,
      proxy: {
        "/api": {
          target: apiUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
    preview: { port, strictPort: true },
  };
});
