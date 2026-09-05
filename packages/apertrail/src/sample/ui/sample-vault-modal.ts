/**
 * Preview, then write: what the sample-vault command would do to this vault,
 * shown before anything is created.
 *
 * The preview is the feature. This is a command that writes sixteen notes into
 * somebody's own vault, and the difference between that being useful and that
 * being alarming is entirely whether they saw the list first. So it lists every
 * note by the folder it would land in, names the ones it would leave alone, and
 * names separately the ones that would be edited -- because appending a block to
 * a note this plugin did not write is the one thing here that touches somebody
 * else's file.
 *
 * **When the plan refuses, the button stays visible and goes grey**, with the
 * reason above it. A disabled button that says why is a fixable situation; an
 * action that has quietly disappeared is a bug report.
 */
import { App, Notice } from 'obsidian';
import {
  planSampleVault,
  sampleAugmentCount,
  sampleSkipCount,
  sampleVaultWritable,
  sampleWriteCount,
  type PlannedSampleNote,
  type SampleVaultPlan,
} from '@technosoftware/trail-core';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { addFooterButtons, BaseModal } from '../../ui/components/modal-shell';
import { sampleNotes } from '../notes';
import { sampleFolderContents } from '../read-folders';
import { writeSampleVault } from '../write';

export class SampleVaultModal extends BaseModal {
  private plan: SampleVaultPlan | null = null;
  private actionButton: HTMLButtonElement | null = null;

  constructor(
    app: App,
    private readonly settings: APERtrailSettings,
    private readonly onWritten?: () => void
  ) {
    super(app);
  }

  getTitle(): string {
    return t('sampleVault.title');
  }

  getIcon(): string {
    return 'sprout';
  }

  getSubtitle(): string {
    return t('sampleVault.subtitle');
  }

  async renderBody(bodyEl: HTMLElement): Promise<void> {
    bodyEl.createEl('p', { cls: 'apt-modal-note', text: t('sampleVault.intro') });

    const notes = sampleNotes(this.settings, new Date());
    const plan = planSampleVault(notes, await sampleFolderContents(this.app, notes));
    this.plan = plan;

    this.renderRefusal(bodyEl, plan);
    this.renderGroups(
      bodyEl,
      t('sampleVault.createHeading', { count: sampleWriteCount(plan) }),
      plan.notes.filter((entry) => entry.status === 'write')
    );
    this.renderGroups(
      bodyEl,
      t('sampleVault.skipHeading', { count: sampleSkipCount(plan) }),
      plan.notes.filter((entry) => entry.status === 'exists' && !entry.augment)
    );

    const augmenting = plan.notes.filter((entry) => entry.augment);
    if (augmenting.length > 0) {
      this.renderGroups(
        bodyEl,
        t('sampleVault.augmentHeading', { count: sampleAugmentCount(plan) }),
        augmenting
      );
      bodyEl.createEl('p', { cls: 'apt-modal-note', text: t('sampleVault.augmentExplain') });
    }

    this.renderShared(bodyEl, plan);

    if (sampleWriteCount(plan) === 0 && augmenting.length === 0 && plan.occupied.length === 0) {
      bodyEl.createEl('p', { cls: 'apt-modal-note', text: t('sampleVault.nothingToDo') });
    }

    // The footer is built before the body, so the button exists by now and the
    // verdict this render just computed is what decides whether it is usable.
    if (this.actionButton) this.actionButton.disabled = !sampleVaultWritable(plan);
  }

