import { defineConfig } from 'vitest/config';

export default defineConfig({
  // solid-js's default Node export is its server build, where computations never re-run.
  // The browser condition gives the tests the reactive build an island runs.
  resolve: { conditions: ['browser', 'development'] },
  ssr: { resolve: { conditions: ['browser', 'development'], externalConditions: ['browser', 'development'] } },
  test: { include: ['test/**/*.test.ts'] },
});
