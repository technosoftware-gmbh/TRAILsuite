/**
 * The image row on a PARA form: what is linked, and two ways to change it.
 *
 * It was a text field alone, with a comment saying a picker "would be better
 * and is not what this is". It is now what this is. The reasoning that stood
 * behind the text field still holds for the field itself -- a vault path and a
 * wikilink both resolve, and pasting what Obsidian puts on the clipboard works
 * -- so the box is kept and editable, and the buttons are added beside it.
 *
 * **Filing happens on submit, not on picking.** An image from outside the vault
 * goes into the note's own folder, and on a form that has not been submitted
 * there is no note and therefore no folder. The same rule the document row
 * follows, for a different reason.
 *
 * The vault picker offers images only. The document one offers everything that
 * is not a note, because a receipt can be a PDF, a scan or an email; a picture
 * is a picture.
 */
import { App, FuzzySuggestModal, Setting, TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { emptyImage, imageLabel, isImageFile, type ImageChoice } from '../../para/image-file';

export interface ImageFieldDeps {
  app: App;
  get: () => ImageChoice;
  set: (choice: ImageChoice) => void;
  /** Redraws the row, so a pick shows up without the form being reopened. */
  refresh: () => void;
}

export function imageField(container: HTMLElement, deps: ImageFieldDeps): void {
  const choice = deps.get();

  const setting = new Setting(container)
    .setName(t('para.image'))
    .setDesc(choice.outside ? t('para.imagePending') : '');

  setting.addText((input) => {
    input
      .setPlaceholder(t('para.imageNone'))
      .setValue(imageLabel(choice))
      .onChange((value) => deps.set({ path: value.trim(), outside: null }));
    // A file chosen from the machine is not a path anybody can edit yet, so the
    // field shows its name and refuses typing over it.
    input.inputEl.disabled = choice.outside !== null;
  });

  setting.addExtraButton((button) => {
    button
      .setIcon('image')
      .setTooltip(t('para.imageFromVault'))
      .onClick(() => {
        new VaultImageSuggest(deps.app, (file) => {
          // Referenced where it is, never moved: see `image-file.ts`. An image
          // can be on several notes and `image:` is a plain path, so moving one
          // can take a picture off a note nobody was editing.
          deps.set({ path: file.path, outside: null });
          deps.refresh();
        }).open();
      });
  });

  setting.addExtraButton((button) => {
    button
      .setIcon('upload')
      .setTooltip(t('para.imageFromDisk'))
      .onClick(() => {
        const input = createEl('input', { type: 'file' });
        input.accept = 'image/*';
        input.addEventListener('change', () => {
          const picked = input.files?.[0];
          if (!picked) return;
          deps.set({ path: '', outside: picked });
          deps.refresh();
        });
        input.click();
      });
  });

  if (choice.path || choice.outside) {
    setting.addExtraButton((button) => {
      button
        .setIcon('x')
        .setTooltip(t('common.remove'))
        .onClick(() => {
          deps.set(emptyImage());
          deps.refresh();
        });
    });
  }
}

/** A quick chooser over the images a vault holds, newest first. */
export class VaultImageSuggest extends FuzzySuggestModal<TFile> {
  constructor(
    app: App,
    private readonly onChoose: (file: TFile) => void
  ) {
    super(app);
    this.setPlaceholder(t('para.imageFromVault'));
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
    this.onChoose(file);
  }
}
