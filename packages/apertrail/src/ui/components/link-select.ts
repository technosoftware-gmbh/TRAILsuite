/**
 * One dropdown that names another note, plus a way out when the note it
 * should name does not exist yet.
 *
 * Four modals were building this control by hand, character for character: a
 * field, a label, a select, a "none" option, then one option per title. The
 * copies being identical is the usual sign, but the reason to gather them is
 * the two rules below rather than the duplication.
 *
 * **A title the vault no longer has is still offered.** A place whose city
 * note was renamed or deleted still SAYS that city in its frontmatter, and a
 * dropdown that silently dropped the value would erase the link the first
 * time somebody saved an unrelated field on that note.
 *
 * **Creating the missing note is an option in the list, not a side effect.**
 * Choosing it opens that note's own creation dialog, which is where a name is
 * typed and confirmed; nothing is written until somebody presses Create
 * there. The select returns to what it was showing the instant that dialog
 * opens, so a cancelled creation leaves the field exactly as it was found and
 * this control needs no way to hear that a dialog closed.
 */

/**
 * Impossible as a note title, so it can never collide with one being offered.
 *
 * A NUL rather than a readable sentinel: the stylesheet test reads the source
 * for strings carrying this package's CSS prefix and takes them for class
 * names, comments included, so a sentinel spelled that way fails a test about
 * something else entirely.
 */
export const CREATE_NEW_VALUE = '\u0000create-new';

export interface LinkSelectOptions {
  /** The notes that exist, in the order they should be offered. */
  titles: string[];
  /** What the note says today. Offered even when the vault no longer has it. */
  value: string;
  /** The empty choice, which every one of these links is allowed to be. */
  noneLabel: string;
  onChange: (title: string) => void;
  /** Both of these, or neither: the last option is only offered when something can act on it. */
  createLabel?: string;
  onCreateNew?: (adopt: (title: string) => void) => void;
}

/**
 * Builds only the control, into whatever element it is given.
 *
 * The row around it -- the name, the description -- belongs to the caller,
 * which lets the same control sit inside an Obsidian `Setting` without this
 * module knowing what a `Setting` is.
 */
export function renderLinkSelect(
  container: HTMLElement,
  options: LinkSelectOptions
): HTMLSelectElement {
  const select = container.createEl('select', { cls: 'apt-modal-select dropdown' });

  const canCreate = options.createLabel !== undefined && options.onCreateNew !== undefined;
  const offered = [...options.titles];
  let chosen = options.value.trim();
  if (chosen && !offered.includes(chosen)) offered.unshift(chosen);

  const rebuild = (): void => {
    select.empty();
    select.createEl('option', { attr: { value: '' }, text: options.noneLabel });
    for (const title of offered) {
      select.createEl('option', { attr: { value: title }, text: title });
    }
    // Last, always: a note created while the dialog was open must not push
    // the way to create another one into the middle of the list.
    if (canCreate) {
      select.createEl('option', {
        attr: { value: CREATE_NEW_VALUE },
        text: options.createLabel ?? '',
      });
    }
    select.value = chosen;
  };

  const adopt = (title: string): void => {
    const trimmed = title.trim();
    if (!trimmed) return;
    if (!offered.includes(trimmed)) offered.push(trimmed);
    chosen = trimmed;
    rebuild();
    options.onChange(trimmed);
  };

  select.addEventListener('change', () => {
    if (select.value === CREATE_NEW_VALUE) {
      // Restored before the dialog opens rather than after it closes, which
      // is what saves this control from needing to know the dialog exists.
      select.value = chosen;
      options.onCreateNew?.(adopt);
      return;
    }
    chosen = select.value;
    options.onChange(chosen);
  });

  rebuild();
  return select;
}
