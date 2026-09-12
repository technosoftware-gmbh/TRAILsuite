/**
 * The form every creation modal is built from.
 *
 * A small builder over Obsidian's `Setting`, so each modal reads as the list of
 * fields it has rather than as a wall of builder chains, and so the submit
 * button, the validation and the error line are written once.
 *
 * **A title is required and everything else is not.** A note somebody creates
 * with only a title is a note they can finish later; a modal that demanded six
 * fields first is a modal they close.
 */
import { App, Modal, Notice, Setting } from 'obsidian';
import { t } from '../../lang/I18nManager';

export abstract class FormModal extends Modal {
  protected error: HTMLElement | null = null;

  constructor(app: App) {
    super(app);
  }

  /** Draws the fields. Called once, into a container above the buttons. */
  protected abstract fields(container: HTMLElement): void;

  /** Does the work. Anything it throws is shown on the error line rather than swallowed. */
  protected abstract submit(): Promise<void>;

  protected abstract heading(): string;

  /**
   * Why the form cannot be saved yet, or null when it can.
   *
   * **Override this rather than `canSubmit`.** The error line used to read
   * "Untitled" whatever was missing, which is what a placeholder looks like
   * when it escapes: it named a field most of these forms do not have, and told
   * somebody staring at two empty account pickers nothing at all. A form that
   * knows what it is waiting for should say so.
   *
   * `canSubmit` derives from this, so implementing one of the two is enough and
   * the two cannot disagree. A form that overrides `canSubmit` instead keeps
   * working and gets the general message.
   */
  protected blocker(): string | null {
    return null;
  }

  /** True when the form holds enough to write a note. Checked on submit only, so typing is never interrupted. */
  protected canSubmit(): boolean {
    return this.blocker() === null;
  }

  /**
   * Reads whatever the form needs out of the vault before it is drawn.
   *
   * Nothing, for a form whose fields all come from the frontmatter the caller
   * already has. A form with a field living in a note's **body** has to read the
   * file, and a constructor cannot await.
   */
  protected async load(): Promise<void> {}

