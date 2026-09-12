/**
 * One account note, made by hand.
 *
 * The seed writes a whole chart and refuses to touch a number that already
 * exists, which is right for setting up and useless for the account you decide
 * you need in March. This is that account.
 *
 * **The number decides the kind**, unless the person says otherwise. A number
 * in the liability band is a liability, and asking somebody who has just typed
 * 2040 whether it is an asset would be asking them to repeat themselves.
 */
import { Notice } from 'obsidian';
import { kindForNumber, type AccountKind } from '@technosoftware/trail-core';
import { eligiblePersonTitles } from '../crm/read-persons';
import { t } from '../lang/I18nManager';
import { FormModal } from '../ui/modals/form-modal';
import type { CreateDeps } from '../ui/modals/new-para-modals';
import { readAccounts } from './read-ledger';
import { createAccount } from './write-ledger';

export class NewAccountModal extends FormModal {
  private accountNumber = '';
  private title = '';
  private kind: AccountKind | '' = '';
  private group = '';
  private person = '';
  private currency: string;
  private identity = '';

  constructor(private readonly deps: CreateDeps) {
    super(deps.app);
    this.currency = deps.getSettings().homeCurrency;
  }

  protected heading(): string {
    return t('ledger.newAccount');
  }

  protected override blocker(): string | null {
    if (this.parsedNumber() === null) return t('ledger.needsNumber');
    return this.title.trim() === '' ? t('common.needsTitle') : null;
  }

  private parsedNumber(): number | null {
    const value = Number(this.accountNumber.trim());
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  protected fields(container: HTMLElement): void {
    this.text(
      container,
      t('ledger.number'),
      () => this.accountNumber,
      (value) => {
        this.accountNumber = value;
      }
    );
    this.text(
      container,
      t('common.name'),
      () => this.title,
      (value) => {
        this.title = value;
      }
    );
    this.select(
      container,
      t('ledger.kind'),
      [
        ['', t('ledger.kindFromNumber')],
        ['asset', t('ledger.kindAsset')],
        ['liability', t('ledger.kindLiability')],
        ['income', t('ledger.kindIncome')],
        ['expense', t('ledger.kindExpense')],
      ],
      () => this.kind,
      (value) => {
        this.kind = value as AccountKind | '';
      }
    );
    this.text(
      container,
      t('ledger.group'),
      () => this.group,
      (value) => {
        this.group = value;
      }
    );
    // Read when the form opens rather than held: a person added a minute ago
    // belongs in this list, and nothing else in the plugin caches either.
    this.select(
      container,
      t('ledger.person'),
      [
        ['', t('ledger.accountPersonShared')],
        ...eligiblePersonTitles(this.deps.app, this.deps.getSettings()).map(
          (title): [string, string] => [title, title]
        ),
      ],
      () => this.person,
      (value) => {
        this.person = value;
      }
    );
    this.text(
      container,
      t('finance.currency'),
      () => this.currency,
      (value) => {
        this.currency = value;
      }
    );
    this.text(
      container,
      t('ledger.ibanOrNumber'),
      () => this.identity,
      (value) => {
        this.identity = value;
      }
    );
  }

  protected async submit(): Promise<void> {
    const number = this.parsedNumber();
    if (number === null) return;

    const settings = this.deps.getSettings();
    // Refused rather than merged: two notes claiming one number is the one
    // thing that makes every posting to it ambiguous.
    const taken = readAccounts(this.deps.app, settings).some(
      (record) => record.account.number === number
    );
    if (taken) throw new Error(t('ledger.numberTaken', { number: String(number) }));

    const file = await createAccount(
      this.deps.app,
      settings,
      {
        number,
        kind: this.kind || (kindForNumber(number) ?? 'expense'),
        group: this.group.trim(),
        title: this.title.trim(),
        currency: this.currency.trim(),
        person: this.person.trim() || null,
        identity: this.identity.trim() || null,
      },
      this.deps.now()
    );

    new Notice(t('notices.noteCreated', { title: file.basename }));
    this.deps.onCreated(file);
  }
}
