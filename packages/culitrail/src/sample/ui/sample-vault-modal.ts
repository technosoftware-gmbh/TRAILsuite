/**
 * Preview, then write: what the sample vault would do before it does it.
 *
 * The modal exists because this is the one command in CULItrail that creates
 * notes somebody did not name, in folders they may already be using. A preview
 * turns that from a leap into a decision, so the body says plainly what would
 * be created, what is already there, and -- separately, because it is the only
 * edit made to a note that already exists -- which notes would gain this
 * plugin's orders block.
 *
 * **A refusal shows its reason and keeps the button visible.** A disabled Create
 * beside the folder that is in the way is answerable; a Create that has
 * disappeared is a plugin that looks broken.
 */
import { App, Notice } from 'obsidian';
import {
  planSampleVault,
  sampleFolders,
  sampleVaultWritable,
  sampleWriteCount,
  type SampleVaultPlan,
} from '@technosoftware/trail-core';
import { t } from '../../lang/I18nManager';
import type { CULItrailSettings } from '../../settings/types';
import { addFooterButtons, BaseModal } from '../../ui/base-modal';
import { sampleNotes } from '../notes';
import { sampleFolderContents } from '../read-folders';
import { writeSampleVault } from '../write';

export class SampleVaultModal extends BaseModal {
  private plan: SampleVaultPlan | null = null;
  private confirmEl: HTMLButtonElement | null = null;

  constructor(
    app: App,
    private readonly settings: CULItrailSettings,
    private readonly now: Date,
    private readonly onWritten: () => void
  ) {
    super(app);
  }

  getTitle(): string {
    return t('sample.title');
  }

  getSubtitle(): string {
    return t('sample.subtitle');
  }

  getIcon(): string {
    return 'sprout';
  }

  async renderBody(body: HTMLElement): Promise<void> {
    const notes = sampleNotes(this.settings, this.now);
    const plan = planSampleVault(notes, await sampleFolderContents(this.app, notes));
    this.plan = plan;

    body.createEl('p', { cls: 'culi-settings-note', text: t('sample.intro') });

    this.renderRefusals(body, plan);
    this.renderShared(body, plan);
    this.renderPlanned(body, plan);

    // Enabled only now, once there is a plan to act on. The footer went up
    // before this ran so that Cancel was reachable while the vault was read.
    if (this.confirmEl) {
      this.confirmEl.disabled = !sampleVaultWritable(plan);
      this.confirmEl.setText(t('sample.create', { count: sampleWriteCount(plan) }));
    }
  }

  /** Why the run cannot go ahead: the occupied folders, then the unconfigured settings. */
  private renderRefusals(body: HTMLElement, plan: SampleVaultPlan): void {
    if (plan.occupied.length > 0) {
      const section = this.section(body, t('sample.occupiedHeading'), 'culi-sample-refusal');
      for (const folder of plan.occupied) {
        section.createDiv({
          cls: 'culi-sample-item',
          text: t('sample.occupiedFolder', {
            folder: folder.folder,
            strangers: folder.strangers.join(', '),
          }),
        });
      }
    }

    if (plan.unconfigured.length > 0) {
      const section = this.section(body, t('sample.unconfiguredHeading'), 'culi-sample-refusal');
      section.createDiv({ cls: 'culi-sample-item', text: plan.unconfigured.join(', ') });
    }
  }

  /**
   * The shared folders that already hold somebody else's notes.
   *
   * **Not a warning and not a refusal.** The two CRM folders are written by
   * more than one plugin by agreement, so a company note this plan has never
   * heard of is a sibling's rather than a stranger's, and the honest thing for
   * the preview to do is say what it is about to write beside and let a person
   * decide. It is rendered before the plan rather than after it, because it
   * changes how the list below should be read.
   */
  private renderShared(body: HTMLElement, plan: SampleVaultPlan): void {
    if (plan.shared.length === 0) return;

    const section = this.section(body, t('sample.sharedHeading'), 'culi-sample-shared');
    for (const folder of plan.shared) {
      section.createDiv({
        cls: 'culi-sample-item',
        text: t('sample.sharedFolder', {
          folder: folder.folder,
          count: folder.others.length,
          others: folder.others.join(', '),
        }),
      });
    }
  }

  /** What would be created, what would be skipped, and what would gain a block. */
  private renderPlanned(body: HTMLElement, plan: SampleVaultPlan): void {
    const writes = plan.notes.filter((entry) => entry.status === 'write');
    if (writes.length > 0) {
      const section = this.section(body, t('sample.createHeading'));
      // Grouped by folder rather than listed flat: a person deciding whether to
      // run this is deciding about folders, and fifteen titles in one column
      // does not answer that question.
      for (const folder of sampleFolders(writes.map((entry) => entry.note))) {
        const titles = writes
          .filter((entry) => entry.note.folder === folder)
          .map((entry) => entry.note.title);
        section.createDiv({
          cls: 'culi-sample-folder',
          text: t('sample.folderCount', { folder, count: titles.length }),
        });
        section.createDiv({ cls: 'culi-sample-item', text: titles.join(', ') });
      }
    }

    const skipped = plan.notes.filter((entry) => entry.status === 'exists');
    if (skipped.length > 0) {
      const section = this.section(body, t('sample.skipHeading'));
      section.createDiv({
        cls: 'culi-sample-item',
        text: skipped.map((entry) => entry.note.title).join(', '),
      });
    }

    const augmented = plan.notes.filter((entry) => entry.augment);
    if (augmented.length > 0) {
      const section = this.section(body, t('sample.augmentHeading'));
      section.createDiv({
        cls: 'culi-sample-item',
        text: augmented.map((entry) => entry.note.title).join(', '),
      });
    }

    if (writes.length === 0 && augmented.length === 0 && plan.occupied.length === 0) {
      body.createDiv({ cls: 'culi-sample-item', text: t('sample.nothingToDo') });
    }
  }

  private section(body: HTMLElement, heading: string, extra?: string): HTMLElement {
    const section = body.createDiv({ cls: 'culi-sample-section' });
    if (extra) section.addClass(extra);
    section.createEl('h3', { cls: 'culi-sample-heading', text: heading });
    return section;
  }

  renderFooter(footer: HTMLElement): void {
    const confirm = addFooterButtons(footer, {
      confirmLabel: t('sample.create', { count: 0 }),
      onCancel: () => this.close(),
      onConfirm: () => void this.write(),
    });
    // Disabled until the body has read the vault: there is nothing to write
    // until there is a plan, and a button that acts on null is worse than one
    // that waits.
    confirm.disabled = true;
    this.confirmEl = confirm;
  }

  private async write(): Promise<void> {
    const plan = this.plan;
    if (!plan || !sampleVaultWritable(plan)) return;

    if (this.confirmEl) this.confirmEl.disabled = true;

    try {
      const result = await writeSampleVault(this.app, this.settings, plan, this.now);
      new Notice(t('sample.written', { created: result.created, augmented: result.augmented }));
      if (result.failed.length > 0) {
        new Notice(t('sample.failed', { titles: result.failed.join(', ') }));
      }
      this.onWritten();
      this.close();
    } catch {
      new Notice(t('sample.refused'));
      this.close();
    }
  }
}