  /**
   * Opens the form, once `load()` has run.
   *
   * **A form whose load failed does not open.** It would come up with the box
   * for a body it could not read empty, and saving it would then write that
   * emptiness over text nobody had seen. Refusing is the only honest outcome:
   * the note is unreadable right now and the dialog cannot help.
   */
  async openLoaded(): Promise<void> {
    try {
      await this.load();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error));
      return;
    }
    this.open();
  }

  onOpen(): void {
    this.contentEl.addClass('nod-form');
    this.setTitle(this.heading());

    this.fields(this.contentEl.createDiv({ cls: 'nod-form-fields' }));
    this.error = this.contentEl.createDiv({ cls: 'nod-form-error' });

    const buttons = new Setting(this.contentEl).addButton((button) =>
      button.setButtonText(t('common.cancel')).onClick(() => this.close())
    );
    // Between Cancel and Save rather than beside Save, so the destructive one
    // is never the button next to the one somebody is reaching for.
    for (const extra of this.extraButtons()) {
      buttons.addButton((button) => {
        button.setButtonText(extra.label).onClick(() => void this.runExtra(extra));
        // Obsidian's own class rather than `setDestructive()`, which needs
        // 1.13 and this plugin's manifest says 1.12.
        if (extra.warning) button.buttonEl.addClass('mod-warning');
      });
    }
    buttons.addButton((button) =>
      button
        .setButtonText(t('common.save'))
        .setCta()
        .onClick(() => void this.trySubmit())
    );
  }

  /**
   * Buttons besides Cancel and Save, for a form that can do something else to
   * the thing it is editing. Empty for a form that only creates.
   *
   * They do not go through `blocker()`: deleting an entry does not require the
   * form to hold enough to write one, and a Delete refused because a field was
   * blank would be a dialog somebody cannot get out of.
   */
  protected extraButtons(): { label: string; warning: boolean; run: () => Promise<void> }[] {
    return [];
  }

  private async runExtra(extra: { run: () => Promise<void> }): Promise<void> {
    try {
      await extra.run();
      this.close();
    } catch (error) {
      this.showError(error instanceof Error ? error.message : String(error));
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }

  /**
   * Draws the form again, for a field whose options depend on another.
   *
   * Rare on purpose. A form that redraws while somebody types loses the cursor,
   * so this is called from a button rather than from a change handler.
   */
  protected rerender(): void {
    this.contentEl.empty();
    this.onOpen();
  }

  private async trySubmit(): Promise<void> {
    if (!this.canSubmit()) {
      this.showError(this.blocker() ?? t('common.incomplete'));
      return;
    }

    try {
      await this.submit();
      this.close();
    } catch (error) {
      // Shown in the modal rather than as a notice, because the form is still
      // open and the thing that failed is on screen.
      this.showError(error instanceof Error ? error.message : String(error));
    }
  }

  protected showError(message: string): void {
    if (this.error) this.error.setText(message);
  }

  /** A text field. */
  protected text(
    container: HTMLElement,
    name: string,
    get: () => string,
    set: (value: string) => void,
    placeholder = ''
  ): void {
    new Setting(container).setName(name).addText((input) => {
      input.setValue(get()).setPlaceholder(placeholder).onChange(set);
    });
  }

  /**
   * A text field another field can write into.
   *
   * Returns a setter that puts a new value in the input where it stands.
   * `rerender()` would show the same value and would take the cursor with it,
   * which is exactly wrong for a field that changes while somebody types in the
   * one below it.
   */
  protected followedText(
    container: HTMLElement,
    name: string,
    get: () => string,
    set: (value: string) => void,
    placeholder = ''
  ): (value: string) => void {
    let write: (value: string) => void = () => {};
    new Setting(container).setName(name).addText((input) => {
      input.setValue(get()).setPlaceholder(placeholder).onChange(set);
      write = (value: string): void => {
        input.setValue(value);
      };
    });
    return write;
  }

  /** A number field. A blank value clears it rather than reading as zero: unpriced and free are different facts. */
  protected number(
    container: HTMLElement,
    name: string,
    get: () => number | null,
    set: (value: number | null) => void
  ): void {
    new Setting(container).setName(name).addText((input) => {
      input.inputEl.type = 'number';
      input.setValue(get() === null ? '' : String(get())).onChange((raw) => {
        const trimmed = raw.trim();
        const parsed = Number(trimmed);
        set(trimmed === '' || !Number.isFinite(parsed) ? null : parsed);
      });
    });
  }

  /** A date field, which Obsidian's own input renders as a picker. */
  protected date(
    container: HTMLElement,
    name: string,
    get: () => string | null,
    set: (value: string | null) => void
  ): void {
    new Setting(container).setName(name).addText((input) => {
      input.inputEl.type = 'date';
      input.setValue(get() ?? '').onChange((raw) => set(raw.trim() || null));
    });
  }

  /**
   * A date the form shows and cannot change.
   *
   * Not the same thing as leaving the field off. A note's creation date is
   * worth seeing on the form that edits it -- it is how a back-dated project is
   * recognised as back-dated -- and it is not worth writing: `created` is
   * stamped once and never rewritten, so a box that accepted a new value would
   * be promising something the save does not do.
   */
  protected shownDate(container: HTMLElement, name: string, get: () => string | null): void {
    new Setting(container).setName(name).addText((input) => {
      input.inputEl.type = 'date';
      input.setValue(get() ?? '');
      input.setDisabled(true);
    });
  }

  /** A dropdown over a fixed vocabulary. */
  protected select(
    container: HTMLElement,
    name: string,
    choices: readonly [string, string][],
    get: () => string,
    set: (value: string) => void
  ): void {
    new Setting(container).setName(name).addDropdown((dropdown) => {
      for (const [value, label] of choices) dropdown.addOption(value, label);
      dropdown.setValue(get()).onChange(set);
    });
  }

  /** A sentence under the field above it, for a rule that is not obvious from the label. */
  protected hint(container: HTMLElement, text: string): void {
    new Setting(container).setDesc(text).settingEl.addClass('nod-form-note');
  }

  /** A clock time, which Obsidian's own input renders as a picker. */
  protected time(
    container: HTMLElement,
    name: string,
    get: () => string,
    set: (value: string) => void
  ): void {
    new Setting(container).setName(name).addText((input) => {
      input.inputEl.type = 'time';
      input.setValue(get()).onChange((raw) => set(raw.trim()));
    });
  }

  /**
   * A several-line text box.
   *
   * Wider and taller than Obsidian's own `addTextArea` default, because every
   * use of this so far is a list of short lines rather than a sentence, and a
   * three-row box makes a list of six look like a mistake.
   */
  protected multiline(
    container: HTMLElement,
    name: string,
    description: string,
    get: () => string,
    set: (value: string) => void
  ): void {
    new Setting(container)
      .setName(name)
      .setDesc(description)
      // The row is marked as well as the box. A textarea at `width: 100%` is
      // 100% of Obsidian's control column, which does not grow -- so the box
      // stayed a small square however tall it was told to be, and a long
      // description pushed it smaller still by taking the rest of the row. The
      // class lets the stylesheet give this one row's control the width and
      // hold the description to a column beside it.
      .setClass('nod-form-multiline')
      .addTextArea((input) => {
        input.inputEl.addClass('nod-form-area');
        input.setValue(get()).onChange(set);
      });
  }

  /** A yes or no, with room for the sentence that says what it means. */
  protected toggle(
    container: HTMLElement,
    name: string,
    description: string,
    get: () => boolean,
    set: (value: boolean) => void
  ): void {
    new Setting(container)
      .setName(name)
      .setDesc(description)
      .addToggle((input) => {
        input.setValue(get()).onChange(set);
      });
  }
}
