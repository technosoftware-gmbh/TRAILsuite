import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // The `obsidian` package has no runtime entry point, so Vite cannot
      // resolve it from inside the linked `trail-core` and substitutes an
      // optional-peer-dependency stub under a different module id, which a
      // suite's vi.mock('obsidian') then does not cover. Pointing both
      // packages at one resolvable file puts them back on the same id.
      obsidian: fileURLToPath(new URL('./tests/obsidian-stub.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
  },
});
