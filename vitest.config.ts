import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // The `server-only` package throws unless the bundler sets Next's
      // `react-server` resolution condition, which plain Node/Vitest never
      // does. Point it at the no-op file the package itself ships instead of
      // going through its normal (throwing) entry point.
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    globals: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/**/*.ts", "app/api/**/route.ts", "proxy.ts"],
      // database.types.ts is generated type-only, no runtime code; utils.ts
      // (cn/clsx helper) is a UI concern, out of scope for this round (see
      // the "API + lib only" scope decision).
      exclude: ["lib/database.types.ts", "lib/utils.ts", "**/*.test.ts"],
    },
  },
});
