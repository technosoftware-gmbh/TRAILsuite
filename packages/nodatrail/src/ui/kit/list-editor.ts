/**
 * A list of rows, each a few fields, with add, remove and reorder.
 *
 * The one component this plugin genuinely needed and Obsidian does not have.
 * Its property editor renders a list of maps as nested fields with no way to
 * add a row, remove one or move it, which is why a purchase's `items` and a
 * budget's `lines` are the two things NODAtrail edits itself and the only two.
 *
 * **It edits a draft, not a note.** The caller owns an array, this mutates it in
 * place, and nothing is written until the caller says so. That is what makes
 * cancelling a dialog mean what it says.
 *
 * Generic over the row, so the same code serves a purchase line and a budget
 * line: the caller supplies how to make an empty row and how to draw one.
 */
import { setIcon } from 'obsidian';

export interface ListEditorOptions<T> {
  /** The array being edited. Mutated in place. */
  rows: T[];
  /** A new empty row, for the add button. */
  blank: () => T;
  /** Draws one row's fields into the cell it is given. */
  renderRow: (row: T, cell: HTMLElement, redraw: () => void) => void;
  addLabel: string;
  emptyLabel: string;
  /**
   * Called after any structural change, so a dialog can recompute its own
   * summary.
   *
   * The summary is the dialog's rather than this component's, deliberately: a
   * purchase's is three figures and a warning and a budget's is one, and a
   * footer slot here would have been an option with one shape and two very
   * different fillings.
   */
  onChange?: () => void;
}

/**
 * Draws the editor into a container and returns nothing.
 *
 * A redraw is the whole list rather than the one row that changed. The lists
 * here are a handful of rows long, a full redraw is the only way a reorder can
 * be correct without tracking indices in the DOM, and the alternative is the
 * class of bug where row three edits row two's data after a delete.
 */
export function listEditor<T>(container: HTMLElement, options: ListEditorOptions<T>): void {
  const draw = () => {
    container.empty();
    container.addClass('nod-list-editor');

    if (options.rows.length === 0) {
      container.createDiv({ cls: 'nod-empty', text: options.emptyLabel });
    }

    options.rows.forEach((row, index) => {
      const line = container.createDiv({ cls: 'nod-list-row' });
      options.renderRow(row, line.createDiv({ cls: 'nod-list-fields' }), draw);

      const controls = line.createDiv({ cls: 'nod-list-controls' });
      iconButton(controls, 'chevron-up', index > 0, () => {
        move(options.rows, index, index - 1);
        changed();
      });
      iconButton(controls, 'chevron-down', index < options.rows.length - 1, () => {
        move(options.rows, index, index + 1);
        changed();
      });
      iconButton(controls, 'trash-2', true, () => {
        options.rows.splice(index, 1);
        changed();
      });
    });

    const add = container.createEl('button', { cls: 'nod-list-add' });
    setIcon(add.createSpan({ cls: 'nod-icon' }), 'plus');
    add.createSpan({ text: options.addLabel });
    add.addEventListener('click', () => {
      options.rows.push(options.blank());
      changed();
    });
  };

  const changed = () => {
    options.onChange?.();
    draw();
  };

  draw();
}

/** A small icon button. Disabled rather than hidden, so the row keeps its shape as it moves. */
function iconButton(
  parent: HTMLElement,
  icon: string,
  enabled: boolean,
  onClick: () => void
): void {
  const button = parent.createEl('button', { cls: 'nod-list-button' });
  setIcon(button.createSpan({ cls: 'nod-icon' }), icon);
  button.disabled = !enabled;
  if (enabled) button.addEventListener('click', () => onClick());
}

function move<T>(rows: T[], from: number, to: number): void {
  const [row] = rows.splice(from, 1);
  if (row !== undefined) rows.splice(to, 0, row);
}
