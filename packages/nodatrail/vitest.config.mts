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
    // A timezone with daylight saving, rather than the UTC a bare Node run
    // defaults to.
    //
    // This is not decoration. Half of this package is calendar arithmetic, and
    // the one class of date bug that actually bites -- a day stepped by adding
    // 86_400_000 ms, which repeats 25 October and skips the day after it --
    // cannot happen in UTC at all. A suite running there reports a clean pass
    // on code that is wrong on every machine this plugin is installed on. See
    // tests/day-buckets.test.ts, where the case is written out.
    //
    // Zurich because that is where the vault is. Any DST zone would do; a
    // named one that matches reality is easier to reason about than a
    // deliberately exotic pick.
    env: { TZ: 'Europe/Zurich' },
  },
});
