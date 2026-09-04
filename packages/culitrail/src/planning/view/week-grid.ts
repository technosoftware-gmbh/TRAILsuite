/**
 * The week: a queue strip and seven day columns.
 *
 * Columns are keyed by weekday **key**, and only the header text is
 * translated. Nothing here ever handles a display name, which is what keeps
 * the grid and the note format from disagreeing about what Monday is.
 */
import { App } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { WEEKDAY_KEYS, weekdayLabel, type WeekdayKey } from '../../lang/vocabulary';
import type { CULItrailSettings, MealPlanEntry } from '../../settings/types';
import { groupByDay } from '../meal-plan/entries';
import { makeDropTarget, type DropPayload, type DropPoint } from './drag';
import { renderEntryCard, type EntryCardActions } from './entry-card';

export interface WeekGridActions extends EntryCardActions {
  /** A card or a meal note landing on a column. `day` is undefined for the queue. */
  drop: (payload: DropPayload, day: string | undefined, at: DropPoint) => void;
  /** The `+` on a column header. */
  addTo: (day: string | undefined) => void;
}

function renderColumn(
  container: HTMLElement,
  app: App,
  options: {
    day: WeekdayKey | null;
    label: string;
    entries: MealPlanEntry[];
    settings: CULItrailSettings;
    actions: WeekGridActions;
  }
): void {
  const { day, label, entries, settings, actions } = options;
  const column = container.createDiv({ cls: 'culi-mpv-col' });

  const header = column.createDiv({ cls: 'culi-mpv-col-header' });
  header.createSpan({ cls: 'culi-mpv-col-day', text: label });
  header.createSpan({ cls: 'culi-mpv-col-count', text: String(entries.length) });

  const add = header.createEl('button', {
    cls: 'culi-mpv-col-add',
    text: '+',
    attr: { 'aria-label': t('planning.grid.addTo', { day: label }) },
  });
  add.addEventListener('click', (event) => {
    event.stopPropagation();
    actions.addTo(day ?? undefined);
  });

  const body = column.createDiv({ cls: 'culi-mpv-col-body' });
  if (entries.length === 0) {
    body.createDiv({ cls: 'culi-mpv-col-empty', text: t('planning.grid.dropHere') });
  } else {
    for (const entry of entries) renderEntryCard(body, app, entry, settings, actions);
  }

  // The whole column, not just the body, so a drop onto the header still
  // lands: a column with one card in it is mostly header.
  makeDropTarget(column, day ?? undefined, app, actions.drop);
}

export function renderWeekGrid(
  container: HTMLElement,
  app: App,
  entries: MealPlanEntry[],
  settings: CULItrailSettings,
  actions: WeekGridActions
): void {
  const grid = container.createDiv({ cls: 'culi-mpv-grid' });
  const byDay = groupByDay(entries);

  // The queue is a full-width strip above the days rather than an eighth
  // column: it holds the meals nobody has decided a day for yet, and it fills
  // up and empties on a different rhythm from the days.
  const queued = [
    ...(byDay.get(null) ?? []),
    // An entry whose day is not one of the seven, which a hand-edited note
    // can produce, belongs somewhere visible rather than nowhere.
    ...entries.filter(
      (entry) => entry.day && !(WEEKDAY_KEYS as readonly string[]).includes(entry.day)
    ),
  ];

  renderColumn(grid, app, {
    day: null,
    label: t('planning.grid.queue'),
    entries: queued,
    settings,
    actions,
  });

  const days = grid.createDiv({ cls: 'culi-mpv-days-row' });
  for (const day of WEEKDAY_KEYS) {
    renderColumn(days, app, {
      day,
      label: weekdayLabel(day),
      entries: byDay.get(day) ?? [],
      settings,
      actions,
    });
  }
}
