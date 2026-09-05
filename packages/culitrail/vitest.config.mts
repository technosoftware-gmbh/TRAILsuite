import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // The npm `obsidian` package is types only. `@technosoftware/trail-core/obsidian`, which
      // src/shared/vault-host.ts pulls in, imports a value from it, so under
      // Node that import has to resolve to something. See tests/obsidian-stub.ts.
      obsidian: fileURLToPath(new URL('./tests/obsidian-stub.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
  },
});
