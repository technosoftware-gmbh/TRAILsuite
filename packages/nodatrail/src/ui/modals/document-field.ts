/**
 * The document row on a money form: what is linked, and two ways to change it.
 *
 * A text field alone made somebody type a path they had to find first, which
 * meant leaving the form. So the row keeps the path visible and editable, and
 * adds two buttons: pick a file already in the vault, or pick one from the
 * machine. Both file it beside the note.
 *
 * **Filing happens on submit, not on picking.** The folder a document belongs
 * in is decided by the date on the note, and on a half-filled form that date is
 * still being typed. Moving a file to the wrong month and moving it back is
 * worse than waiting until there is something to be right about.
 */
import { App, FuzzySuggestModal, Setting, TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';

/** What the form holds about a document until it is filed. */
export interface DocumentChoice {
  /** A path already in the vault, or ''. */
  path: string;
  /** A file from outside the vault, chosen but not yet written in. */
  outside: File | null;
}

export function emptyDocument(): DocumentChoice {
  return { path: '', outside: null };
}

/** What to show for a choice: a path, a pending filename, or nothing. */
export function documentLabel(choice: DocumentChoice): string {
  if (choice.outside) return choice.outside.name;
  return choice.path;
}

export interface DocumentFieldDeps {
  app: App;
  get: () => DocumentChoice;
  set: (choice: DocumentChoice) => void;
  /** Redraws the row, so a pick shows up without the form being reopened. */
  refresh: () => void;
}

export function documentField(container: HTMLElement, deps: DocumentFieldDeps): void {
  const choice = deps.get();

  const setting = new Setting(container)
    .setName(t('finance.document'))
    .setDesc(choice.outside ? t('finance.documentPending') : '');

  setting.addText((input) => {
    input
      .setPlaceholder(t('finance.documentNone'))
      .setValue(documentLabel(choice))
      .onChange((value) => deps.set({ path: value.trim(), outside: null }));
    // A file chosen from the machine is not a path anybody can edit yet, so the
    // field shows its name and refuses typing over it.
    input.inputEl.disabled = choice.outside !== null;
  });

  setting.addExtraButton((button) => {
    button
      .setIcon('folder-open')
      .setTooltip(t('finance.documentFromVault'))
      .onClick(() => {
        new VaultDocumentSuggest(deps.app, (file) => {
          deps.set({ path: file.path, outside: null });
          deps.refresh();
        }).open();
      });
  });

  setting.addExtraButton((button) => {
    button
      .setIcon('upload')
      .setTooltip(t('finance.documentFromDisk'))
      .onClick(() => {
        const input = createEl('input', { type: 'file' });
        input.accept = '.pdf,.png,.jpg,.jpeg,.webp,.txt,.eml';
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
          deps.set(emptyDocument());
          deps.refresh();
        });
    });
  }
}

/** A quick chooser over the files a vault holds that are not notes. */
export class VaultDocumentSuggest extends FuzzySuggestModal<TFile> {
  constructor(
    app: App,
    private readonly onChoose: (file: TFile) => void
  ) {
    super(app);
    this.setPlaceholder(t('finance.documentFromVault'));
  }

  getItems(): TFile[] {
    // Everything that is not a note: a document is a PDF far more often than
    // not, but a scan, a photograph of a receipt and an email all qualify.
    return this.app.vault
      .getFiles()
      .filter((file) => file.extension !== 'md')
      .sort((a, b) => b.stat.mtime - a.stat.mtime);
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile): void {
    this.onChoose(file);
  }
}

/**
 * The document rows on a money form: one per file, and always a blank one.
 *
 * An invoice arrives as a covering letter and a payment slip often enough that
 * one row was not enough, and a two-page invoice scanned in two goes is the
 * same shape.
 *
 * **The blank row at the end is how another is added**, rather than an "add"
 * button beside a list. Picking into it fills it, the redraw grows a new blank
 * one below, and a form with no documents looks exactly as it did before this
 * existed: one empty row. There is no state where the reader has to know that
 * a button adds something before they can add anything.
 *
 * Empty rows are dropped on the way out by `fileDocumentChoices`, so the blank
 * one never becomes a path.
 */
export function documentFields(
  container: HTMLElement,
  deps: {
    app: App;
    get: () => DocumentChoice[];
    set: (choices: DocumentChoice[]) => void;
    refresh: () => void;
  }
): void {
  const filled = deps.get().filter((choice) => choice.path !== '' || choice.outside !== null);
  const rows = [...filled, emptyDocument()];

  rows.forEach((choice, index) => {
    documentField(container, {
      app: deps.app,
      get: () => choice,
      set: (next) => {
        const changed = [...rows];
        changed[index] = next;
        deps.set(changed.filter((row) => row.path !== '' || row.outside !== null));
      },
      refresh: deps.refresh,
    });
  });
}
