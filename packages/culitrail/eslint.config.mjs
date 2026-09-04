// Flat ESLint config (ESLint 9+).
// Runs the official Obsidian rules (eslint-plugin-obsidianmd, recommended)
// alongside the project's unused-imports and Prettier setup.
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
      // esbuild.config.mjs, vitest.config.mts, this file, and anything else
      // that configures a tool rather than being plugin source. The vitest config
      // is `.mts` because it is ESM and this package is not: see
      // docs/design/testing-and-development.md.
      '**/*.config.{js,mjs,cjs,mts}',
      'version-bump.mjs',
      'sync-version.js',
      // Non-source JSON (only package.json is meant to be linted, by the
      // obsidianmd manifest/license rules). The rest are data/config files.
      'data.json',
      'manifest.json',
      'versions.json',
      'package-lock.json',
      'tsconfig*.json',
      '**/tsconfig*.json', // also covers tests/tsconfig.json
      // Third-party code, kept as a verbatim copy so it can be re-synced
      // against upstream without re-applying local edits. It is formatted to
      // its own conventions; linting it would mean either 1,300 findings or
      // reformatting a file we do not own. Its adapter,
      // importer/site-scrapers.ts, is ours and is linted normally.
      'src/recipes/importer/vendor/**',
      // A scratch area. The Cowork mount this repo is edited through forbids
      // `unlink`, so nothing can be deleted from the sandbox: throwaway files are
      // renamed into here for the user to remove on the Mac. Three separate lint
      // runs have failed on my own discarded files sitting in it, which is a
      // pointless way to break the build gate.
      '_to_delete/**',
    ],
  },

  // Official Obsidian recommended ruleset. Includes the typescript-eslint
  // type-checked rules and @typescript-eslint/no-deprecated.
  ...obsidianmd.configs.recommended,

  // tests/** runs under Vitest's "node" environment, not inside a real
  // Obsidian window, so rules that assume live Obsidian runtime globals or a
  // real Vault do not apply there.
  //   - no-global-this once auto-fixed a legitimate `globalThis` reference
  //     (used to stub the missing `window` global under Node) into a broken
  //     self-reference. Turned off here rather than just reverted, so
  //     `eslint --fix` cannot silently reintroduce it.
  //   - no-tfile-tfolder-cast wants `instanceof TFile` checks instead of
  //     casts, which is right for production code handling a real, unknown
  //     file-like object. Unit tests have no live Vault to get a real TFile
  //     from, so building a minimal fake object via a cast is the only way
  //     to test pure functions that read a couple of TFile's fields.
  //   - no-restricted-imports / import/no-extraneous-dependencies (moment):
  //     production code must get `moment` from 'obsidian' (bundled with the
  //     app, no separate copy), but the `obsidian` npm package is types-only
  //     and cannot supply a working moment() under vitest. Tests stub
  //     `window.moment` with the real npm `moment` package instead, matching
  //     what Obsidian injects at runtime. Deliberately NOT added to
  //     package.json as a real dependency: it is present in node_modules only
  //     transitively, as the `obsidian` types package's own dependency.
  //   - import/no-nodejs-modules / no-undef (__dirname): an Obsidian plugin
  //     cannot use Node APIs, which is why the rule exists. Tests run under
  //     vitest in Node, and the translation-key test has to read src/ off
  //     disk to scan every t() call site. That check cannot be done from
  //     inside the bundle it is checking.
  //   - prefer-window-timers wants window.setTimeout for popout-window
  //     affinity, which is right inside Obsidian and impossible under Node,
  //     where there is no window to be affine to. Production code routes
  //     timers through shared/timers.ts for exactly this reason; a test
  //     waiting out a delay has no such indirection to reach for.
  {
    files: ['tests/**/*.ts'],
    rules: {
      'obsidianmd/no-global-this': 'off',
      'obsidianmd/no-tfile-tfolder-cast': 'off',
      'obsidianmd/prefer-window-timers': 'off',
      'no-restricted-imports': 'off',
      'import/no-extraneous-dependencies': 'off',
      'import/no-nodejs-modules': 'off',
      // Same rule under its obsidianmd name, added in the plugin's 0.4 line.
      'obsidianmd/no-nodejs-modules': 'off',
      'no-undef': 'off',
    },
  },

  // scripts/** are one-off command-line tools run with `npx tsx`, not plugin
  // code. They read and write a vault through Node's own filesystem, print to
  // stdout and set an exit status, so the rules that exist to keep an Obsidian
  // plugin well-behaved inside the app do not apply to them. They are linted
  // and typechecked otherwise, because their whole value is that they import
  // the plugin's real readers rather than reimplementing them.
  {
    files: ['scripts/**/*.ts'],
    rules: {
      'import/no-nodejs-modules': 'off',
      // Same rule under its obsidianmd name, added in the plugin's 0.4 line.
      'obsidianmd/no-nodejs-modules': 'off',
      'import/no-extraneous-dependencies': 'off',
      'obsidianmd/rule-custom-message': 'off',
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
      // Type-aware TS rule; cannot run on plain JS files (no tsconfig project).
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

  // Auto-remove unused imports and vars.
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

  // The base sentence-case rule (part of the recommended config above) checks
  // .setName()/.setDesc() string literals project-wide against its own brand
  // list, which does not include "CULItrail". Nearly every UI string here goes
  // through t(), but the brand still appears in About-tab copy and in a few
  // settings descriptions, so the addition is applied project-wide rather
  // than per file.
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'obsidianmd/ui/sentence-case': [
        'error',
        { enforceCamelCaseLower: true, brands: [...DEFAULT_BRANDS, 'CULItrail'] },
      ],
    },
  },

  // eslint-plugin-obsidianmd 0.4 forbids `eslint-disable` for a list of rules
  // outright, and `obsidianmd/*` covers prefer-window-timers. These two modules
  // exist precisely to hold the one fallback the rule cannot allow for: `window`
  // does not exist under Node, so a module calling window.setTimeout() directly
  // is untestable, and the fallback is confined to here. The plugin's list is
  // restated with that single rule negated, for those two files only, so a
  // disable of it anywhere else still fails. Keep this list in step with the
  // plugin's own when it is upgraded.
  {
    files: ['src/shared/timers.ts', 'src/shared/debounce.ts'],
    rules: {
      'eslint-comments/no-restricted-disable': [
        'error',
        'obsidianmd/*',
        'no-console',
        'no-restricted-globals',
        '@typescript-eslint/no-restricted-imports',
        'no-alert',
        '@typescript-eslint/no-deprecated',
        '@typescript-eslint/no-explicit-any',
        '@microsoft/sdl/no-document-write',
        'no-eval',
        '@microsoft/sdl/no-inner-html',
        'obsidianmd/no-nodejs-modules',
        '!obsidianmd/prefer-window-timers',
      ],
    },
  },

  // Prettier last, so it disables formatting rules that would conflict.
  prettierRecommended,
];
