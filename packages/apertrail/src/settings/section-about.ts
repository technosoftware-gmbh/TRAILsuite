/**
 * The About section -- what the plugin is, where it lives, and which version
 * of it you are looking at.
 *
 * Everything it shows about itself is read off the host Plugin's manifest
 * rather than repeated in source, so a release bump has exactly one place to
 * change. It is last on the page because it is credits: true when you look
 * for it, and in the way anywhere higher up.
 */
import { Plugin } from 'obsidian';
import { t } from '../lang/I18nManager';
import { LINKS } from './links';
import { sectionCard } from '../ui/settings/rows';

/** The licence this package ships under, as `package.json` spells it. */
const LICENCE = 'PolyForm Noncommercial License 1.0.0';

export function renderSectionAbout(host: Plugin, containerEl: HTMLElement): void {
  const card = sectionCard(containerEl, t('settings.about.title'));

  const about = card.createDiv({ cls: 'apt-settings-about' });
  about.createEl('p', { text: t('settings.about.description') });
  about.createEl('p', { text: t('settings.about.origins.text') });

  const links = about.createEl('ul', { cls: 'apt-settings-about-links' });
  const github = links.createEl('li');
  github.createEl('a', {
    text: t('settings.about.links.github'),
    attr: { href: LINKS.plugin, target: '_blank', rel: 'noopener' },
  });
  const vendor = links.createEl('li');
  vendor.createEl('a', {
    text: t('settings.about.links.vendor'),
    attr: { href: LINKS.vendor, target: '_blank', rel: 'noopener' },
  });

  const info = about.createDiv({ cls: 'apt-settings-note' });
  info.createDiv({
    text: t('settings.about.pluginInfo.version', { version: host.manifest.version }),
  });
  info.createDiv({ text: t('settings.about.pluginInfo.author', { author: host.manifest.author }) });
  info.createDiv({ text: t('settings.about.pluginInfo.licence', { licence: LICENCE }) });
}
