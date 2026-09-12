/**
 * Owns the one APERtrailSettings object and its persistence.
 *
 * Deliberately thin: `data.json` is the only state APERtrail keeps, and
 * everything in it is either a folder path or a frontmatter property name.
 * Whatever `loadData()` returns goes through `mergeSettings()`, so a
 * missing, partial or hand-edited file always resolves to a fully typed
 * settings object rather than throwing somewhere further up.
 */
import { Plugin } from 'obsidian';
import { setDisplayLocale } from '../shared/display';
import { APERtrailSettings } from './types';
import { mergeSettings } from './validate';

export class APERtrailSettingsStore {
  settings!: APERtrailSettings;

  /** True when this load found no settings at all, so the plugin is starting from its defaults. */
  isFreshInstall = false;

  constructor(private readonly host: Plugin) {}

  async load(): Promise<void> {
    const raw = (await this.host.loadData()) as Record<string, unknown> | null;

    // `raw` is null when data.json does not exist, and `{}` when it exists
    // but is empty -- which is what an interrupted first load leaves
    // behind. Both mean "nothing configured yet".
    this.isFreshInstall = !raw || Object.keys(raw).length === 0;

    this.settings = mergeSettings(raw);
    this.publishDisplayLocale();
  }

  async save(): Promise<void> {
    await this.host.saveData(this.settings);
    this.publishDisplayLocale();
  }

  /**
   * Hands the display locale to `shared/display.ts`, which is what every
   * formatter in the plugin reads.
   *
   * On save as well as on load, because the settings row that changes it has to
   * take effect without a reload -- and because a reader who has just corrected
   * a number's format and sees the old one has been told the setting does
   * nothing.
   */
  private publishDisplayLocale(): void {
    setDisplayLocale(this.settings.displayLocale);
  }
}
