/**
 * The button that opens the paper behind a record.
 *
 * Shared because two lists reach a document by different routes and both draw
 * the same button: the finance cards read the property off the note in front of
 * them, and a statement line follows its reference to the invoice that holds
 * one. What they have in common is only this button, so only this is shared.
 */
import { Menu } from 'obsidian';
import { t } from '../../lang/I18nManager';
import type { CardAction } from './elements';

/** The last segment of a path, which is the only part worth reading in a menu. */
function fileName(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? path : path.slice(index + 1);
}

/**
 * One button, whether the note holds one document or five.
 *
 * A list rather than a nullable action, so a card with no document has no gap
 * where the button would be.
 *
 * **With several, the button opens a menu of filenames rather than the first
 * file.** An invoice and the payment slip that came with it are not
 * interchangeable, and a button that silently picked one of them would be
 * wrong half the time with no way to tell it had chosen. The filename is what
 * distinguishes them, so the filename is what the menu shows.
 *
 * Offered on the values alone. Whether each file is still in the vault is
 * answered when it is opened, because checking every row on every draw would
 * be a lookup per card for a button most of them will never have pressed.
 */
export function documentAction(
  values: readonly string[] | null | undefined,
  open: (value: string) => void
): CardAction[] {
  const paths = (values ?? []).map((value) => value.trim()).filter((value) => value !== '');
  if (paths.length === 0) return [];

  const [only] = paths;
  if (paths.length === 1 && only) {
    return [{ icon: 'file-text', label: t('finance.openDocument'), onClick: () => open(only) }];
  }

  return [
    {
      icon: 'files',
      label: t('finance.openDocuments', { count: paths.length }),
      onClick: (event) => {
        const menu = new Menu();
        for (const path of paths) {
          menu.addItem((item) =>
            item
              .setTitle(fileName(path))
              .setIcon('file-text')
              .onClick(() => open(path))
          );
        }
        menu.showAtMouseEvent(event);
      },
    },
  ];
}
