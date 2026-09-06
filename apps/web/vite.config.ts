import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// The storefront runs on its own port next to the API. Browser calls go to
// `/api/...` and the dev server forwards them to the API, so the `x-trace-id`
// response header arrives untouched without the API needing CORS. `/portal/...`
// goes the same way to the Incident Resolver portal, which is where a reported
// problem becomes a Ticket and where its Reply is read back.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = env.SHOPLITE_API_URL ?? "http://localhost:4000";
  const portalUrl = env.PORTAL_API_URL ?? "http://localhost:5000";
  const port = Number(env.WEB_PORT ?? 4001);

  const forward = (target: string, prefix: string) => ({
    target,
    changeOrigin: true,
    rewrite: (path: string) => path.slice(prefix.length),
  });

  return {
    plugins: [react()],
    server: {
      port,
      strictPort: true,
      proxy: {
        "/api": forward(apiUrl, "/api"),
        "/portal": forward(portalUrl, "/portal"),
      },
    },
    preview: { port, strictPort: true },
  };
});
