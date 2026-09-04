/**
 * What an order note is worth, and who it can be shared with.
 *
 * Every property name an order, a delivery or a company note is read by is on
 * the property-keys page. The three rows left here are the ones that are not
 * names at all: a currency, a legacy prefix a vault may still carry, and the
 * tag filter that decides which people an order will offer.
 */
import { t } from '../../../lang/I18nManager';
import { sectionCard, textRow } from '../rows';
import type { SettingsTabContext } from '../settings-tab';

export function renderOrdersSection(container: HTMLElement, context: SettingsTabContext): void {
  const { settings } = context;

  const orders = sectionCard(
    container,
    t('settings.orders.orderNote'),
    t('settings.orders.orderNoteNote')
  );

  textRow(
    orders,
    context,
    { name: t('settings.orders.defaultCurrency'), desc: t('settings.orders.defaultCurrencyDesc') },
    () => settings.orderDefaultCurrency,
    (value) => (settings.orderDefaultCurrency = value)
  );
  // Beside the currency because it is the other half of the same question: the
  // code a figure carries, and the convention it is written in. Separate from
  // the interface language, which Obsidian already knows and which says nothing
  // about where the reader is.
  textRow(
    orders,
    context,
    { name: t('settings.display.displayLocale'), desc: t('settings.display.displayLocaleDesc') },
    () => settings.displayLocale,
    (value) => (settings.displayLocale = value.trim())
  );
  textRow(
    orders,
    context,
    { name: t('settings.orders.legacyPrefix'), desc: t('settings.orders.legacyPrefixDesc') },
    () => settings.orderSelectionPropertyPrefix,
    (value) => (settings.orderSelectionPropertyPrefix = value)
  );

  const people = sectionCard(container, t('settings.people.title'), t('settings.people.intro'));

  // Deliberately accepts an empty value where a property row falls back to its
  // previous one: empty means "no tag filter" here, which is a setting somebody
  // meant rather than a mistake to correct.
  textRow(
    people,
    context,
    {
      name: t('settings.orders.eligiblePersonTags'),
      desc: t('settings.orders.eligiblePersonTagsDesc'),
    },
    () => settings.eligiblePersonTags,
    (value) => (settings.eligiblePersonTags = value)
  );
}
