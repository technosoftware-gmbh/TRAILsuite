import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // A timezone with daylight saving, rather than the UTC a bare Node run
    // defaults to.
    //
    // The core is where the calendar arithmetic that everything else builds on
    // lives, and the one date bug that actually bites -- a day stepped by
    // adding 86_400_000 ms, which repeats 25 October and skips the day after
    // it -- cannot happen in UTC at all. A suite running there reports a clean
    // pass on code that is wrong on every machine the plugins are installed
    // on. `recurrence.ts` walks days by the thousand and is exactly where that
    // would hide.
    //
    // Zurich because that is where the vault is, and because it matches the
    // pin the nodatrail suite already carries. Any DST zone would do.
    env: { TZ: 'Europe/Zurich' },
  },
});
