/**
 * The block above the settings themselves: which version this is, where the
 * release notes are, and how to support or reach the people who wrote it.
 *
 * It sits at the top because it is the only part of the page that is about the
 * plugin rather than about a vault, and because "what changed in the version I
 * just updated to" is asked exactly once per update, at the moment the settings
 * page is opened.
 */
import { App, Plugin, Setting } from 'obsidian';
import { t } from '../../../lang/I18nManager';
import { LINKS } from '../../links';
import { linkRow, sectionCard } from '../rows';
import { WhatsNewModal } from '../whats-new-modal';

export function renderHeaderSection(
  container: HTMLElement,
  app: App,
  manifest: Plugin['manifest']
): void {
  const card = sectionCard(container);

  new Setting(card)
    .setName(t('settings.header.whatsNew.name', { version: manifest.version }))
    .setDesc(t('settings.header.whatsNew.desc'))
    .addButton((button) =>
      button
        .setButtonText(t('settings.header.whatsNew.button'))
        .onClick(() => new WhatsNewModal(app, manifest.version).open())
    );

  linkRow(
    card,
    { name: t('settings.header.support.name'), desc: t('settings.header.support.desc') },
    [
      { label: t('settings.header.support.sponsor'), href: LINKS.sponsor, icon: 'heart' },
      { label: t('settings.header.support.coffee'), href: LINKS.coffee, icon: 'coffee' },
    ]
  );

  linkRow(card, { name: t('settings.header.help.name'), desc: t('settings.header.help.desc') }, [
    { label: t('settings.header.help.docs'), href: LINKS.docs, icon: 'book-open' },
    { label: t('settings.header.help.issues'), href: LINKS.issues, icon: 'bug' },
    { label: t('settings.header.help.contact'), href: LINKS.support, icon: 'mail' },
  ]);
}
