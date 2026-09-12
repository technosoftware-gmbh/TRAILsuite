// Flat ESLint config (ESLint 9+).
//
// Deliberately NOT running eslint-plugin-obsidianmd, unlike the plugin
// repos: this package must never know Obsidian exists, so a ruleset written
// for Obsidian plugins has nothing to say about it. The `no-restricted-imports`
// rule below is what enforces that, and it is the single most load-bearing
// rule in this file.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      // The sandbox that edits this repo cannot unlink files, so deletions land
      // here instead. Nothing in it is source.
      '_to_delete/**',
      '**/*.config.{js,mjs,cjs,ts,mts}',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettierRecommended,

  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'unused-imports': unusedImports },
    rules: {
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      // An underscore prefix is the deliberate "I know, and I mean it" marker,
      // and `ignoreRestSiblings` is what lets `const { omitted: _x, ...rest }`
      // stay the readable way to build an object with one key missing.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  // The invariant this package exists to keep.
  //
  // A single `import { TFile } from 'obsidian'` anywhere under src/ turns this
  // from a portable domain layer into a second copy of the plugin code, and it
  // would happen by reflex rather than by decision, because every author here
  // has been writing Obsidian plugins all week. Enforced rather than documented,
  // because `CLAUDE.md` files in the plugin repos are the worked example
  // of what happens to a contract that lives only in prose.
  //
  // The exception is pre-declared: when the vault port lands (phase 4), its
  // Obsidian implementation goes in src/obsidian/ and is the one place allowed
  // to import it. Nothing else, ever, including tests.
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    ignores: ['src/obsidian/**/*.ts'],
    rules: {
      // The DOM half of the same invariant, and it earns its place now that
      // `tsconfig.json` loads the DOM lib: `src/obsidian/render-invoice.ts`
      // builds elements, and Obsidian's typings augment `HTMLElement` rather
      // than declaring it. A lib is per-package, so the compiler would no
      // longer object to a pure module reaching for `document`.
      //
      // `tests/obsidian-free.test.ts` checks the same thing by reading the
      // source, for the reason stated there: a lint rule only runs when
      // somebody runs lint. This is the copy that fails in the editor.
      'no-restricted-globals': [
        'error',
        {
          name: 'document',
          message:
            'trail-core must stay renderer-free outside src/obsidian/. A module that needs the DOM belongs there.',
        },
        {
          name: 'window',
          message:
            'trail-core must stay renderer-free outside src/obsidian/. A module that needs the DOM belongs there.',
        },
        {
          name: 'navigator',
          message:
            'trail-core must stay renderer-free outside src/obsidian/. A module that needs the DOM belongs there.',
        },
        {
          name: 'localStorage',
          message:
            'trail-core keeps no state of its own. Persistence is the host application\'s business.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'obsidian',
              message:
                'trail-core must stay Obsidian-free. Express what you need as a port in src/vault/ports.ts and implement it in src/obsidian/.',
            },
          ],
        },
      ],
    },
  }
);