  /**
   * The shared folders that already hold notes of somebody else's.
   *
   * Neither a warning nor a refusal: the CRM folders are written by more than
   * one plugin by agreement, so a note in one of them that this plan does not
   * name belongs to a sibling rather than to a stranger. What the modal owes a
   * person here is the truth about a folder this plugin does not own -- how
   * many notes are already in it and what they are called -- so they can decide
   * whether to go on, rather than a refusal they cannot act on.
   */
  private renderShared(bodyEl: HTMLElement, plan: SampleVaultPlan): void {
    if (plan.shared.length === 0) return;

    bodyEl.createEl('h3', { cls: 'apt-sample-heading', text: t('sampleVault.sharedHeading') });
    bodyEl.createEl('p', { cls: 'apt-modal-note', text: t('sampleVault.sharedExplain') });

    for (const folder of plan.shared) {
      const group = bodyEl.createDiv({ cls: 'apt-sample-group' });
      group.createDiv({ cls: 'apt-sample-folder', text: folder.folder });
      group.createDiv({
        cls: 'apt-sample-titles',
        text: t('sampleVault.sharedOthers', {
          count: folder.others.length,
          titles: folder.others.join(', '),
        }),
      });
    }
  }

  /** Why nothing can be written: the folders holding somebody else's notes, and the settings that are empty. */
  private renderRefusal(bodyEl: HTMLElement, plan: SampleVaultPlan): void {
    if (plan.occupied.length === 0 && plan.unconfigured.length === 0) return;

    const blocked = bodyEl.createDiv({ cls: 'apt-sample-blocked' });
    blocked.createEl('h3', { cls: 'apt-sample-heading', text: t('sampleVault.blockedHeading') });

    if (plan.occupied.length > 0) {
      blocked.createEl('p', { cls: 'apt-modal-note', text: t('sampleVault.occupiedExplain') });
      for (const folder of plan.occupied) {
        const row = blocked.createDiv({ cls: 'apt-sample-group' });
        row.createDiv({ cls: 'apt-sample-folder', text: folder.folder });
        row.createDiv({
          cls: 'apt-sample-titles',
          text: t('sampleVault.strangers', { titles: folder.strangers.join(', ') }),
        });
      }
    }

    if (plan.unconfigured.length > 0) {
      blocked.createEl('p', {
        cls: 'apt-modal-note',
        text: t('sampleVault.unconfigured', { titles: plan.unconfigured.join(', ') }),
      });
    }
  }

  /** One section, its notes grouped under the folder each would land in. An empty section is not drawn at all. */
  private renderGroups(
    bodyEl: HTMLElement,
    heading: string,
    entries: readonly PlannedSampleNote[]
  ): void {
    if (entries.length === 0) return;

    bodyEl.createEl('h3', { cls: 'apt-sample-heading', text: heading });

    const folders: string[] = [];
    for (const entry of entries) {
      if (!folders.includes(entry.note.folder)) folders.push(entry.note.folder);
    }

    for (const folder of folders) {
      const titles = entries
        .filter((entry) => entry.note.folder === folder)
        .map((entry) => entry.note.title);

      const group = bodyEl.createDiv({ cls: 'apt-sample-group' });
      group.createDiv({ cls: 'apt-sample-folder', text: folder });
      group.createDiv({ cls: 'apt-sample-titles', text: titles.join(', ') });
    }
  }

  renderFooter(footerEl: HTMLElement): void {
    this.actionButton = addFooterButtons(footerEl, {
      confirmLabel: t('sampleVault.createButton'),
      onCancel: () => this.close(),
      onConfirm: () => void this.submit(),
    });
    // Disabled until the body has read the vault and worked out the verdict,
    // so the window between opening and the first render cannot write anything.
    this.actionButton.disabled = true;
  }

  private async submit(): Promise<void> {
    const plan = this.plan;
    if (!plan || !sampleVaultWritable(plan)) return;

    const result = await writeSampleVault(this.app, this.settings, plan, new Date());

    const lines = [t('sampleVault.createdNotice', { count: result.created })];
    if (result.augmented > 0) {
      lines.push(t('sampleVault.augmentedNotice', { count: result.augmented }));
    }
    if (result.failed.length > 0) {
      lines.push(t('sampleVault.failedNotice', { titles: result.failed.join(', ') }));
    }
    new Notice(lines.join(' '));

    this.close();
    this.onWritten?.();
  }
}
