/**
 * The suite's own tests, which are about the repository rather than about any
 * one package. Each package keeps its own vitest config and runs its own suite;
 * this one only picks up `tests/` at the root.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
