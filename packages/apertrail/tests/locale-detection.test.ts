/**
 * Which language the plugin follows when the setting says `auto`.
 *
 * **This is the test the defect needed.** `I18nManager`'s header has always
 * promised that the locale follows Obsidian, "because a vault owner who has
 * already told Obsidian which language they read should not have to say it
 * twice". The detection did not ask Obsidian. It asked moment, the document,
 * and `navigator.language`, every one of which reports the operating system.
 *
 * On a Swiss machine running Obsidian in English, that answered German. The
 * consequence was not a mistranslated label: the folder defaults are localized,
 * so a vault got German folders invented for it beside the English ones it
 * already had, and `preferExisting` kept both. Folder names are written into
 * somebody's vault and nothing renames them afterwards.
 *
 * `getLanguage()` is Obsidian's own answer and has been since 1.8.7, against a
 * manifest floor of 1.12.0.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App, Plugin } from 'obsidian';

vi.mock('obsidian', () => ({
  getLanguage: (): string => globalThis.__obsidianLanguage ?? '',
  Plugin: class {},
  TFile: class {},
}));

declare global {
  var __obsidianLanguage: string | undefined;
}

/** A plugin host with nothing on it but the app the manager reads. */
function hostWith(): Plugin {
  return { app: {} as App } as Plugin;
}

/**
 * A manager built after the mock is in place.
 *
 * `tests/setup.ts` imports `I18nManager` before this file's `vi.mock` exists,
 * so a top-level import here would get the copy already bound to the unmocked
 * `obsidian` stub and `getLanguage()` would never be the mocked one. Resetting
 * the registry and importing inside the test is what puts the mock in the
 * module graph the manager actually uses.
 */
async function freshManager(): Promise<typeof import('../src/lang/I18nManager').I18nManager> {
  vi.resetModules();
  return (await import('../src/lang/I18nManager')).I18nManager;
}

/**
 * The operating system, saying German as loudly as it can.
 *
 * Every one of these is a signal the detection consulted before this fix, and
 * the point of setting all of them is that Obsidian's answer has to win
 * against the lot rather than against a single one.
 */
function makeTheMachineGerman(): void {
  (globalThis as { moment?: unknown }).moment = { locale: () => 'de-CH' };
  vi.stubGlobal('navigator', { language: 'de-CH', languages: ['de-CH', 'de'] });
  vi.stubGlobal('activeDocument', { documentElement: { lang: 'de' } });
}

describe('the locale the plugin follows', () => {
  beforeEach(() => {
    // `tests/setup.ts` builds the singleton and initializes it to English
    // before every test file, and `init()` returns an existing instance rather
    // than replacing it. Without this the first test here reads setup's
    // English answer and passes whatever the detection does, which is exactly
    // how it passed with the fix removed the first time it was checked.
    makeTheMachineGerman();
  });

  afterEach(() => {
    delete (globalThis as { moment?: unknown }).moment;
    globalThis.__obsidianLanguage = undefined;
    vi.unstubAllGlobals();
  });

  it('follows Obsidian rather than the machine', async () => {
    globalThis.__obsidianLanguage = 'en';
    const I18nManager = await freshManager();
    I18nManager.init(hostWith());
    await I18nManager.getInstance().initialize('auto');

    expect(I18nManager.getInstance().getCurrentLocale()).toBe('en');
  });

  it('follows Obsidian when Obsidian is the German one', async () => {
    // The mirror image, so a fix that simply hardcoded English would fail here.
    globalThis.__obsidianLanguage = 'de';
    vi.stubGlobal('navigator', { language: 'en-GB', languages: ['en-GB'] });
    (globalThis as { moment?: unknown }).moment = { locale: () => 'en-GB' };
    const I18nManager = await freshManager();
    I18nManager.init(hostWith());
    await I18nManager.getInstance().initialize('auto');

    expect(I18nManager.getInstance().getCurrentLocale()).toBe('de');
  });

  it('falls back to the machine when Obsidian answers nothing', async () => {
    // `getLanguage()` defaults to 'en' in Obsidian, so an empty answer means a
    // build that does not have it. The old chain is still there underneath.
    globalThis.__obsidianLanguage = '';
    const I18nManager = await freshManager();
    I18nManager.init(hostWith());
    await I18nManager.getInstance().initialize('auto');

    expect(I18nManager.getInstance().getCurrentLocale()).toBe('de');
  });

  it('lets an explicit setting override Obsidian', async () => {
    // `auto` means follow; anything else is the vault owner saying it twice on
    // purpose, and that has to keep working.
    globalThis.__obsidianLanguage = 'de';
    const I18nManager = await freshManager();
    I18nManager.init(hostWith());
    await I18nManager.getInstance().initialize('en');

    expect(I18nManager.getInstance().getCurrentLocale()).toBe('en');
  });
});
