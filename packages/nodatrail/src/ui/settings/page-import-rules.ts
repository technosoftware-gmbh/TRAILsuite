/**
 * The rules that say which account a statement line belongs to.
 *
 * Almost every rule here is written by the import itself, as accounts are
 * assigned to rows nothing matched. This page exists for the other direction: a
 * rule that has started catching the wrong lines has to be removable, and a
 * rule somebody wants before the first import has to be addable.
 *
 * **Longest match wins**, so a rule for a specific subsidiary beats a general
 * one for the group whatever order they were written in. That is decided in
 * `trail-core`; this page only has to show them.
 */
import { Setting } from 'obsidian';
import { t } from '../../lang/I18nManager';
import type { ImportRuleSetting, NODAtrailSettings } from '../../settings/types';
import { sectionCard, noteLine } from './rows';

export interface ImportRulesPageDeps {
  settings: NODAtrailSettings;
  save: () => Promise<void>;
  refresh: () => void;
}

export function renderImportRulesPage(containerEl: HTMLElement, deps: ImportRulesPageDeps): void {
  const { settings, save, refresh } = deps;
  const card = sectionCard(containerEl, t('settings.importRules.heading'));
  noteLine(card, t('settings.importRules.description'));

  const sorted = [...settings.importRules].sort((a, b) => a.account - b.account);
  for (const rule of sorted) {
    new Setting(card)
      .setName(rule.match)
      .setDesc(String(rule.account))
      .addExtraButton((button) => {
        button
          .setIcon('trash')
          .setTooltip(t('common.remove'))
          .onClick(() => {
            settings.importRules = settings.importRules.filter((candidate) => candidate !== rule);
            void save().then(refresh);
          });
      });
  }

  if (sorted.length === 0) noteLine(card, t('settings.importRules.none'));

  let match = '';
  let account = '';
  new Setting(card)
    .setName(t('settings.importRules.add'))
    .addText((input) => {
      input.setPlaceholder(t('settings.importRules.match')).onChange((value) => {
        match = value;
      });
    })
    .addText((input) => {
      input.setPlaceholder(t('ledger.number')).onChange((value) => {
        account = value;
      });
    })
    .addButton((button) => {
      button.setButtonText(t('common.add')).onClick(() => {
        const number = Number(account.trim());
        // Both halves or nothing: a rule with no account matches lines and then
        // has nowhere to put them.
        if (!match.trim() || !Number.isFinite(number) || number <= 0) return;
        const rule: ImportRuleSetting = { match: match.trim(), account: number };
        settings.importRules = [...settings.importRules, rule];
        void save().then(refresh);
      });
    });
}
