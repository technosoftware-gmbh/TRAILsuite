/**
 * The document row: what is linked, and two ways to change it.
 *
 * A text field alone made somebody type a path they had to go and find first,
 * which meant leaving the dialog. So the row keeps the path visible and
 * editable, and adds a button to pick a file already in the vault and a button
 * to pick one from the machine.
 *
 * **The counterpart of `image-field.ts`, and deliberately a second component
 * rather than a widened first one.** They differ in what they offer and in
 * nothing else, and a picture picker that listed PDFs would be a control that
 * lies about what belongs in the field it fills.
 *
 * **What counts as a document is "not a note"**, which is NODAtrail's answer
 * to the same question and is copied here on purpose rather than improved on.
 * A deck plan is a PDF far more often than not, and a scan, a photograph of a
 * printed plan and an emailed brochure are all the same thing to somebody
 * filing one. The two plugins cannot share the code -- see
 * docs/ui-conventions.md -- so what is shared is the answer.
 *
 * **It files on pick**, where NODAtrail's defers to submit. That difference is
 * not an oversight: NODAtrail files a document into a folder decided by the
 * date on the note, and on a half-filled form that date is still being typed.
 * A deck plan goes beside its vehicle, and the vehicle is already there.
 */
import { App, FuzzySuggestModal, Notice, Setting, TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { chooseDocumentFile, uploadAttachments } from './image-upload';

/** Everything in the vault that is not a note. See the header for why the net is that wide. */
export function isDocumentFile(file: TFile): boolean {
  return file.extension !== 'md';
}

/** A quick chooser over the documents a vault holds, most recently touched first. */
export class VaultDocumentSuggest extends FuzzySuggestModal<TFile> {
  constructor(
    app: App,
    private readonly onPick: (path: string) => void
  ) {
    super(app);
    this.setPlaceholder(t('modals.common.documentPickerHint'));
  }

  getItems(): TFile[] {
    // Newest first: the document somebody is linking is usually the one they
    // just put in the vault, and a fuzzy list ordered by path would bury it
    // under every scan they have ever filed.
    return this.app.vault
      .getFiles()
      .filter(isDocumentFile)
      .sort((a, b) => b.stat.mtime - a.stat.mtime);
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile): void {
    this.onPick(file.path);
  }
}

export interface DocumentFieldOptions {
  app: App;
  label: string;
  /** What the row says under its name. The caller's, because a deck plan and an invoice want different sentences. */
  description: string;
  placeholder?: string;
  get: () => string;
  set: (value: string) => void;
  /** Redraws the form, so the box shows what the picker chose. */
  refresh: () => void;
  /**
   * The note the document belongs to, which decides where a file from the
   * machine lands. Omitted, and the field offers no upload -- the same rule
   * `imageField` follows, and for the same reason: a form that cannot say
   * which note it is editing cannot say where a file of it should go.
   */
  notePath?: () => string;
}

/**
 * A text box holding the value, a button that fills it from the vault, and
 * where the caller can say which note this is, a button that files one from
 * the machine.
 *
 * The box stays editable rather than being replaced by the buttons: a value
 * may be a URL or a path to something the picker cannot list, and a field that
 * only accepted what it could offer would be narrower than the property it
 * writes.
 */
export function documentField(container: HTMLElement, options: DocumentFieldOptions): void {
  const setting = new Setting(container)
    .setName(options.label)
    .setDesc(options.description)
    .addText((input) => {
      if (options.placeholder) input.setPlaceholder(options.placeholder);
      input.setValue(options.get()).onChange((value) => options.set(value.trim()));
    })
    .addExtraButton((button) =>
      button
        .setIcon('folder-open')
        .setTooltip(t('modals.common.documentPickerButton'))
        .onClick(() => {
          new VaultDocumentSuggest(options.app, (path) => {
            options.set(path);
            options.refresh();
          }).open();
        })
    );

  const notePath = options.notePath;
  if (!notePath) return;

  setting.addExtraButton((button) =>
    button
      .setIcon('upload')
      .setTooltip(t('modals.common.documentUploadButton'))
      .onClick(async () => {
        const file = await chooseDocumentFile();
        if (!file) return;

        const { written, failed } = await uploadAttachments(options.app, [file], notePath());
        if (written[0]) options.set(written[0].path);
        if (failed.length > 0) {
          new Notice(t('modals.common.documentUploadFailed', { names: failed.join(', ') }));
        }
        options.refresh();
      })
  );
}
