/**
 * The preview for the one-off repair of meeting times an earlier import wrote
 * at the wrong clock.
 *
 * `repair-times.ts` explains the bug and what the repair is allowed to do. This
 * is the dialog in front of it, and it is modelled on `calendar-import-modal.ts`
 * for that file's own stated reason: *"An import that wrote first and explained
 * afterwards would be one nobody dares run on a second month."* This one is
 * worse than an import in exactly the way that matters -- it rewrites lines that
 * have been in somebody's notes for months -- so nothing happens until the list
 * has been read and a button pressed.
 *
 * A plain `Modal` rather than `FormModal`, like the calendar import beside it:
 * the body is a report, not a set of fields.
 *
 * Three things it is careful about:
 *
 * - **It leads with what will happen**, in one sentence, because "corrected in
 *   place, nothing deleted, nothing added" is the whole reason this is safe to
 *   run and it is not something a list of times says on its own.
 * - **The blocked lines get their own heading**, not a status column in the same
 *   list. They are not a variation on the repair; they are work left for a
 *   person, and a `moves-day` row in particular means a line has to be carried
 *   from one note to another by hand.
 * - **The counts are in the headings and the lines scroll inside the body**,
 *   because the export that prompted this holds about 870 of them and a footer
 *   pushed off the bottom of the screen is a button nobody can reach.
 *
 * Reading every archived `.ics` in the vault takes a visible moment, so the
 * dialog opens on a busy line rather than on an empty box.
 */
import { Modal, Notice, Setting, type App } from 'obsidian';
import { t } from '../../lang/I18nManager';
import type { NODAtrailSettings } from '../../settings/types';
import { emptyState } from '../../ui/kit/elements';
import {
  planTimeRepair,
  repairable,
  writeTimeRepair,
  type TimeRepair,
  type TimeRepairPlan,
} from '../repair-times';

export interface RepairTimesDeps {
  app: App;
  getSettings: () => NODAtrailSettings;
  onRepaired: () => void;
}

export class RepairTimesModal extends Modal {
  private plan: TimeRepairPlan | null = null;
  private body: HTMLElement | null = null;
  private footer: HTMLElement | null = null;
  private busy = false;

  constructor(private readonly deps: RepairTimesDeps) {
    super(deps.app);
  }

  override onOpen(): void {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    modalEl.addClass('nod-import-modal');

    contentEl.createEl('h2', { text: t('calendar.repair.title') });
    // The body scrolls and the footer does not, so hundreds of rows never carry
    // the button off the bottom of the dialog.
    this.body = contentEl.createDiv({ cls: 'nod-import-body' });
    this.footer = contentEl.createDiv({ cls: 'nod-import-footer' });

    void this.load();
  }

  override onClose(): void {
    this.contentEl.empty();
  }

  /**
   * Builds the plan, saying so while it does.
   *
   * This reads every archived export in the vault and expands each one, which
   * in the vault this was written for is four files and several thousand
   * events. A dialog that showed nothing until that finished would look broken.
   */
  private async load(): Promise<void> {
    const body = this.body;
    if (!body) return;

    this.busy = true;
    body.empty();
    body.createEl('p', { cls: 'nod-repair-busy', text: t('calendar.repair.reading') });
    this.renderFooter([]);

    try {
      this.plan = await planTimeRepair(this.deps.app, this.deps.getSettings());
    } finally {
      this.busy = false;
    }
    this.render();
  }

  private render(): void {
    const body = this.body;
    const plan = this.plan;
    if (!body || !plan) return;
    body.empty();

    const ready = repairable(plan);
    const blocked = plan.repairs.filter((repair) => repair.blocker !== null);

    if (plan.repairs.length === 0) {
      // Said rather than shown. An empty list under a heading reading "0 lines
      // to correct" is a dialog somebody has to interpret.
      emptyState(body, t('calendar.repair.nothing'));
      this.renderUnreadable(body, plan);
      this.renderFooter(ready);
      return;
    }

    if (ready.length === 0) {
      body.createEl('p', { cls: 'nod-import-warn', text: t('calendar.repair.noneRepairable') });
    } else {
      body.createEl('p', {
        cls: 'nod-import-summary',
        text: t('calendar.repair.intro', { count: String(ready.length) }),
      });
    }

    this.renderUnreadable(body, plan);
    this.renderRepairs(body, ready);
    this.renderBlocked(body, blocked);
    this.renderFooter(ready);
  }

  /**
   * Archived files that could not be read, named rather than counted, which is
   * how `TimeRepairPlan` states them. A count would say a preview is
   * incomplete; a name says which meetings are missing from it.
   */
  private renderUnreadable(parent: HTMLElement, plan: TimeRepairPlan): void {
    if (plan.unreadable.length === 0) return;
    parent.createEl('p', {
      cls: 'nod-import-warn',
      text: t('calendar.repair.unreadable', { files: plan.unreadable.join(', ') }),
    });
  }

