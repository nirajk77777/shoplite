import { configDefaults, defineConfig } from "vitest/config";

// Tests are tagged by file name.
//   *.test.ts             unit tests, no Docker needed:   pnpm test
//   *.test.tsx            storefront tests in jsdom:      pnpm test (same command)
//   *.integration.test.ts need `docker compose up`:       pnpm test:integration
const integrationGlob = "**/*.integration.test.ts";
const webGlob = "apps/web/**/*.test.{ts,tsx}";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["**/*.test.ts"],
          exclude: [...configDefaults.exclude, integrationGlob, webGlob],
        },
      },
      {
        test: {
          name: "web",
          include: [webGlob],
          exclude: [...configDefaults.exclude],
          environment: "jsdom",
          setupFiles: ["apps/web/src/test/setup.ts"],
        },
      },
      {
        test: {
          name: "integration",
          include: [integrationGlob],
          exclude: [...configDefaults.exclude],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
