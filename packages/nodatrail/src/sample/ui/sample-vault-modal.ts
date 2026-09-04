/**
 * Preview, then write: what the sample-vault command would do to this vault,
 * shown before anything is created.
 *
 * The preview is the feature. This is a command that writes twenty-three notes
 * into somebody's own vault, and the difference between that being useful and
 * that being alarming is entirely whether they saw the list first. So it names
 * every note under the folder it would land in, names the ones it would leave
 * alone, and names separately the ones that would be **edited** -- because
 * appending a block to a note this plugin did not write is the one thing here
 * that touches somebody else's file.
 *
 * **When the plan refuses, the button stays visible and goes grey**, with the
 * reason above it. A disabled button that says why is a fixable situation; an
 * action that has quietly disappeared is a bug report.
 *
 * A plain `Modal` rather than `FormModal`, which is the right base for the
 * dialogs that collect fields and the wrong one for a dialog whose whole body is
 * a report. `HealthCheckModal` is the precedent and the shape is deliberately
 * the same one.
 */
import { App, Modal, Notice, Setting } from 'obsidian';
import {
  planSampleVault,
  sampleAugmentCount,
  sampleSkipCount,
  sampleVaultWritable,
  sampleWriteCount,
  type PlannedSampleNote,
  type SampleVaultPlan,
} from 'trail-core';
import { t } from '../../lang/I18nManager';
import type { NODAtrailSettings } from '../../settings/types';
import { emptyState } from '../../ui/kit/elements';
import { sampleNotes } from '../notes';
import { sampleFolderContents } from '../read-folders';
import { writeSampleVault } from '../write';

export interface SampleVaultDeps {
  app: App;
  getSettings: () => NODAtrailSettings;
  now: () => Date;
  onWritten: () => void;
}

export class SampleVaultModal extends Modal {
  private plan: SampleVaultPlan | null = null;

  constructor(private readonly deps: SampleVaultDeps) {
    super(deps.app);
  }

