/**
 * The posting form, over a posting that already exists.
 *
 * Every ledger acquires wrong lines: a figure keyed from the wrong column, an
 * account picked one row off, the same entry made twice. Until now the only
 * remedy was to open the journal note and edit the pipes by hand, which is
 * exactly the kind of editing this plugin exists to avoid.
 *
 * **Delete is offered beside save**, because the two mistakes are different.
 * A wrong figure is corrected; an entry that should never have existed is
 * removed, and correcting it to something harmless would leave a line nobody
 * can explain.
 *
 * Deleting asks first. It is the only destructive thing in NODAtrail, and a
 * posting removed by a misclick is work somebody has to notice is gone before
 * they can redo it.
 *
 * A posting whose accounts are in two currencies keeps both of its figures
 * here. Opening one written with a single figure is therefore how it gets
 * fixed: the form asks for the missing side before it will save.
 */
import { Notice, Setting, TFile } from 'obsidian';
import { formatPosting, readSplit, type Posting } from '@technosoftware/trail-core';
import { t } from '../lang/I18nManager';
import type { CreateDeps } from '../ui/modals/new-para-modals';
import { deletePosting, rewritePosting, type PostingSite } from './edit-posting';
import { NewPostingModal } from './new-posting-modal';
import type { SplitLeg } from './import-write';

export interface EditPostingDeps extends CreateDeps {
  onChanged: () => void;
}

export class EditPostingModal extends NewPostingModal {
  private confirmingDelete = false;
  /** A split this form cannot put back the way it was found. Shown, never saved. */
  private unreadable = false;

  constructor(
    private readonly editDeps: EditPostingDeps,
    private readonly site: PostingSite,
    /** Every posting on this site's lines: one, or a split's legs together. */
    private readonly existing: readonly Posting[]
  ) {
    super(editDeps);

    const first = existing[0];
    if (!first) return;

    this.day = first.date;
    this.description = first.splitOf ?? first.text;
    this.reference = first.reference ?? '';
    // Carried, not dropped. Without this a corrected row is offered by the
    // next import as though it had never been posted: see `importKey` on the
    // form this extends.
    this.importKey = first.importKey;

    const entry = readSplit(existing);

    if (existing.length > 1) {
      // A split, put back into the shape it was written in. Which side the legs
      // filled cannot be read off one posting: the parser fills the header's
      // blank side from each leg, so every leg comes back with both sides
      // named. `readSplit` recovers it from the set instead. See its comment.
      if (!entry) {
        // Postings that cannot have been written as one entry. Refusing beats
        // writing a guess over a statement somebody reconciled.
        this.unreadable = true;
        return;
      }
      this.legs = entry.legs.map((leg): SplitLeg => ({
        account: leg.account,
        amount: leg.amount,
        text: leg.text,
      }));
      this.amount = entry.amount;
      this.debit = entry.debit;
      this.credit = entry.credit;
    } else {
      this.amount = first.amount;
      this.debit = first.debit;
      this.credit = first.credit;
      // Carried over rather than dropped. A posting between two currencies that
      // came back from this form with one figure would take the wrong amount off
      // one of its two accounts, and nothing on screen would have said so.
      this.counterAmount = first.counterAmount;
    }
  }

  protected override heading(): string {
    return t('ledger.editPosting');
  }

  protected override blocker(): string | null {
    return this.unreadable ? t('ledger.splitUnreadable') : super.blocker();
  }

  protected override fields(container: HTMLElement): void {
    if (this.unreadable) {
      container.createEl('p', { cls: 'nod-form-error', text: t('ledger.splitUnreadable') });
      for (const posting of this.existing) {
        container.createEl('p', { cls: 'nod-form-hint', text: formatPosting(posting) });
      }
      return;
    }

    super.fields(container);

    // What is there now, so a correction is made against the line rather than
    // against somebody's memory of it.
    const first = this.existing[0];
    if (first) {
      container.createEl('p', { cls: 'nod-form-hint', text: formatPosting(first) });
    }

    new Setting(container).addButton((button) => {
      // Obsidian's own warning class rather than the API for it: `setWarning`
      // is deprecated and `setDestructive` needs a newer Obsidian than this
      // plugin claims to support.
      button.buttonEl.addClass('mod-warning');
      button
        .setButtonText(this.confirmingDelete ? t('ledger.deleteConfirm') : t('common.remove'))
        .onClick(() => {
          if (!this.confirmingDelete) {
            this.confirmingDelete = true;
            this.rerender();
            return;
          }
          void this.remove();
        });
    });
  }

  protected override async submit(): Promise<void> {
    const built = this.built();
    if (!built) return;

    const file = await rewritePosting(
      this.editDeps.app,
      this.editDeps.getSettings(),
      this.site,
      built,
      this.editDeps.now()
    );

    if (!file) {
      // The note changed under the view. Writing anyway would put the
      // correction somewhere nobody asked for it.
      new Notice(t('ledger.postingGone'));
      return;
    }

    new Notice(t('notices.noteUpdated', { title: file.basename }));
    this.editDeps.onChanged();
  }

  private async remove(): Promise<void> {
    const gone = await deletePosting(this.editDeps.app, this.site);
    new Notice(gone ? t('ledger.postingDeleted') : t('ledger.postingGone'));
    this.editDeps.onChanged();
    this.close();
  }
}

/** Narrows a file to the shape the site wants, for a caller holding a TFile. */
export function siteFor(file: TFile, line: number): PostingSite {
  return { file, line };
}
