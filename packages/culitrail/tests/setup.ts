/**
 * Global vitest setup: initializes I18nManager with the English table loaded
 * before any test file runs, so code under test that calls `t()` (the
 * localized defaults, note rendering later on) gets real strings rather than
 * raw keys like `settings.folders.defaults.eatingFolderName`.
 *
 * Production always has I18nManager initialized by main.ts's onload() before
 * any other plugin code runs. This mirrors that without needing a real
 * Obsidian App or Plugin: locale auto-detection falls back to English when
 * the globals it normally reads are absent, which they are under Node, and
 * detectUserLocale() already swallows exactly that case.
 */
import type { Plugin } from 'obsidian';
import { I18nManager } from '../src/lang/I18nManager';

// Only `plugin.app` is ever read, by detectUserLocale(), which is itself
// tolerant of a missing or broken app. Constructing a real Obsidian Plugin
// has no meaning outside Obsidian.
const fakePlugin = { app: undefined } as unknown as Plugin;

I18nManager.init(fakePlugin);
await I18nManager.getInstance().initialize();