  onOpen(): void {
    this.contentEl.addClass('nod-sample');
    this.setTitle(t('sample.title'));
    void this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  /**
   * Redraws the whole body and its buttons together.
   *
   * `contentEl.empty()` rather than finding the previous body and removing it:
   * the title lives in `titleEl`, so emptying the content element loses nothing,
   * and a modal that queries for DOM it built itself throws on the first render
   * when there is none to find. See `tests/ui-conventions.test.ts`.
   */
  private async render(): Promise<void> {
    this.contentEl.empty();

    const settings = this.deps.getSettings();
    const body = this.contentEl.createDiv({ cls: 'nod-sample-body' });

    // Said plainly and first: this writes files into the vault that is open.
    body.createEl('p', { cls: 'nod-settings-note', text: t('sample.intro') });

    const notes = sampleNotes(settings, this.deps.now());
    const plan = planSampleVault(notes, await sampleFolderContents(this.app, notes));
    this.plan = plan;

    this.renderRefusal(body, plan);

    this.renderGroups(
      body,
      t('sample.createHeading', { count: sampleWriteCount(plan) }),
      plan.notes.filter((entry) => entry.status === 'write')
    );
    this.renderGroups(
      body,
      t('sample.skipHeading', { count: sampleSkipCount(plan) }),
      plan.notes.filter((entry) => entry.status === 'exists' && !entry.augment)
    );

    const augmenting = plan.notes.filter((entry) => entry.augment);
    if (augmenting.length > 0) {
      this.renderGroups(
        body,
        t('sample.augmentHeading', { count: sampleAugmentCount(plan) }),
        augmenting
      );
      body.createEl('p', { cls: 'nod-settings-note', text: t('sample.augmentExplain') });
    }

    this.renderShared(body, plan);

    if (sampleWriteCount(plan) === 0 && augmenting.length === 0 && plan.occupied.length === 0) {
      emptyState(body, t('sample.nothingToDo'));
    }

    this.renderButtons(sampleVaultWritable(plan));
  }

  /**
   * What is already in a folder this plan writes into and does not own.
   *
   * `CRM/People` is filled by all three plugins and by whoever keeps contacts in
   * this vault, so a person note NODAtrail does not name is not a stranger and
   * does not refuse the run. It is still somebody's, and writing two notes into
   * a folder holding nine of theirs without saying so would be the preview
   * omitting the one thing about this run a person might object to.
   *
   * **Not styled as a warning, and it sits below the plan rather than above it.**
   * Nothing here is wrong: the run is going ahead, the existing notes are
   * untouched, and this says what it will be writing beside. The refusal block is
   * the one that goes at the top in red, and putting this there too would teach
   * people to scroll past both.
   */
  private renderShared(body: HTMLElement, plan: SampleVaultPlan): void {
    if (plan.shared.length === 0) return;

    body.createEl('h3', { cls: 'nod-sample-heading', text: t('sample.sharedHeading') });
    body.createEl('p', { cls: 'nod-settings-note', text: t('sample.sharedExplain') });

    for (const folder of plan.shared) {
      const group = body.createDiv({ cls: 'nod-sample-group' });
      group.createDiv({ cls: 'nod-sample-folder', text: folder.folder });
      group.createDiv({
        cls: 'nod-sample-titles',
        // The count and the titles, because a folder with three notes in it and
        // one with ninety are different decisions and only the number says which
        // this is.
        text: t('sample.alreadyThere', {
          count: folder.others.length,
          titles: folder.others.join(', '),
        }),
      });
    }
  }

  /** Why nothing can be written: the folders holding somebody else's notes, and the settings that are empty. */
  private renderRefusal(body: HTMLElement, plan: SampleVaultPlan): void {
    if (plan.occupied.length === 0 && plan.unconfigured.length === 0) return;

    const blocked = body.createDiv({ cls: 'nod-sample-blocked' });
    blocked.createEl('h3', { cls: 'nod-sample-heading', text: t('sample.blockedHeading') });

    if (plan.occupied.length > 0) {
      blocked.createEl('p', { cls: 'nod-settings-note', text: t('sample.occupiedExplain') });
      for (const folder of plan.occupied) {
        const group = blocked.createDiv({ cls: 'nod-sample-group' });
        group.createDiv({ cls: 'nod-sample-folder', text: folder.folder });
        group.createDiv({
          cls: 'nod-sample-titles',
          text: t('sample.strangers', { titles: folder.strangers.join(', ') }),
        });
      }
    }

    if (plan.unconfigured.length > 0) {
      blocked.createEl('p', {
        cls: 'nod-settings-note',
        text: t('sample.unconfigured', { titles: plan.unconfigured.join(', ') }),
      });
    }
  }

  /** One section, its notes grouped under the folder each would land in. An empty section is not drawn at all. */
  private renderGroups(
    body: HTMLElement,
    heading: string,
    entries: readonly PlannedSampleNote[]
  ): void {
    if (entries.length === 0) return;

    body.createEl('h3', { cls: 'nod-sample-heading', text: heading });

    const folders: string[] = [];
    for (const entry of entries) {
      if (!folders.includes(entry.note.folder)) folders.push(entry.note.folder);
    }

    for (const folder of folders) {
      const titles = entries
        .filter((entry) => entry.note.folder === folder)
        .map((entry) => entry.note.title);

      const group = body.createDiv({ cls: 'nod-sample-group' });
      group.createDiv({ cls: 'nod-sample-folder', text: folder });
      group.createDiv({ cls: 'nod-sample-titles', text: titles.join(', ') });
    }
  }

  private renderButtons(writable: boolean): void {
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText(t('common.cancel')).onClick(() => this.close()))
      .addButton((button) => {
        button
          .setButtonText(t('sample.createButton'))
          .setCta()
          .onClick(() => void this.submit());
        // Disabled rather than hidden. The reason is on screen above it, and a
        // control that vanished would leave nothing for the explanation to be
        // about.
        button.setDisabled(!writable);
      });
  }

  private async submit(): Promise<void> {
    const plan = this.plan;
    if (!plan || !sampleVaultWritable(plan)) return;

    const settings = this.deps.getSettings();
    const result = await writeSampleVault(this.app, settings, plan, this.deps.now());

    const lines = [t('sample.createdNotice', { count: result.created })];
    if (result.augmented > 0) {
      lines.push(t('sample.augmentedNotice', { count: result.augmented }));
    }
    if (result.failed.length > 0) {
      lines.push(t('sample.failedNotice', { titles: result.failed.join(', ') }));
    }
    new Notice(lines.join(' '));

    this.close();
    this.deps.onWritten();
  }
}
