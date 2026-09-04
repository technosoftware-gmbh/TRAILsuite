/**
 * The scaffold every editable list in this plugin is built from.
 *
 * Five lists need the same four things: reorder, add, remove, and a row
 * rendered per entry. Writing that five times would mean five slightly
 * different ideas of what the buttons do and where they sit, and the order of
 * a list is load-bearing in most of those cases (a badge row's layout, a mode's
 * rule weighting, the order a label prints its nutrients in), so getting
 * reorder subtly wrong would be a real bug rather than a cosmetic one.
 *
 * In `ui/` rather than beside the settings tab because the meal editor's two
 * nutrient lists are the same problem, and a copy of this for them would be
 * exactly what it exists to prevent. The three list settings are still its main
 * caller, which is why the labels on its own buttons are `settings.list.*`.
 *
 * A built-in entry can be edited and disabled but not removed. That is the
 * rule for badges and modes alike, and it lives here so neither can forget
 * it: deleting a built-in would leave a vault unable to get it back without
 * clearing `data.json` by hand. A list with no built-ins, such as a nutrient
 * list, simply never says so.
 */
import { setIcon } from 'obsidian';
import { t } from '../lang/I18nManager';
import { moved } from './reorder';

export interface ListEditorOptions<T> {
  items: T[];
  /** Renders the entry's own controls. The move and remove buttons are added around it. */
  renderItem: (row: HTMLElement, item: T, index: number) => void;
  /** Called after any reorder, add or remove, with the new list. */
  onChange: (items: T[]) => void;
  /** Built-ins are kept: they can be edited and disabled, never deleted. */
  isRemovable?: (item: T) => boolean;
  /** Shown as a button under the list. Omitted when the list cannot be added to. */
  addLabel?: string;
  onAdd?: () => T;
  emptyText?: string;
}

export function renderListEditor<T>(container: HTMLElement, options: ListEditorOptions<T>): void {
  const list = container.createDiv({ cls: 'culi-list-editor' });

  if (options.items.length === 0 && options.emptyText) {
    list.createDiv({ cls: 'culi-settings-note', text: options.emptyText });
  }

  options.items.forEach((item, index) => {
    const row = list.createDiv({ cls: 'culi-list-row' });

    const handle = row.createDiv({ cls: 'culi-list-handle' });
    moveButton(handle, 'chevron-up', t('settings.list.moveUp'), index > 0, () =>
      options.onChange(moved(options.items, index, index - 1))
    );
    moveButton(
      handle,
      'chevron-down',
      t('settings.list.moveDown'),
      index < options.items.length - 1,
      () => options.onChange(moved(options.items, index, index + 1))
    );

    options.renderItem(row.createDiv({ cls: 'culi-list-body' }), item, index);

    const removable = options.isRemovable ? options.isRemovable(item) : true;
    if (removable) {
      const remove = row.createEl('button', {
        cls: 'culi-list-remove',
        attr: { 'aria-label': t('settings.list.remove') },
      });
      setIcon(remove.createSpan({ cls: 'culi-icon-slot' }), 'trash-2');
      remove.addEventListener('click', () =>
        options.onChange(options.items.filter((_entry, position) => position !== index))
      );
    } else {
      // A spacer, so the rows above and below a built-in do not shift left.
      row.createSpan({ cls: 'culi-list-remove-spacer' });
    }
  });

  if (options.addLabel && options.onAdd) {
    const add = container.createEl('button', { cls: 'culi-list-add' });
    setIcon(add.createSpan(), 'plus');
    add.createSpan({ text: options.addLabel });
    add.addEventListener('click', () => {
      const created = options.onAdd?.();
      if (created !== undefined) options.onChange([...options.items, created]);
    });
  }
}

function moveButton(
  container: HTMLElement,
  icon: string,
  label: string,
  enabled: boolean,
  onClick: () => void
): void {
  const button = container.createEl('button', {
    cls: 'culi-list-move',
    attr: { 'aria-label': label },
  });
  setIcon(button.createSpan({ cls: 'culi-icon-slot' }), icon);
  // Disabled rather than hidden, so the first and last rows keep the same
  // shape as every other row and nothing shifts as items move.
  button.disabled = !enabled;
  if (enabled) button.addEventListener('click', onClick);
}
