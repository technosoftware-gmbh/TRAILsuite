/**
 * Creating the chart of accounts, once.
 *
 * **It never overwrites and never renumbers.** An account whose number is
 * already in the vault is skipped, so running the seed twice adds nothing and
 * running it after somebody has renamed half the chart adds only what is
 * genuinely missing. A seeder that "brought the chart up to date" would be a
 * seeder that undid somebody's naming.
 */
import { App, Notice } from 'obsidian';
import { t } from '../lang/I18nManager';
import { seedChart, type ChartNames } from '../finance/default-chart';
import type { NODAtrailSettings } from '../settings/types';
import { FormModal } from '../ui/modals/form-modal';
import { readAccounts } from './read-ledger';
import { createAccount } from './write-ledger';

export interface SeedResult {
  created: number;
  skipped: number;
}

export async function seedChartOfAccounts(
  app: App,
  settings: NODAtrailSettings,
  names: Partial<ChartNames>,
  language: 'de' | 'en',
  now: Date
): Promise<SeedResult> {
  const taken = new Set(readAccounts(app, settings).map((record) => record.account.number));

  let created = 0;
  let skipped = 0;
  for (const account of seedChart(language, { homeCurrency: settings.homeCurrency, ...names })) {
    if (taken.has(account.number)) {
      skipped += 1;
      continue;
    }
    await createAccount(app, settings, account, now);
    created += 1;
  }

  return { created, skipped };
}

export interface SeedDeps {
  app: App;
  getSettings: () => NODAtrailSettings;
  language: () => 'de' | 'en';
  now: () => Date;
  onSeeded: () => void;
}

/** Asks who lives here and what they drive, then writes the chart. */
export class SeedChartModal extends FormModal {
  private personOne = '';
  private personTwo = '';
  private vehicleOne = '';
  private vehicleTwo = '';

  constructor(private readonly deps: SeedDeps) {
    super(deps.app);
  }

  protected heading(): string {
    return t('ledger.seedChart');
  }

  protected fields(container: HTMLElement): void {
    const fields: [string, () => string, (value: string) => void][] = [
      [`${t('ledger.account')} 1`, () => this.personOne, (value) => (this.personOne = value)],
      [`${t('ledger.account')} 2`, () => this.personTwo, (value) => (this.personTwo = value)],
      [`${t('ledger.vehicle')} 1`, () => this.vehicleOne, (value) => (this.vehicleOne = value)],
      [`${t('ledger.vehicle')} 2`, () => this.vehicleTwo, (value) => (this.vehicleTwo = value)],
    ];
    for (const [name, get, set] of fields) this.text(container, name, get, set);
    // Left blank on purpose is a working chart, not a broken one: the generic
    // names are what a household that does not want the accounts named after
    // people gets.
    //
    // Free text rather than the person picker the new-account modal now offers,
    // and deliberately so. These are `{person1}`/`{person2}` tokens that name
    // accounts and groups as well as deciding which entries get a `person:`
    // link, so seeding with a generic name, or with a name that has no Person
    // note behind it, has to stay possible. Two jobs that happen to share a
    // string; only the second one is a CRM link.
  }

  protected async submit(): Promise<void> {
    const result = await seedChartOfAccounts(
      this.deps.app,
      this.deps.getSettings(),
      {
        personOne: this.personOne,
        personTwo: this.personTwo,
        vehicleOne: this.vehicleOne,
        vehicleTwo: this.vehicleTwo,
      },
      this.deps.language(),
      this.deps.now()
    );

    new Notice(t('ledger.seeded', { created: result.created, skipped: result.skipped }));
    this.deps.onSeeded();
  }
}
