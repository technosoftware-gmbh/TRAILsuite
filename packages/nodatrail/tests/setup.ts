/**
 * Global vitest setup -- initializes I18nManager with English translations
 * loaded before any test file runs, so code under test that calls `t()`
 * (note rendering, the localized folder defaults) gets real translated
 * strings instead of raw i18n keys like "settings.folders.root.name".
 *
 * Production always has I18nManager initialized by main.ts's onload()
 * before any other plugin code runs (see src/main.ts). This mirrors that
 * for tests without needing a real Obsidian `App`/`Plugin` instance --
 * locale auto-detection safely falls back to English when the browser/
 * Obsidian globals it normally reads aren't present, which they aren't in
 * this suite's Node test environment (see I18nManager.detectUserLocale()'s
 * own try/catch, which swallows exactly this case).
 */
import type { Plugin } from 'obsidian';
import { I18nManager } from '../src/lang/I18nManager';

// Only `plugin.app` is ever read (by detectUserLocale(), itself already
// tolerant of a missing/broken app), so a minimal stand-in is enough --
// constructing a real Obsidian Plugin/App has no meaning outside Obsidian.
const fakePlugin = { app: undefined } as unknown as Plugin;

I18nManager.init(fakePlugin);
await I18nManager.getInstance().initialize();
