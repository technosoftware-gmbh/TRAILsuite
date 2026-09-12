/**
 * The Configuration sections: the switches somebody actually comes back for.
 *
 * Three small cards rather than one long one, because these settings have
 * nothing to do with each other beyond being switches: the ribbon icon is
 * about Obsidian's chrome, sun times are about what a photo spot note draws,
 * and the tag filter is about which people a trip will offer you. A card each
 * says that; one card called "Configuration" would not.
 */
import { Notice } from 'obsidian';
import { I18nManager, t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { ClockFormat } from '../../shared/clock';
import { UnitSystem } from '../../shared/units';
import { buttonRow, dropdownRow, sectionCard, textRow, toggleRow } from './rows';

/** What "follow Obsidian" resolves to right now, for switching back to it without a reload. */
function detectedLocale(): string {
  return I18nManager.getInstance().detectedLocale();
}

export function renderSectionConfiguration(
  containerEl: HTMLElement,
  settings: APERtrailSettings,
  save: () => Promise<void>,
  actions: { openDashboard: () => void }
): void {
  const dashboard = sectionCard(containerEl, t('settings.dashboard.title'));

  toggleRow(
    dashboard,
    {
      name: t('settings.dashboard.showRibbonIcon.name'),
      desc: t('settings.dashboard.showRibbonIcon.desc'),
    },
    () => settings.showRibbonIcon,
    async (value) => {
      settings.showRibbonIcon = value;
      await save();
    }
  );

  buttonRow(dashboard, {
    name: t('settings.dashboard.openDashboard.name'),
    desc: t('settings.dashboard.openDashboard.desc'),
    button: t('settings.dashboard.openDashboard.button'),
    onClick: () => actions.openDashboard(),
  });

  // Language, clock and units: three answers to "whose conventions is this
  // written in". They belong together and above everything else here,
  // because the language one decides what the rest of the page reads like.
  const display = sectionCard(containerEl, t('settings.display.title'));

  dropdownRow(
    display,
    { name: t('settings.display.language.name'), desc: t('settings.display.language.desc') },
    [
      ['auto', t('settings.display.language.auto')],
      ...I18nManager.getInstance()
        .getLocales()
        .map((locale): [string, string] => [locale.code, locale.nativeName]),
    ],
    () => settings.language,
    async (value) => {
      settings.language = value;
      await save();
      // Views already on screen were built with the old catalogue and are
      // not rebuilt from here: reaching into every open leaf to redraw it
      // would be a lot of machinery for a setting somebody changes once.
      await I18nManager.getInstance().setLocale(value === 'auto' ? detectedLocale() : value);
      new Notice(t('settings.display.language.applied'));
    }
  );

  dropdownRow(
    display,
    { name: t('settings.display.clockFormat.name'), desc: t('settings.display.clockFormat.desc') },
    [
      ['auto', t('settings.display.clockFormat.auto')],
      ['24h', t('settings.display.clockFormat.h24')],
      ['12h', t('settings.display.clockFormat.h12')],
    ],
    () => settings.clockFormat,
    async (value) => {
      settings.clockFormat = value as ClockFormat;
      await save();
    }
  );

  dropdownRow(
    display,
    { name: t('settings.display.units.name'), desc: t('settings.display.units.desc') },
    [
      ['metric', t('settings.display.units.metric')],
      ['imperial', t('settings.display.units.imperial')],
    ],
    () => settings.units,
    async (value) => {
      settings.units = value as UnitSystem;
      await save();
    }
  );

  const photoSpots = sectionCard(containerEl, t('settings.photoSpots.title'));

  toggleRow(
    photoSpots,
    { name: t('settings.photoSpots.sunTimes.name'), desc: t('settings.photoSpots.sunTimes.desc') },
    () => settings.sunTimesEnabled,
    async (value) => {
      settings.sunTimesEnabled = value;
      await save();
    }
  );

  const money = sectionCard(containerEl, t('settings.money.title'));

  toggleRow(
    money,
    { name: t('settings.money.budget.name'), desc: t('settings.money.budget.desc') },
    () => settings.budgetEnabled,
    async (value) => {
      settings.budgetEnabled = value;
      await save();
    }
  );

  // Separate from the interface language on purpose. Obsidian already knows
  // which language this vault reads; it does not know which country's number
  // and date conventions it writes, and a Swiss household on a German Mac is
  // shown neither of its own.
  textRow(
    money,
    {
      name: t('settings.money.displayLocale.name'),
      desc: t('settings.money.displayLocale.desc'),
      placeholder: 'de-CH',
    },
    () => settings.displayLocale,
    async (value) => {
      settings.displayLocale = value.trim();
      await save();
    }
  );

  // Deliberately a text box rather than a dropdown of every ISO code: the
  // list is 180 long, a vault uses one, and typing three letters is faster
  // than finding them.
  textRow(
    money,
    {
      name: t('settings.money.homeCurrency.name'),
      desc: t('settings.money.homeCurrency.desc'),
      placeholder: 'CHF',
    },
    () => settings.homeCurrency,
    async (value) => {
      settings.homeCurrency = value.toUpperCase();
      await save();
    }
  );

  // The dropdowns' list, as a text row rather than a picker of pickers: it
  // is three codes, typed once, and a row that edited a list would be a
  // bigger control than the thing it configures.
  textRow(
    money,
    {
      name: t('settings.money.currencyOptions.name'),
      desc: t('settings.money.currencyOptions.desc'),
      placeholder: 'CHF, EUR, USD',
    },
    () => settings.currencyOptions,
    async (value) => {
      settings.currencyOptions = value.toUpperCase();
      await save();
    }
  );

  const people = sectionCard(containerEl, t('settings.people.title'), t('settings.people.intro'));

  // Deliberately accepts an empty value where a property row falls back to
  // its previous one: empty means "no tag filter" here, which is a setting
  // somebody meant rather than a mistake to correct.
  textRow(
    people,
    {
      name: t('settings.people.eligiblePersonTags.name'),
      desc: t('settings.people.eligiblePersonTags.desc'),
    },
    () => settings.eligiblePersonTags,
    async (value) => {
      settings.eligiblePersonTags = value;
      await save();
    }
  );
}
