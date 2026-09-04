/**
 * Owns the one CULItrailSettings object and its persistence.
 *
 * Deliberately thin: whatever `loadData()` returns goes straight through
 * `mergeSettings()`, so a missing, partial or hand-edited file always
 * resolves to a fully typed settings object rather than throwing somewhere
 * further up.
 *
 * The one piece of behaviour beyond load and save is the fresh-install path:
 * a vault with no `data.json` of ours may still have a sibling plugin whose
 * CRM settings are worth adopting, so the two plugins do not have to be
 * configured separately. See foreign-settings-import.ts.
 */
import { Plugin } from 'obsidian';
import { CULItrailSettings } from './types';
import { setDisplayLocale } from '../shared/display';
import { mergeSettings } from './validate';
import { importForeignCrmSettings, ForeignImportResult } from './foreign-settings-import';

export class CULItrailSettingsStore {
  settings!: CULItrailSettings;

  /** True when this load found no settings at all, so the plugin is starting from its defaults. */
  isFreshInstall = false;

  /**
   * What the fresh-install import found, or null when it did not run or
   * found nothing.
   *
   * Kept rather than discarded because the Orders & CRM settings tab shows it
   * as a status row. A vault that ends up with zero matching people has no
   * other way to tell whether the folder is wrong, the type value is, or the
   * values came from somewhere it did not expect.
   */
  foreignImport: ForeignImportResult | null = null;

  constructor(private readonly host: Plugin) {}

  async load(): Promise<void> {
    const raw = (await this.host.loadData()) as Record<string, unknown> | null;

    // `raw` is null when data.json does not exist, and `{}` when it exists but
    // is empty, which is what an interrupted first load leaves behind. Both
    // mean "nothing configured yet".
    this.isFreshInstall = !raw || Object.keys(raw).length === 0;

    if (this.isFreshInstall) {
      this.foreignImport = await importForeignCrmSettings(this.host.app);
      this.settings = mergeSettings(this.foreignImport?.settings ?? raw);
      // Persist immediately, so the adopted values survive even if the user
      // never opens the settings tab, and so the next load is an ordinary one
      // rather than a second import against a vault that has since changed.
      if (this.foreignImport) await this.save();
      this.applyDisplay();
      return;
    }

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
   * On save as well as on load, so the row that changes the convention takes
   * effect without a reload. A reader who has just corrected a number's format
   * and still sees the old one has been told the setting does nothing.
   */
  private applyDisplay(): void {
    setDisplayLocale(this.settings.displayLocale);
  }
}
