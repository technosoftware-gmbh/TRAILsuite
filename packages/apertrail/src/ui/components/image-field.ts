/**
 * Choosing a picture for a note, in a form.
 *
 * APERtrail had no image input at all: the gallery card read a hardcoded
 * `image` key and the data model called it cosmetic and hand-edited, so the
 * only way to give a trip a picture was to type a path into the frontmatter.
 * That is why this exists.
 *
 * **Written for this package rather than shared.** NODAtrail and CULItrail both
 * have one, and `tests/licence-boundary.test.ts` fails the build on a file that
 * crossed between packages -- the two PolyForm plugins are no more allowed to
 * borrow from each other than either is from the GPL one. The shape is the
 * same because the problem is; the code is not.
 *
 * **A picture already in the vault is referenced, never moved.** A photo lives
 * where its owner filed it, and a plugin that relocated attachments to suit its
 * own folder convention would be rearranging somebody's vault to make its own
 * paths tidier.
 */
import { App, FuzzySuggestModal, Notice, Setting, TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { chooseImageFiles, uploadPictures } from './image-upload';

/** Extensions Obsidian renders as a picture. */
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif']);

export function isImageFile(file: TFile): boolean {
  return IMAGE_EXTENSIONS.has(file.extension.toLowerCase());
}

/**
 * Every image in the vault, newest first.
 *
 * Newest rather than alphabetical because the picture somebody wants is
 * overwhelmingly the one they just put there.
 */
export class VaultImageSuggest extends FuzzySuggestModal<TFile> {
  constructor(
    app: App,
    private readonly onPick: (path: string) => void
  ) {
    super(app);
    this.setPlaceholder(t('modals.common.imagePickerHint'));
  }

  getItems(): TFile[] {
    return this.app.vault
      .getFiles()
      .filter(isImageFile)
      .sort((a, b) => b.stat.mtime - a.stat.mtime);
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile): void {
    this.onPick(file.path);
  }
}

export interface ImageFieldOptions {
  app: App;
  label: string;
  get: () => string;
  set: (value: string) => void;
  /** Redraws the form, so the box shows what the picker chose. */
  refresh: () => void;
  /**
   * The note the picture belongs to, which decides where an uploaded file
   * lands. Omitted, and the field offers no upload: a form that cannot say
   * which note it is editing cannot say where a picture of it should go, and
   * guessing the vault root would file somebody's hero picture nowhere near
   * their trip.
   */
  notePath?: () => string;
}

/**
 * A text box holding the value, and a button that fills it from the vault.
 *
 * The box stays editable rather than being replaced by the button: a value may
 * be a URL or a path to something the picker cannot list, and a field that only
 * accepted what it could offer would be narrower than the property it writes.
 */
export function imageField(container: HTMLElement, options: ImageFieldOptions): void {
  const setting = new Setting(container)
    .setName(options.label)
    .setDesc(t('modals.common.imageFieldHint'))
    .addText((input) =>
      input.setValue(options.get()).onChange((value) => options.set(value.trim()))
    )
    .addExtraButton((button) =>
      button
        .setIcon('image')
        .setTooltip(t('modals.common.imagePickerButton'))
        .onClick(() => {
          new VaultImageSuggest(options.app, (path) => {
            options.set(path);
            options.refresh();
          }).open();
        })
    );

  const notePath = options.notePath;
  if (!notePath) return;

  // Only the first file is used here: this field holds one picture, and
  // silently discarding the other thirteen would be worse than the dialog
  // offering a choice it cannot honour -- so the input takes one at a time.
  setting.addExtraButton((button) =>
    button
      .setIcon('upload')
      .setTooltip(t('modals.common.imageUploadButton'))
      .onClick(async () => {
        const files = await chooseImageFiles();
        const first = files[0];
        if (!first) return;

        const { written, failed } = await uploadPictures(options.app, [first], notePath());
        if (written[0]) options.set(written[0].path);
        if (failed.length > 0) {
          new Notice(t('modals.common.imageUploadFailed', { names: failed.join(', ') }));
        }
        options.refresh();
      })
  );
}
