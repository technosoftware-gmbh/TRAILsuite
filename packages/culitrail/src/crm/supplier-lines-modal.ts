/**
 * The ranges a supplier publishes, edited where they are used.
 *
 * The meal editor has offered a dropdown of a company's lines for as long as
 * the field has existed, and nothing has ever written that property: a
 * dropdown with a reader and no writer, so the only way to fill it in was to
 * type YAML into the company note by hand.
 *
 * **Here rather than on the company form**, which lives in NODAtrail. The
 * company terms are CULItrail's alone by a recorded decision -- see
 * `architecture.md` section 12 -- and they stay that way until a second plugin
 * needs them. A form in the other plugin writing them would overturn that
 * quietly, and the two-consumer test is the thing that is supposed to decide
 * it, not convenience.
 *
 * Only the lines. The rest of a company's terms are prices and ladders that
 * belong on the settings page beside the rest of the ordering configuration;
 * this is the one field a person reaches for while looking at a meal.
 */
import { App, FuzzySuggestModal, Notice, TFile } from 'obsidian';
import { readStringList } from 'trail-core';
import { t } from '../lang/I18nManager';
import { addFooterButtons, BaseModal } from '../ui/base-modal';
import { renderListEditor } from '../ui/list-editor';
import { hostFor } from '../shared/vault-host';
import type { CULItrailSettings } from '../settings/types';

export class SupplierLinesModal extends BaseModal {
  private lines: string[] = [];

  constructor(
    app: App,
    private readonly file: TFile,
    private readonly companyTitle: string,
    private readonly settings: CULItrailSettings,
    private readonly onSaved: () => void
  ) {
    super(app);
  }

  getTitle(): string {
    return t('meals.lines.title');
  }

  getSubtitle(): string {
    return this.companyTitle;
  }

  getIcon(): string {
    return 'layers';
  }

  renderBody(body: HTMLElement): void {
    const frontmatter = this.app.metadataCache.getFileCache(this.file)?.frontmatter ?? {};
    this.lines = readStringList(frontmatter[this.settings.companyLinesProperty]);
    this.renderList(body);
  }

  private renderList(body: HTMLElement): void {
    body.empty();
    body.createDiv({ cls: 'culi-settings-note', text: t('meals.lines.hint') });

    renderListEditor(body, {
      items: this.lines,
      addLabel: t('meals.lines.add'),
      emptyText: t('meals.lines.empty'),
      onAdd: () => '',
      onChange: (items) => {
        this.lines = items;
        this.renderList(body);
      },
      renderItem: (row, item, index) => {
        const input = row.createEl('input', { cls: 'culi-edit-input', type: 'text' });
        input.value = item;
        input.placeholder = t('meals.lines.placeholder');
        // **Written into the same array `renderListEditor` was handed**, not a
        // new one. Its Add button builds the next list from the array it
        // captured when it drew, so replacing `this.lines` with a fresh array
        // left that capture holding the text as it was before anybody typed:
        // the first line came back blank the moment a second was added, unless
        // it had been saved in between.
        //
        // On input rather than on change, so a line typed and then saved
        // without leaving the field is not lost either.
        input.addEventListener('input', () => {
          this.lines[index] = input.value;
        });
      },
    });
  }

  renderFooter(footer: HTMLElement): void {
    addFooterButtons(footer, {
      confirmLabel: t('meals.lines.save'),
      onCancel: () => this.close(),
      onConfirm: () => void this.save(),
    });
  }

  /**
   * Writes the list, or removes the property when it is empty.
   *
   * Blanks are dropped rather than written: an empty row is a row somebody
   * added and did not fill in, and a line named `''` would be an option in the
   * meal editor that says nothing and selects nothing.
   */
  private async save(): Promise<void> {
    const kept = this.lines.map((line) => line.trim()).filter((line) => line !== '');
    const key = this.settings.companyLinesProperty.trim();
    if (!key) {
      new Notice(t('meals.lines.noProperty'));
      return;
    }

    try {
      await hostFor(this.app).frontmatter.process(this.file, (frontmatter) => {
        if (kept.length > 0) frontmatter[key] = kept;
        else delete frontmatter[key];
      });
      this.onSaved();
      this.close();
    } catch (error) {
      new Notice(t('meals.lines.notSaved', { reason: String(error) }));
    }
  }
}

/**
 * Picks the supplier whose lines to edit.
 *
 * The command's way in, for the case the meal editor's link cannot cover: a
 * supplier that has no meals yet has no meal to open, and its lines have to be
 * enterable before the first meal from it is written rather than after.
 */
export class SupplierLinesPicker extends FuzzySuggestModal<{ file: TFile; title: string }> {
  constructor(
    app: App,
    private readonly companies: { file: TFile; title: string }[],
    private readonly onChoose: (company: { file: TFile; title: string }) => void
  ) {
    super(app);
    this.setPlaceholder(t('meals.lines.edit'));
  }

  getItems(): { file: TFile; title: string }[] {
    return this.companies;
  }

  getItemText(company: { file: TFile; title: string }): string {
    return company.title;
  }

  onChooseItem(company: { file: TFile; title: string }): void {
    this.onChoose(company);
  }
}
