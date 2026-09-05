/**
 * A date input plus a time input, together producing "YYYY-MM-DDTHH:mm" --
 * or just "YYYY-MM-DD" when no time is given, since a stop with a date but
 * no clock time is a real and common case ("we went to the outlet that
 * morning").
 *
 * Two inputs rather than one datetime-local: Obsidian has no native
 * datetime Setting helper, and a split pair is more forgiving on mobile.
 *
 * Shared by trip-editor-modal.ts and the per-item stop/night/leg editors
 * in item-editor-modals.ts, so every datetime on every form reads and
 * writes the same string shape.
 */
import { Setting } from 'obsidian';
import { dateTimeDatePart, dateTimeTimePart } from '@technosoftware/trail-core';

export function renderDateTimeField(
  container: HTMLElement,
  label: string,
  value: string | null,
  onChange: (value: string | null) => void
): void {
  const setting = new Setting(container).setName(label);
  const dateInput = setting.controlEl.createEl('input', { attr: { type: 'date' } });
  const timeInput = setting.controlEl.createEl('input', { attr: { type: 'time' } });
  dateInput.value = value ? dateTimeDatePart(value) : '';
  timeInput.value = value ? (dateTimeTimePart(value) ?? '') : '';

  const commit = (): void => {
    const date = dateInput.value;
    if (!date) {
      // A time with no date can't be placed on a timeline, so clearing the
      // date clears the whole value rather than leaving a dangling time.
      onChange(null);
      return;
    }
    onChange(timeInput.value ? `${date}T${timeInput.value}` : date);
  };
  dateInput.addEventListener('change', commit);
  timeInput.addEventListener('change', commit);
}

/** A plain date-only field, for values where a clock time is never recorded (accommodation check-in/out). */
export function renderDateField(
  container: HTMLElement,
  label: string,
  value: string | null,
  onChange: (value: string | null) => void
): void {
  new Setting(container).setName(label).addText((text) => {
    text.inputEl.type = 'date';
    text.setValue(value ?? '').onChange((raw) => onChange(raw || null));
  });
}

/**
 * A bare `HH:mm`, for an item that says which day of the trip it is on rather
 * than which date.
 *
 * The counterpart to `renderDateTimeField` above: when a day number is set,
 * the date half is what the day number says and only the clock is left to
 * type. Showing the date input as well would be showing a control whose value
 * is ignored.
 */
export function renderTimeField(
  container: HTMLElement,
  label: string,
  value: string | null,
  onChange: (value: string | null) => void
): void {
  new Setting(container).setName(label).addText((text) => {
    text.inputEl.type = 'time';
    text.setValue(value ?? '').onChange((raw) => onChange(raw || null));
  });
}

/**
 * Which day of the trip an item is on.
 *
 * A plain number, because that is what it is: day one, day two, day twelve.
 * Empty means the item names its own date instead, which is the state every
 * trip written before this existed is in.
 *
 * `hint` says what the number resolves to once the trip has a departure --
 * "4 November 2026" under a 3. Without it the field is a number with no way to
 * check it against the calendar in your head.
 */
export function renderDayField(
  container: HTMLElement,
  label: string,
  hint: string,
  value: number | null,
  onChange: (value: number | null) => void
): void {
  new Setting(container)
    .setName(label)
    .setDesc(hint)
    .addText((text) => {
      text.inputEl.type = 'number';
      text.setValue(value === null ? '' : String(value)).onChange((raw) => {
        const trimmed = raw.trim();
        const parsed = Number(trimmed);
        // Not `|| null`: day 0 is a real answer, for a leg that leaves the
        // evening before the trip starts.
        onChange(trimmed === '' || !Number.isInteger(parsed) ? null : parsed);
      });
    });
}

/** A 1-5 star dropdown with an explicit "none" option -- unrated is a distinct state, not zero. */
export function renderRatingField(
  container: HTMLElement,
  label: string,
  noneLabel: string,
  value: number | null,
  onChange: (value: number | null) => void
): void {
  new Setting(container).setName(label).addDropdown((dd) => {
    dd.addOption('', noneLabel);
    for (const stars of [1, 2, 3, 4, 5]) dd.addOption(String(stars), '★'.repeat(stars));
    dd.setValue(value === null ? '' : String(value)).onChange((raw) => {
      onChange(raw === '' ? null : Number(raw));
    });
  });
}
