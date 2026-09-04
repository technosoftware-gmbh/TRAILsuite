// Flat ESLint config (ESLint 9+).
// Runs the official Obsidian rules (eslint-plugin-obsidianmd, recommended)
// alongside the project's existing unused-imports and Prettier setup.
import obsidianmd from 'eslint-plugin-obsidianmd';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import unusedImports from 'eslint-plugin-unused-imports';
import { DEFAULT_BRANDS } from 'eslint-plugin-obsidianmd/dist/lib/rules/ui/brands.js';

export default [
  // Files ESLint should never look at.
  {
    ignores: [
      'node_modules/**',
      'main.js', // bundled build output
      'dist/**',
      'coverage/**',
      // The sandbox that edits this repo cannot unlink files, so deletions land
      // here instead. Nothing in it is source. The core's config says the same.
      '_to_delete/**',
      // esbuild.config.mjs, vitest.config.mts, this file, and anything else
      // that configures a tool rather than being plugin source. The vitest config
      // is `.mts` because it is ESM and this package is not: see
      // docs/design/testing-and-development.md.
      '**/*.config.{js,mjs,cjs,mts}',
      'sync-version.js',
      // Non-source JSON (only package.json is meant to be linted, by the
      // obsidianmd manifest/license rules). The rest are data/config files.
      'data.json',
      'manifest.json',
      'versions.json',
      'package-lock.json',
      'tsconfig*.json',
      '**/tsconfig*.json', // also covers tests/tsconfig.json
    ],
  },

  // Official Obsidian recommended ruleset. Includes the typescript-eslint
  // type-checked rules and @typescript-eslint/no-deprecated.
  ...obsidianmd.configs.recommended,

  // tests/** runs under Vitest's "node" environment, not inside a real
  // Obsidian window -- rules that assume live Obsidian runtime globals or a
  // real Vault don't apply there.
  //   - no-global-this once auto-fixed a legitimate `globalThis` reference
  //     (used to stub the missing `window` global under Node) into
  //     `vi.stubGlobal('window', window)`, a broken self-reference -- see
  //     debounce.test.ts. Turned off here rather than just reverted, so
  //     `eslint --fix` can't silently reintroduce it.
  //   - no-tfile-tfolder-cast wants `instanceof TFile` checks instead of
  //     casts, which is right for production code handling a real,
  //     unknown file-like object -- but unit tests have no live Vault to
  //     get a real TFile from, so building a minimal fake object via cast
  //     (see recipe-location.test.ts's `file()` helper) is the only way to
  //     test pure functions that only read a couple of TFile's fields.
  //   - no-restricted-imports / import/no-extraneous-dependencies
  //     (moment): production code must get `moment` from 'obsidian'
  //     (bundled with the app, no separate copy) -- but the `obsidian` npm
  //     package is types-only (see src/utils/window-moment.ts's doc
  //     comment), so it can't supply a working moment() under vitest.
  //     vault-notes.test.ts stubs `window.moment` with the real npm
  //     `moment` package instead, matching what Obsidian injects at
  //     runtime. Deliberately NOT added to package.json as a real
  //     dependency -- this project's depend/ban-dependencies rule (below,
  //     project-wide) already forbids depending on "moment" directly, for
  //     the same reason -- it's present in node_modules only transitively,
  //     as the `obsidian` types package's own dependency.
  //   - import/no-nodejs-modules / no-undef (__dirname): an Obsidian
  //     plugin can't use Node APIs, which is why the rule exists -- but
  //     tests run under vitest in Node, and one of them
  //     (tests/lang/translation-keys.test.ts) has to read src/ off disk to
  //     scan every t() call site. That check can't be done from inside the
  //     bundle it's checking.
  {
    files: ['tests/**/*.ts'],
    rules: {
      'obsidianmd/no-global-this': 'off',
      'obsidianmd/no-tfile-tfolder-cast': 'off',
      'no-restricted-imports': 'off',
      'import/no-extraneous-dependencies': 'off',
      'import/no-nodejs-modules': 'off',
      // Same rule under its obsidianmd name, added in the plugin's 0.4 line.
      'obsidianmd/no-nodejs-modules': 'off',
      'no-undef': 'off',
    },
  },

  // The recommended config applies some type-aware rules globally (e.g.
  // no-plugin-as-component), which breaks on non-TS files like package.json
  // that have no type info. Turn the type-requiring rules off for those.
  {
    files: ['**/*.json', '**/*.{js,cjs,mjs,jsx}'],
    rules: {
      'obsidianmd/no-plugin-as-component': 'off',
      'obsidianmd/no-view-references-in-plugin': 'off',
      'obsidianmd/no-unsupported-api': 'off',
      'obsidianmd/prefer-file-manager-trash-file': 'off',
      'obsidianmd/prefer-instanceof': 'off',
      // Type-aware TS rule; can't run on plain JS files (no tsconfig project).
      '@typescript-eslint/no-deprecated': 'off',
    },
  },

  // The type-checked rules need type information. The modern project service
  // points the parser at the nearest tsconfig and tolerates stray files.
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Project extras (previously in .eslintrc): auto-remove unused imports/vars.
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { 'unused-imports': unusedImports },
    rules: {
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        { vars: 'all', varsIgnorePattern: '^_', argsIgnorePattern: '^_' },
      ],
      // Defer to the unused-imports plugin to avoid duplicate reports.
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  // The base sentence-case rule (part of the recommended config above)
  // checks .setName()/.setDesc()/etc. string literals project-wide, using
  // its own default brand list -- which doesn't know this plugin's own
  // name, nor the one it was extracted from. Both get added so a legitimate
  // "APERtrail" mention in UI copy isn't reported as bad casing.
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'obsidianmd/ui/sentence-case': [
        'error',
        { enforceCamelCaseLower: true, brands: [...DEFAULT_BRANDS, 'APERtrail'] },
      ],
    },
  },

  // eslint-plugin-obsidianmd 0.4 forbids `eslint-disable` for a list of rules
  // outright, @typescript-eslint/no-deprecated among them. One call site has a
  // reason the rule cannot see: setDestructive() is the non-deprecated spelling
  // of setWarning(), but it exists only from Obsidian 1.13 and this plugin still
  // supports 1.12. The plugin's list is restated here minus that one rule, for
  // that one file, so a disable of it anywhere else still fails. Keep this list
  // in step with the plugin's own when it is upgraded.
  {
    files: ['src/vault/health/entity-type-check-modal.ts'],
    rules: {
      'eslint-comments/no-restricted-disable': [
        'error',
        'obsidianmd/*',
        'no-console',
        'no-restricted-globals',
        '@typescript-eslint/no-restricted-imports',
        'no-alert',
        '@typescript-eslint/no-explicit-any',
        '@microsoft/sdl/no-document-write',
        'no-eval',
        '@microsoft/sdl/no-inner-html',
        'obsidianmd/no-nodejs-modules',
      ],
    },
  },

  // prefer-create-el (new in eslint-plugin-obsidianmd 0.4) reads
  // `activeDocument.createElement()` as an oversight, and everywhere it is one.
  // These three call sites are the exception: createEl() is a method on Node and
  // *appends* what it makes, so it cannot produce the detached element each of
  // them needs -- a scratch canvas that is drawn on and read back as a data URL,
  // and a file input that is clicked without ever entering the document. The
  // rule's suggested `activeWindow.createEl()` does not exist either: obsidian.d.ts
  // puts createEl on Node and on the global scope, not on Window.
  {
    files: [
      'src/places/ui/export-photo-spot.ts',
      'src/trips/ui/export-trip-document.ts',
      'src/ui/components/image-upload.ts',
    ],
    rules: {
      'obsidianmd/prefer-create-el': 'off',
    },
  },

  // Prettier last, so it disables formatting rules that would conflict.
  prettierRecommended,
];
