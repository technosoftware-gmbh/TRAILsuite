/**
 * Review UI for the `type:` frontmatter integrity check in
 * entity-type-issues.ts. Never writes anything without an explicit click --
 * there is no automatic or silent bulk write. Applying a suggestion (single
 * note or "apply all") only ever sets the configured type property to a
 * value the scan itself suggested; it never touches any other frontmatter
 * field or note content.
 *
 * It also carries the two photo spot warnings from photo-spot-issues.ts.
 * They sit in a second list with an Open button and no Set button, because
 * neither has a suggestion the plugin may apply: the fix is a decision, not
 * a value this code could compute.
 */
import { App, Modal, Notice, Setting } from 'obsidian';
import { APERtrailSettings } from '../../settings/types';
import { t } from '../../lang/I18nManager';
import {
  applyEntityType,
  EntityFolderLocation,
  EntityTypeIssue,
  scanEntityTypeIssues,
} from './entity-type-issues';
import { PhotoSpotIssue, scanPhotoSpotIssues } from './photo-spot-issues';
import { BookingIssue, scanBookingIssues } from './booking-issues';

function locationLabel(location: EntityFolderLocation): string {
  return t(`health.entityTypeCheck.locationLabels.${location}`);
}

const BULK_CONFIRM_WINDOW_MS = 4000;

/** A nameless motif is named as such rather than left as an empty gap in the sentence. */
function motifLabel(name: string): string {
  return name.trim() || t('photoSpot.unnamedMotif');
}

function describeBookingWarning(issue: BookingIssue): string {
  const warning = issue.warning;
  switch (warning.kind) {
    case 'unattached':
      return t('health.bookingCheck.unattached');
    case 'noCurrency':
      return t('health.bookingCheck.noCurrency');
    case 'strangerOnTheSplit':
      return t('health.bookingCheck.strangerOnTheSplit', { person: warning.person });
    case 'duplicateReference':
      return t('health.bookingCheck.duplicateReference', {
        reference: warning.reference,
        other: warning.other,
      });
  }
}

function describeWarning(issue: PhotoSpotIssue): string {
  switch (issue.kind) {
    case 'multipleMain':
      return t('health.photoSpotCheck.multipleMain', {
        names: issue.names.map(motifLabel).join(', '),
      });
    case 'orphanSample':
      return t('health.photoSpotCheck.orphanSample', {
        image: issue.image ?? t('health.photoSpotCheck.noImage'),
        motif: motifLabel(issue.motifName),
      });
    case 'missingTimeZone':
      return t('health.photoSpotCheck.missingTimeZone', {
        device: deviceTimeZone(),
        implied: issue.impliedOffset,
      });
  }
}

