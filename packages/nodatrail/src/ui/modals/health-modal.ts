/**
 * The vault check, as a list somebody reads and acts on one line at a time.
 *
 * **It reports; it does not repair.** The one fix offered is setting a note's
 * type to what its folder says it should be, because that is the only finding
 * where the answer is already known. A broken link cannot be repaired without
 * knowing which note was meant, a disagreeing total cannot be corrected without
 * knowing which figure is right, and a stamp in an older shape converts on its
 * own the next time the note is written.
 *
 * Nothing is fixed in bulk, ever.
 */
import { App, Modal, Notice, Setting } from 'obsidian';
import { t } from '../../lang/I18nManager';
import type { NODAtrailSettings } from '../../settings/types';
import { applyAllFixes, applyFix, canFix, runHealthCheck } from '../../vault/health/scan';
import type { Finding } from '../../vault/health/findings';
import { emptyState, row } from '../kit/elements';

export class HealthCheckModal extends Modal {
  constructor(
    app: App,
    private readonly getSettings: () => NODAtrailSettings,
    private readonly openFile: (path: string) => Promise<void>
  ) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.addClass('nod-health');
    this.setTitle(t('health.title'));
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  /**
   * Redraws the whole body, findings and buttons together.
   *
   * `contentEl.empty()` rather than finding the previous body and removing it.
   * The title lives in `titleEl`, so emptying the content element loses
   * nothing, and it is the idiom every view in this plugin already uses. The
   * version that queried for its own previous output threw on the first render,
   * when there was none to find, and a modal that throws in `onOpen` shows an
   * empty box rather than an error: it reported no findings by failing before
   * it had looked for any.
   */
  private render(): void {
    this.contentEl.empty();

    const body = this.contentEl.createDiv({ cls: 'nod-health-body' });
    const findings = runHealthCheck(this.app, this.getSettings());

    if (findings.length === 0) {
      emptyState(body, t('health.allClear'));
    } else {
      body.createEl('p', {
        cls: 'nod-settings-note',
        text: t('health.issuesFound', { count: findings.length }),
      });
      for (const finding of findings) this.renderFinding(body, finding);
    }

    // Offered only when there is more than one, because with a single finding
    // its own button is already the shortest way there and a second control
    // saying the same thing is noise.
    const fixable = findings.filter(canFix);

    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText(t('health.run')).onClick(() => this.render()))
      .addButton((button) => {
        button.setButtonText(t('health.fixAll', { count: String(fixable.length) })).onClick(() => {
          button.setDisabled(true);
          void applyAllFixes(this.app, this.getSettings(), fixable).then((fixed) => {
            new Notice(t('notices.fixesApplied', { count: String(fixed) }));
            this.render();
          });
        });
        if (fixable.length < 2) button.buttonEl.hide();
      })
      .addButton((button) =>
        button
          .setButtonText(t('common.close'))
          .setCta()
          .onClick(() => this.close())
      );
  }

  private renderFinding(parent: HTMLElement, finding: Finding): void {
    const line = row(parent, {
      title: finding.title,
      subtitle: `${t(`health.${finding.kind}`)}${finding.detail ? `: ${finding.detail}` : ''}`,
      icon: 'alert-triangle',
      onClick: () => {
        void this.openFile(finding.path);
        this.close();
      },
    });

    if (canFix(finding)) {
      const fix = line.createEl('button', {
        cls: 'nod-row-fix',
        // What it will become, rather than the word "Fix". A stamp finding's
        // whole content is a before and an after, and a button that showed the
        // after is one nobody has to press to find out what it does.
        text: finding.kind === 'oldStampShape' ? `-> ${finding.expected}` : t('health.fix'),
      });
      fix.addEventListener('click', (event) => {
        event.stopPropagation();
        void applyFix(this.app, this.getSettings(), finding).then(() => this.render());
      });
    }
  }
}
