/**
 * Editing a note's gallery, in a form: one row per picture, showing the
 * picture.
 *
 * **It used to be two text boxes a row**, a path and a caption, which made
 * every question somebody actually has about a gallery unanswerable. Which of
 * these is the dining car? Is this the one I meant? And above all: reordering
 * a list of filenames you cannot see is barely better than editing the YAML,
 * which is what the reorder buttons would otherwise have been.
 *
 * So the path is a thumbnail. The box holding it is gone rather than hidden: a
 * value that is not a picture shows as an empty frame, which is what a broken
 * path looks like everywhere else in this plugin, and the picker and the
 * upload button both replace it. The one thing lost is typing a path by hand,
 * and that is what the note's own frontmatter is for.
 *
 * Up and down rather than dragging. It matches the itinerary's rows, and
 * dragging is worse with a finger -- this plugin has already shipped one input
 * that did not work on the iPad.
 *
 * Lifted out of the Trip editor when the cover dialog became its second
 * caller. **The labels are passed in** rather than read here: the trip's own
 * keys are `modals.tripEditor.*` and renaming them would move a string every
 * translation already carries, for no gain a reader would notice.
 */
import { App, Notice, setIcon } from 'obsidian';
import { moveInList } from '../../shared/reorder';
import { renderImageCard } from './image-resolve';
import { VaultImageSuggest } from './image-field';
import { chooseImageFiles, uploadAttachments } from './image-upload';
import { t } from '../../lang/I18nManager';

/** One row as a form holds it, which is the trip's own gallery shape. */
export interface GalleryRow {
  image: string;
  caption: string | null;
}

export interface GalleryFieldLabels {
  field: string;
  hint: string;
  add: string;
  empty: string;
  caption: string;
  remove: string;
  moveUp: string;
  moveDown: string;
}

export interface GalleryFieldOptions {
  app: App;
  /** Edited in place: every caller holds this array and reads it back on save. */
  gallery: GalleryRow[];
  /** Where an uploaded picture lands is the vault's decision, and it decides from the note it belongs to. */
  notePath: () => string;
  refresh: () => void;
  labels: GalleryFieldLabels;
}

/**
 * One icon action on a gallery row.
 *
 * A div with `role="button"` rather than a `<button>`, because `setIcon()`
 * aimed at a button element is the iPad defect `tests/icon-slot.test.ts`
 * exists to refuse. Same shape as the itinerary's own row actions.
 */
function galleryAction(
  container: HTMLElement,
  icon: string,
  label: string,
  onClick: () => void,
  disabled = false
): void {
  const btn = container.createDiv({
    cls: 'apt-gallery-action',
    attr: { role: 'button', tabindex: '0', 'aria-label': label, title: label },
  });
  setIcon(btn, icon);
  btn.toggleClass('is-disabled', disabled);
  if (disabled) return;
  btn.addEventListener('click', onClick);
}

/**
 * Adds every picture the file dialog returned, in the order they were chosen.
 *
 * **Appended rather than replacing anything**, because a gallery is built up
 * over several sittings and an upload is somebody adding to it. The new rows
 * carry no caption: a filename is not a caption, and prefilling one would mean
 * somebody has to delete `IMG_4821` from fourteen boxes.
 */
export async function uploadIntoGallery(options: GalleryFieldOptions): Promise<void> {
  const files = await chooseImageFiles();
  if (files.length === 0) return;

  const { written, failed } = await uploadAttachments(options.app, files, options.notePath());
  for (const picture of written) options.gallery.push({ image: picture.path, caption: null });

  if (failed.length > 0) {
    new Notice(t('modals.common.imageUploadFailed', { names: failed.join(', ') }));
  }
  options.refresh();
}

export function galleryRows(container: HTMLElement, options: GalleryFieldOptions): void {
  const { app, gallery, labels, refresh } = options;

  if (gallery.length === 0) {
    container.createEl('p', { text: labels.empty, cls: 'setting-item-description' });
    return;
  }

  const list = container.createDiv({ cls: 'apt-gallery' });

  gallery.forEach((picture, index) => {
    const row = list.createDiv({ cls: 'apt-gallery-row' });

    const thumb = row.createDiv({ cls: 'apt-gallery-thumb' });
    renderImageCard(thumb, app, picture.image);

    const caption = row.createDiv({ cls: 'apt-gallery-caption' });
    const input = caption.createEl('input', {
      cls: 'apt-modal-input',
      attr: { type: 'text', placeholder: labels.caption },
    });
    input.value = picture.caption ?? '';
    input.addEventListener('input', () => {
      picture.caption = input.value.trim() || null;
    });

    const actions = row.createDiv({ cls: 'apt-gallery-actions' });
    galleryAction(actions, 'image', t('modals.common.imagePickerButton'), () => {
      new VaultImageSuggest(app, (path) => {
        picture.image = path;
        refresh();
      }).open();
    });
    galleryAction(
      actions,
      'arrow-up',
      labels.moveUp,
      () => {
        if (moveInList(gallery, index, -1)) refresh();
      },
      index === 0
    );
    galleryAction(
      actions,
      'arrow-down',
      labels.moveDown,
      () => {
        if (moveInList(gallery, index, 1)) refresh();
      },
      index === gallery.length - 1
    );
    galleryAction(actions, 'trash-2', labels.remove, () => {
      gallery.splice(index, 1);
      refresh();
    });
  });
}