/** The zone the runtime is in, so the row can say whose clock the times are currently on. */
function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export class EntityTypeCheckModal extends Modal {
  private issues: EntityTypeIssue[] = [];
  private spotIssues: PhotoSpotIssue[] = [];
  private bookingIssues: BookingIssue[] = [];
  private confirmingBulkApply = false;
  private confirmTimeoutId: number | undefined;

  constructor(
    app: App,
    private readonly settings: APERtrailSettings
  ) {
    super(app);
  }

  onOpen(): void {
    this.rescan();
  }

  onClose(): void {
    if (this.confirmTimeoutId !== undefined) window.clearTimeout(this.confirmTimeoutId);
    this.contentEl.empty();
  }

  /** Re-reads the vault from scratch. Only called on open and on an explicit "Rescan" click -- see the class doc comment for why apply actions update local state instead of calling this. */
  private rescan(): void {
    this.issues = scanEntityTypeIssues(this.app, this.settings);
    this.spotIssues = scanPhotoSpotIssues(this.app, this.settings);
    this.bookingIssues = this.settings.budgetEnabled
      ? scanBookingIssues(this.app, this.settings)
      : [];
    this.confirmingBulkApply = false;
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: t('health.entityTypeCheck.title') });

    // Every entity folder maps to exactly one type -- a literal for the
    // travel folders, the configured value for the two CRM ones -- so every
    // issue the scan reports carries a confident suggestion. The summary and the apply-all
    // button can therefore count the whole list -- there is no "of which N
    // are fixable" subset to report separately.
    if (this.issues.length === 0) {
      contentEl.createEl('p', {
        text: t('health.entityTypeCheck.allTypesOk'),
        cls: 'setting-item-description',
      });
    } else {
      contentEl.createEl('p', {
        text: t('health.entityTypeCheck.summary', { count: this.issues.length }),
        cls: 'setting-item-description',
      });

      const listEl = contentEl.createDiv();
      for (const issue of this.issues) {
        this.renderIssueRow(listEl, issue);
      }
    }

    this.renderPhotoSpotWarnings(contentEl);
    this.renderBookingWarnings(contentEl);

    const footerEl = contentEl.createDiv();

    new Setting(footerEl)
      .addButton((btn) =>
        btn.setButtonText(t('health.entityTypeCheck.rescan')).onClick(() => this.rescan())
      )
      .addButton((btn) => {
        const count = this.issues.length;
        const label = this.confirmingBulkApply
          ? t('health.entityTypeCheck.confirmBulkApply', { count })
          : t('health.entityTypeCheck.applyAllSuggested', { count });
        btn.setButtonText(label).setDisabled(count === 0);
        // setDestructive() is the non-deprecated spelling, but it only
        // exists from Obsidian 1.13; this plugin still supports 1.12, so
        // the deprecated call stays until that floor moves.
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- the 1.12 floor, explained above
        if (this.confirmingBulkApply) btn.setWarning();
        btn.onClick(() => this.onBulkApplyClick(this.issues));
      })
      .addButton((btn) =>
        btn.setButtonText(t('health.entityTypeCheck.close')).onClick(() => this.close())
      );
  }

  /**
   * The photo spot warnings, hidden entirely when there are none.
   *
   * An empty section with a reassuring sentence would be the third thing
   * this modal says about a vault that is already fine, and the paragraph
   * above it says that once already.
   */
  private renderPhotoSpotWarnings(containerEl: HTMLElement): void {
    if (this.spotIssues.length === 0) return;

    containerEl.createEl('h3', {
      text: t('health.photoSpotCheck.heading', { count: this.spotIssues.length }),
    });
    containerEl.createEl('p', {
      text: t('health.photoSpotCheck.explain'),
      cls: 'setting-item-description',
    });

    const listEl = containerEl.createDiv();
    for (const issue of this.spotIssues) {
      new Setting(listEl)
        .setName(issue.file.path)
        .setDesc(describeWarning(issue))
        .addButton((btn) =>
          btn.setButtonText(t('health.entityTypeCheck.open')).onClick(() => {
            void this.app.workspace.getLeaf('tab').openFile(issue.file);
          })
        );
    }
  }

  /** The booking warnings, hidden entirely when there are none, like the section above. */
  private renderBookingWarnings(containerEl: HTMLElement): void {
    if (this.bookingIssues.length === 0) return;

    containerEl.createEl('h3', {
      text: t('health.bookingCheck.heading', { count: this.bookingIssues.length }),
    });
    containerEl.createEl('p', {
      text: t('health.bookingCheck.explain'),
      cls: 'setting-item-description',
    });

    const listEl = containerEl.createDiv();
    for (const issue of this.bookingIssues) {
      new Setting(listEl)
        .setName(issue.file.path)
        .setDesc(describeBookingWarning(issue))
        .addButton((btn) =>
          btn.setButtonText(t('health.entityTypeCheck.open')).onClick(() => {
            void this.app.workspace.getLeaf('tab').openFile(issue.file);
          })
        );
    }
  }

  private onBulkApplyClick(issues: EntityTypeIssue[]): void {
    if (issues.length === 0) return;

    if (!this.confirmingBulkApply) {
      this.confirmingBulkApply = true;
      this.render();
      this.confirmTimeoutId = window.setTimeout(() => {
        this.confirmingBulkApply = false;
        this.render();
      }, BULK_CONFIRM_WINDOW_MS);
      return;
    }

    if (this.confirmTimeoutId !== undefined) window.clearTimeout(this.confirmTimeoutId);
    void this.applyAll(issues);
  }

  private renderIssueRow(containerEl: HTMLElement, issue: EntityTypeIssue): void {
    const current = issue.currentType ?? t('health.entityTypeCheck.missingLabel');
    const suggestion = issue.suggestedType;

    const setting = new Setting(containerEl).setName(issue.file.path).setDesc(
      t('health.entityTypeCheck.issueDesc', {
        location: locationLabel(issue.location),
        current,
        suggested: suggestion,
      })
    );

    setting.addButton((btn) =>
      btn.setButtonText(t('health.entityTypeCheck.open')).onClick(() => {
        void this.app.workspace.getLeaf('tab').openFile(issue.file);
      })
    );

    setting.addButton((btn) =>
      btn
        .setButtonText(t('health.entityTypeCheck.setButton', { type: issue.suggestedType }))
        .setCta()
        .onClick(() => void this.applyOne(issue))
    );
  }

  // Removes the applied issue(s) from local state directly rather than
  // re-scanning via app.metadataCache, which updates asynchronously after
  // processFrontMatter resolves and isn't guaranteed to reflect the write
  // yet on the very next tick. This modal already knows exactly what it just
  // wrote, so there's nothing the cache could tell it that it doesn't
  // already know.

  private async applyOne(issue: EntityTypeIssue): Promise<void> {
    await applyEntityType(this.app, this.settings, issue, issue.suggestedType);
    new Notice(
      t('health.entityTypeCheck.setTypeNotice', {
        type: issue.suggestedType,
        basename: issue.file.basename,
      })
    );
    this.issues = this.issues.filter((i) => i !== issue);
    this.render();
  }

  private async applyAll(issues: EntityTypeIssue[]): Promise<void> {
    let applied = 0;
    for (const issue of issues) {
      await applyEntityType(this.app, this.settings, issue, issue.suggestedType);
      applied++;
    }
    new Notice(t('health.entityTypeCheck.appliedNotice', { count: applied }));
    const appliedSet = new Set(issues);
    this.issues = this.issues.filter((i) => !appliedSet.has(i));
    this.confirmingBulkApply = false;
    this.render();
  }
}
