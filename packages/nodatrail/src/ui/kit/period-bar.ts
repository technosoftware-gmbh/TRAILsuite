/**
 * The month, quarter or year a view is showing, and the control for changing it.
 *
 * **One implementation, because two would drift.** The ledger and the finance
 * view both ask a period question, and a person moving between them expects the
 * same three levels, the same arrows and the same title. Two copies of a
 * navigation control agree on the day they are written and disagree by the
 * second release: one gains a level, one changes the fallback, and the same
 * month is called two things in two tabs.
 *
 * Held by the view rather than passed around, because the chosen period is
 * state a view keeps between renders.
 */
import {
  parsePeriodTitle,
  periodRange,
  periodTitle,
  shiftPeriod,
} from '@technosoftware/trail-core';
import { t } from '../../lang/I18nManager';

/**
 * The levels offered, coarsest last.
 *
 * Day and week exist in `trail-core` and are deliberately not here: a balance
 * sheet for one day is a question somebody can ask by other means, and three
 * choices in a dropdown is a control nobody has to read.
 */
export const PERIOD_LEVELS = ['month', 'quarter', 'year'] as const;
export type PeriodLevel = (typeof PERIOD_LEVELS)[number];

export class PeriodPicker {
  private level: PeriodLevel;
  /** Null while the period follows today, which is what a view opens on. */
  private chosen: string | null = null;

  constructor(
    private readonly today: () => Date,
    level: PeriodLevel = 'year'
  ) {
    this.level = level;
  }

  /** The period on screen, as its title: `2026`, `2026-Q1`, `2026-03`. */
  label(): string {
    return this.chosen ?? periodTitle(this.level, this.today());
  }

  /** The period on screen as a date, falling back to today when it cannot be read. */
  date(): Date {
    return parsePeriodTitle(this.level, this.label()) ?? this.today();
  }

  /** The period as two ISO days, inclusive at both ends. */
  range(): { from: string; to: string } {
    return periodRange(this.level, this.date());
  }

  /** True when an ISO day falls in the period on screen. Null never does. */
  holds(day: string | null): boolean {
    if (!day) return false;
    const { from, to } = this.range();
    return day >= from && day <= to;
  }

  /** True when an ISO day falls before the period on screen. */
  precedes(day: string | null): boolean {
    return day !== null && day < this.range().from;
  }

  /**
   * Draws the bar. `onChange` is called after the period moves, and is the
   * view's cue to render again.
   */
  render(parent: HTMLElement, onChange: () => void): void {
    const bar = parent.createDiv({ cls: 'nod-period-bar' });

    const back = bar.createEl('button', { text: '<' });
    back.setAttribute('aria-label', t('period.previous'));
    back.addEventListener('click', () => {
      this.step(-1);
      onChange();
    });

    const select = bar.createEl('select');
    select.setAttribute('aria-label', t('period.level'));
    for (const level of PERIOD_LEVELS) {
      const option = select.createEl('option', { value: level, text: t(`period.${level}`) });
      if (level === this.level) option.selected = true;
    }
    select.addEventListener('change', () => {
      this.level = (select.value as PeriodLevel) ?? 'year';
      // Back to following today: a month title cannot be read as a year, and
      // keeping it would leave the bar showing a period the level cannot parse.
      this.chosen = null;
      onChange();
    });

    bar.createSpan({ cls: 'nod-period-bar-title', text: this.label() });

    const forward = bar.createEl('button', { text: '>' });
    forward.setAttribute('aria-label', t('period.next'));
    forward.addEventListener('click', () => {
      this.step(1);
      onChange();
    });
  }

  private step(by: number): void {
    this.chosen = periodTitle(this.level, shiftPeriod(this.level, this.date(), by));
  }
}
