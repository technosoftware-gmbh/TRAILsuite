/**
 * The one screen that sets up the balance accounts: what each held on day one,
 * and what the bank calls it.
 *
 * Both belong here for the same reason. Fifty account notes each needing a
 * number typed into frontmatter is fifty notes somebody opens by hand and one
 * they forget, and the forgotten one is either a balance sheet wrong by exactly
 * that amount or a transfer that cannot resolve, with nothing on screen to say
 * so either way.
 *
 * **The date is asked once and written to every account it touches.** An
 * opening balance means nothing without the day it is true as of, and a vault
 * where half the accounts opened on different days has no balance sheet at all.
 */
import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import {
  accountLabel,
  formatDayTitle,
  looksLikeIban,
  type Account,
} from '@technosoftware/trail-core';
import { t } from '../lang/I18nManager';
import type { NODAtrailSettings } from '../settings/types';
import { readAccounts } from './read-ledger';

export interface OpeningDeps {
  app: App;
  getSettings: () => NODAtrailSettings;
  now: () => Date;
  onSaved: () => void;
}

export class AccountSetupModal extends Modal {
  private asOf: string;
  private figures = new Map<number, number>();
  private identities = new Map<number, string>();
  private records: { file: TFile; account: Account }[] = [];

  constructor(private readonly deps: OpeningDeps) {
    super(deps.app);
    // The first of January of the current year, unless the accounts already
    // say otherwise, which `onOpen` checks. Re-opening this screen and saving
    // must not quietly move an opening date somebody chose deliberately.
    this.asOf = `${deps.now().getFullYear()}-01-01`;
  }

  override onOpen(): void {
    this.records = readAccounts(this.deps.app, this.deps.getSettings()).filter(
      (record) => record.account.kind === 'asset' || record.account.kind === 'liability'
    );

    for (const { account } of this.records) {
      if (account.opening !== 0) this.figures.set(account.number, account.opening);
      const identity = account.iban ?? account.bankAccount;
      if (identity) this.identities.set(account.number, identity);
    }

    const stated = this.records.map(({ account }) => account.openingDate).find(Boolean);
    if (stated) this.asOf = stated;

    this.render();
  }

  override onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: t('ledger.accountSetup') });

    if (this.records.length === 0) {
      contentEl.createEl('p', { text: t('ledger.noAccounts') });
      return;
    }

    contentEl.createEl('p', { cls: 'nod-import-note', text: t('ledger.accountSetupDesc') });

    new Setting(contentEl).setName(t('ledger.asOf')).addText((input) => {
      input.setPlaceholder(formatDayTitle(this.deps.now())).setValue(this.asOf);
      input.onChange((value) => {
        this.asOf = value.trim();
      });
    });

    for (const record of this.records) {
      const { account } = record;
      new Setting(contentEl)
        .setName(accountLabel(account))
        .setDesc(account.currency ?? '')
        .addText((input) => {
          const current = this.figures.get(account.number);
          input
            .setPlaceholder(t('ledger.opening'))
            .setValue(current === undefined ? '' : String(current));
          input.onChange((value) => {
            const trimmed = value.trim().replace(/'/g, '').replace(',', '.');
            // Blank clears rather than reading as zero: an account nobody has
            // filled in and an account that genuinely holds nothing are
            // different facts, and only one of them should be written.
            if (trimmed === '') this.figures.delete(account.number);
            else if (!Number.isNaN(Number(trimmed)))
              this.figures.set(account.number, Number(trimmed));
          });
        })
        .addText((input) => {
          input
            .setPlaceholder(t('ledger.ibanOrNumber'))
            .setValue(this.identities.get(account.number) ?? '');
          input.onChange((value) => {
            this.identities.set(account.number, value.trim());
          });
        });
    }

    new Setting(contentEl).addButton((button) => {
      button
        .setButtonText(t('common.save'))
        .setCta()
        .onClick(() => {
          void this.save();
        });
    });
  }

  private async save(): Promise<void> {
    const settings = this.deps.getSettings();
    let written = 0;

    for (const record of this.records) {
      const figure = this.figures.get(record.account.number);
      const identity = (this.identities.get(record.account.number) ?? '').trim();
      const hadIdentity = record.account.iban ?? record.account.bankAccount;
      if (figure === undefined && !identity && !hadIdentity) continue;

      await this.deps.app.fileManager.processFrontMatter(
        record.file,
        (frontmatter: Record<string, unknown>) => {
          if (figure !== undefined) {
            frontmatter[settings.accountOpeningProperty] = figure;
            frontmatter[settings.accountOpeningDateProperty] = this.asOf;
          }

          // Both are cleared before one is set, so changing an account from a
          // printed number to an IBAN does not leave the old one behind for the
          // reader to find first.
          delete frontmatter[settings.accountIbanProperty];
          delete frontmatter[settings.accountBankNumberProperty];
          if (identity) {
            const key = looksLikeIban(identity)
              ? settings.accountIbanProperty
              : settings.accountBankNumberProperty;
            frontmatter[key] = identity;
          }
        }
      );
      written += 1;
    }

    new Notice(t('ledger.openingSaved', { count: String(written) }));
    this.deps.onSaved();
    this.close();
  }
}
