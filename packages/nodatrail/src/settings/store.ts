/**
 * Owns the one NODAtrailSettings object and its persistence.
 *
 * Deliberately thin: `data.json` is the only state NODAtrail keeps, and
 * everything in it is a folder path, a path template, a frontmatter property
 * name or a display preference. Whatever `loadData()` returns goes through
 * `mergeSettings()`, so a missing, partial or hand-edited file always resolves
 * to a fully typed object rather than throwing further up.
 */
import { Plugin } from 'obsidian';
import { NODAtrailSettings } from './types';
import { mergeSettings } from './validate';
import { setDisplayLocale } from '../ui/kit/format';

export class NODAtrailSettingsStore {
  settings!: NODAtrailSettings;

  /** True when this load found nothing at all, so the plugin is starting from its defaults. */
  isFreshInstall = false;

  constructor(private readonly host: Plugin) {}

  async load(): Promise<void> {
    const raw = (await this.host.loadData()) as Record<string, unknown> | null;

    // `raw` is null when data.json does not exist and `{}` when it exists but
    // is empty, which is what an interrupted first load leaves behind. Both
    // mean "nothing configured yet".
    this.isFreshInstall = !raw || Object.keys(raw).length === 0;
    this.settings = mergeSettings(raw);
    this.applyDisplay();
  }

  async save(): Promise<void> {
    await this.host.saveData(this.settings);
    this.applyDisplay();
  }

  /**
   * Pushes the settings that only affect drawing into the places that draw.
   *
   * Called from both load and save rather than from the settings page, so a
   * setting cannot be changed by some other route and left unapplied until the
   * next restart.
   */
  private applyDisplay(): void {
    setDisplayLocale(this.settings.displayLocale);
  }
}
