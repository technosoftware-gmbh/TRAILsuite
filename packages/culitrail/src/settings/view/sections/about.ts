/**
 * About: credits, licence and version.
 *
 * Everything here is read live from `manifest.json` rather than copied into a
 * string, so a released version and the version this page claims cannot drift
 * apart.
 *
 * The Recipe Box credit is not decoration. CULItrail is GPL-3.0-or-later
 * because it descends from that project, and `NOTICE.md` carries the
 * attribution; repeating it where a user can actually see it is part of
 * honouring the licence rather than merely complying with it.
 */
import { Plugin } from 'obsidian';
import { t } from '../../../lang/I18nManager';
import { LINKS } from '../../links';
import { sectionCard } from '../rows';

export function renderAboutSection(container: HTMLElement, manifest: Plugin['manifest']): void {
  const card = sectionCard(container, t('settings.about.title'));

  const info = card.createDiv({ cls: 'culi-settings-about' });
  info.createDiv({ text: `${manifest.name} ${manifest.version}` });
  if (manifest.description) info.createDiv({ text: manifest.description });
  if (manifest.author) info.createDiv({ cls: 'culi-settings-note', text: manifest.author });

  const vendor = card.createDiv({ cls: 'culi-settings-about' });
  vendor.createDiv({ text: t('settings.about.vendor') });
  const vendorLink = vendor.createEl('a', {
    text: t('settings.about.vendorLink'),
    href: LINKS.vendor,
  });
  vendorLink.setAttr('target', '_blank');
  vendorLink.setAttr('rel', 'noopener');

  const credits = card.createDiv({ cls: 'culi-settings-about' });
  credits.createDiv({ text: t('settings.about.credits') });
  credits.createDiv({ text: t('settings.about.mealBox') });
  const link = credits.createEl('a', {
    text: t('settings.about.originalProject'),
    href: LINKS.recipeBox,
  });
  link.setAttr('target', '_blank');
  link.setAttr('rel', 'noopener');

  credits.createDiv({ cls: 'culi-settings-note', text: t('settings.about.licence') });
}
