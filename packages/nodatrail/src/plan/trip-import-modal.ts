/**
 * Seeding a day's entries from a trip, with the preview first.
 *
 * The third of these and deliberately the same shape as the other two: every
 * stop is shown with what would happen to it, and nothing is written until a
 * button is pressed. *"An import that wrote first and explained afterwards
 * would be one nobody dares run on a second month."*
 *
 * **No checkboxes.** A row's inclusion is its status, exactly as in the
 * statement and calendar imports. A per-row override would be a second place
 * holding the rule the plan already holds.
 *
 * **No file to choose and no range to pick.** The other two read an export off
 * the machine over a window somebody chooses; a trip is a note in the vault and
 * says its own days. So the one control is which trip, and the days come from
 * its stops. The preview still names the days it would touch, because a trip
 * with stops on three of its twelve days should not look like one that writes
 * twelve notes.
 */
import { Modal, Notice, Setting, type App } from 'obsidian';
import type { ExistingEntry } from '@technosoftware/trail-core';
import { t } from '../lang/I18nManager';
import type { NODAtrailSettings } from '../settings/types';
import { readScheduleRange } from './read-schedule-range';
import { readTrips, type TripItinerary } from './read-trip-itinerary';
import { planTripImport, type TripImportPlan, type TripProposal } from './trip-import-plan';
import { writeTripImport } from './write-trip-import';

export interface TripImportDeps {
  app: App;
  getSettings: () => NODAtrailSettings;
  now: () => Date;
  onImported: () => void;
}

/** `09:00-12:00`, `09:00`, or nothing. The preview's own spelling, not the note's. */
function spanOf(proposal: TripProposal): string {
  if (proposal.from && proposal.to) return `${proposal.from}-${proposal.to}`;
  return proposal.from || proposal.to;
}

function statusText(proposal: TripProposal): string {
  switch (proposal.status) {
    case 'new':
      return t('trip.status.new');
    case 'already-present':
      return t('trip.status.alreadyPresent');
    case 'duplicate-in-file':
      return t('trip.status.duplicate');
    case 'not-chosen':
      return t('trip.status.notChosen');
    default:
      return t('trip.status.undated');
  }
}

export class TripImportModal extends Modal {
  private readonly deps: TripImportDeps;
  private trips: TripItinerary[] = [];
  private chosen = 0;
  private plan: TripImportPlan | null = null;
  private busy = false;

  constructor(deps: TripImportDeps) {
    super(deps.app);
    this.deps = deps;
  }

  override onOpen(): void {
    this.trips = readTrips(this.deps.app, this.deps.getSettings());
    void this.render();
  }

  override onClose(): void {
    this.contentEl.empty();
  }

  private async render(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: t('trip.seed') });

    if (this.trips.length === 0) {
      contentEl.createEl('p', { cls: 'nod-import-note', text: t('trip.noTrips') });
      return;
    }

    new Setting(contentEl).setName(t('trip.trip')).addDropdown((drop) => {
      // A loop rather than `forEach`, whose callback returns the component and
      // reads to the lint rule as a discarded promise.
      for (const [index, trip] of this.trips.entries()) {
        drop.addOption(String(index), trip.title);
      }
      drop.setValue(String(this.chosen));
      drop.onChange((value) => {
        this.chosen = Number(value);
        void this.render();
      });
    });

    const trip = this.trips[this.chosen];
    if (!trip) return;

    if (trip.stops.length === 0) {
      contentEl.createEl('p', { cls: 'nod-import-note', text: t('trip.noStops') });
      return;
    }

    this.plan = planTripImport({ trip, existing: await this.existingLines(trip) });
    this.renderSummary(contentEl, this.plan);
    this.renderRows(contentEl, this.plan);
    this.renderFooter(contentEl, this.plan);
  }

  /**
   * The lines the vault already holds on the days this trip could touch.
   *
   * The days come from the stops rather than from the trip's span: a trip is
   * twelve days and its itinerary may name three, and reading nine empty notes
   * to find nothing is nine reads for no answer.
   */
  private async existingLines(trip: TripItinerary): Promise<ExistingEntry[]> {
    const days = [
      ...new Set(trip.stops.map((stop) => stop.day).filter((day): day is string => day !== null)),
    ].sort();
    const held = await readScheduleRange(this.deps.app, this.deps.getSettings(), days);

    const out: ExistingEntry[] = [];
    for (const [day, meetings] of held) {
      for (const entry of meetings.entries) out.push({ day, from: entry.from, text: entry.text });
    }
    return out;
  }

  private renderSummary(parent: HTMLElement, plan: TripImportPlan): void {
    const summary = parent.createDiv({ cls: 'nod-import-summary' });
    summary.createEl('p', {
      text: t('trip.counts', {
        write: String(plan.toWrite),
        present: String(plan.alreadyPresent),
        skipped: String(plan.skipped),
      }),
    });

    if (plan.days.length > 0) {
      summary.createEl('p', { text: t('trip.daysTouched', { days: plan.days.join(', ') }) });
    }

    // Said once, plainly, rather than on every undated row: a trip with no
    // departure has every relative stop undated, and twenty copies of one
    // sentence is how a preview stops being read.
    if (plan.proposals.some((one) => one.status === 'undated')) {
      summary.createEl('p', { cls: 'nod-import-warn', text: t('trip.undated') });
    }
  }

  private renderRows(parent: HTMLElement, plan: TripImportPlan): void {
    const list = parent.createDiv({ cls: 'nod-import-list' });
    for (const proposal of plan.proposals) {
      const line = list.createDiv({ cls: 'nod-import-row' });
      // Written out rather than assembled: a class name built in a template
      // literal is one the stylesheet check cannot see.
      if (proposal.writes) line.addClass('nod-import-ready');
      else if (proposal.status === 'already-present') line.addClass('nod-import-skipped');
      else line.addClass('nod-import-attention');

      line.createSpan({ cls: 'nod-import-date', text: proposal.day });
      line.createSpan({ cls: 'nod-import-time', text: spanOf(proposal) });
      line.createSpan({ cls: 'nod-import-text', text: proposal.text });

      // The place is shown and not written. It belongs on a child line, and the
      // note format does not carry one yet.
      const notes = [statusText(proposal), proposal.excursion ? proposal.place : ''];
      line.createSpan({ cls: 'nod-import-note', text: notes.filter(Boolean).join(' · ') });
    }
  }

  private renderFooter(parent: HTMLElement, plan: TripImportPlan): void {
    const footer = parent.createDiv({ cls: 'nod-import-footer' });
    new Setting(footer).addButton((button) => {
      button
        .setButtonText(t('trip.write'))
        .setCta()
        .setDisabled(plan.toWrite === 0 || this.busy)
        .onClick(() => {
          void this.write();
        });
    });
  }

  private async write(): Promise<void> {
    const plan = this.plan;
    if (!plan || this.busy) return;
    this.busy = true;

    try {
      const result = await writeTripImport(
        this.deps.app,
        this.deps.getSettings(),
        plan.proposals,
        this.deps.now()
      );
      new Notice(
        result.written === 0
          ? t('trip.nothing')
          : t('trip.wrote', { count: String(result.written), days: String(result.notes) })
      );
      this.deps.onImported();
      this.close();
    } finally {
      this.busy = false;
    }
  }
}