  /** The lines that will be rewritten: the day, what it says, and what it will say. */
  private renderRepairs(parent: HTMLElement, ready: readonly TimeRepair[]): void {
    if (ready.length === 0) return;

    parent.createEl('h3', {
      text: t('calendar.repair.heading', { count: String(ready.length) }),
    });

    for (const repair of ready) {
      const line = parent.createDiv({ cls: 'nod-import-row nod-import-ready' });
      line.createSpan({ cls: 'nod-import-date', text: repair.day });
      // Both spans in one cell. The change is the row's content, and reading it
      // off two columns a summary apart is how a wrong one gets waved through.
      line.createSpan({
        cls: 'nod-repair-change',
        text: `${spanOf(repair.from, repair.to)} -> ${spanOf(repair.wantedFrom, repair.wantedTo)}`,
      });
      line.createSpan({ cls: 'nod-import-text', text: repair.summary });
      line.createSpan({ cls: 'nod-import-note', text: repair.source });
    }
  }

  /**
   * What this will not touch, under its own heading and with a reason each.
   *
   * Deliberately not folded in with the repairs as a status column. Everything
   * above this heading happens when the button is pressed and everything below
   * it does not, and that is the only division a reader has to hold.
   */
  private renderBlocked(parent: HTMLElement, blocked: readonly TimeRepair[]): void {
    if (blocked.length === 0) return;

    parent.createEl('h3', {
      text: t('calendar.repair.blockedHeading', { count: String(blocked.length) }),
    });

    for (const repair of blocked) {
      const entry = parent.createDiv({ cls: 'nod-repair-blocked' });
      const head = entry.createDiv({ cls: 'nod-repair-head' });
      head.createSpan({ cls: 'nod-import-date', text: repair.day });
      head.createSpan({ cls: 'nod-import-time', text: spanOf(repair.from, repair.to) });
      head.createSpan({ cls: 'nod-import-text', text: repair.summary });
      // Wrapped rather than ellipsized: the `moves-day` sentence names two
      // notes and asks for something to be done, and a truncated instruction is
      // no instruction.
      entry.createDiv({ cls: 'nod-repair-why', text: reasonFor(repair) });
    }
  }

  /**
   * The action, saying how many lines it will correct.
   *
   * The count is `repairable`'s, never `plan.repairs.length`: a button offering
   * to correct the blocked ones too would be promising something `writeTimeRepair`
   * refuses to do, and the number is the only part of the dialog somebody reads
   * before pressing it.
   */
  private renderFooter(ready: readonly TimeRepair[]): void {
    const footer = this.footer;
    if (!footer) return;
    footer.empty();

    new Setting(footer)
      .addButton((button) => button.setButtonText(t('common.close')).onClick(() => this.close()))
      .addButton((button) => {
        button
          .setButtonText(t('calendar.repair.button', { count: String(ready.length) }))
          .setCta()
          .setDisabled(ready.length === 0 || this.busy)
          .onClick(() => {
            void this.repair();
          });
      });
  }

  private async repair(): Promise<void> {
    const plan = this.plan;
    if (!plan || this.busy) return;
    this.busy = true;

    const ready = repairable(plan);
    const result = await writeTimeRepair(this.deps.app, this.deps.getSettings(), ready);

    const said = [
      t('calendar.repair.done', {
        count: String(result.repaired),
        notes: String(result.notes),
      }),
    ];
    // A refusal is not a failure of the plan: it means the note changed between
    // the preview being drawn and the button being pressed, and saying so is
    // what tells somebody that running it again is the right move.
    if (result.refused.length > 0) {
      said.push(t('calendar.repair.refused', { count: String(result.refused.length) }));
    }
    new Notice(said.join('\n'));

    this.deps.onRepaired();
    this.close();
  }
}

/** `06:00-06:25`, or whichever half of it the line carries. */
function spanOf(from: string, to: string): string {
  if (from && to) return `${from}-${to}`;
  if (from) return from;
  if (to) return `-${to}`;
  return '';
}

/** Why a line is left alone, as a sentence rather than as the blocker's name. */
function reasonFor(repair: TimeRepair): string {
  switch (repair.blocker) {
    case 'moves-day':
      return t('calendar.repair.movesDay', { day: repair.day, wanted: repair.wantedDay });
    case 'not-found':
      return t('calendar.repair.notFound', { day: repair.day });
    case 'ambiguous':
      return t('calendar.repair.ambiguous', { day: repair.day });
    default:
      return t('calendar.repair.notEditable');
  }
}
