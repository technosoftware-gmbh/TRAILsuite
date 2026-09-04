/**
 * The form controls the meal editor is built from.
 *
 * Here rather than inline in the modal so the modal reads as a list of what a
 * meal has, and so a field's behaviour (a number field that accepts a comma
 * decimal, a textarea that grows with its text) is decided once.
 */
import { App, FuzzySuggestModal, Notice, setIcon, TFile } from 'obsidian';
import { t } from '../../../lang/I18nManager';
import { renderImageCard, usableImageValue } from '../../../ui/images';

/** A number as typed, tolerating a comma decimal separator and an empty field. */
export function parseNumberField(value: string): number | null {
  const text = value.trim().replace(',', '.');
  if (text === '') return null;

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/** A collapsible group of fields, open by default. */
export function fieldGroup(container: HTMLElement, title: string): HTMLElement {
  const group = container.createDiv({ cls: 'culi-edit-group' });

  const header = group.createDiv({ cls: 'culi-edit-group-header' });
  const chevron = header.createSpan({ cls: 'culi-edit-group-chevron' });
  setIcon(chevron, 'chevron-down');
  header.createSpan({ cls: 'culi-edit-group-title', text: title });

  const content = group.createDiv({ cls: 'culi-edit-group-content' });
  header.addEventListener('click', () => {
    const collapsed = group.hasClass('culi-collapsed');
    group.toggleClass('culi-collapsed', !collapsed);
    setIcon(chevron, collapsed ? 'chevron-down' : 'chevron-right');
  });

  return content;
}

export function fieldLabel(container: HTMLElement, text: string): void {
  container.createDiv({ cls: 'culi-edit-label', text });
}

/**
 * A row of fields sharing one line, each returned as a cell to fill.
 *
 * Height is the scarce dimension in this dialog: every field on its own line
 * makes a form that scrolls past a screen for a meal with nothing unusual in
 * it. Two short fields side by side read as the pair they are, and the row wraps
 * on a narrow modal rather than squeezing.
 */
export function fieldRow(container: HTMLElement, count: number): HTMLElement[] {
  const row = container.createDiv({ cls: 'culi-edit-row' });
  return Array.from({ length: count }, () => row.createDiv({ cls: 'culi-edit-row-cell' }));
}

/**
 * Two side-by-side columns at a wide modal, one column when narrow.
 *
 * For the ingredients and instructions groups, which are the two tallest things
 * in the form and are edited together.
 */
export function twoColumns(container: HTMLElement): HTMLElement {
  return container.createDiv({ cls: 'culi-edit-columns' });
}

export function textField(
  container: HTMLElement,
  label: string,
  value: string,
  onChange: (value: string) => void
): void {
  fieldLabel(container, label);
  const input = container.createEl('input', { cls: 'culi-edit-input', attr: { type: 'text' } });
  input.value = value;
  input.addEventListener('input', () => onChange(input.value));
}

/**
 * A labelled dropdown.
 *
 * `value` is matched against the option values, and an option list that does not
 * contain the current value would silently change it the moment the form is saved.
 * Callers are responsible for including it; `supplierOptions()` in the modal is the
 * worked example, and the reason is that a company note can be renamed after a
 * meal named it.
 */
export function selectField(
  container: HTMLElement,
  label: string,
  options: { value: string; label: string }[],
  value: string,
  onChange: (value: string) => void
): void {
  fieldLabel(container, label);
  const select = container.createEl('select', { cls: 'culi-edit-input dropdown' });

  for (const option of options) {
    select.createEl('option', { value: option.value, text: option.label });
  }

  select.value = value;
  select.addEventListener('change', () => onChange(select.value));
}

/**
 * A textarea that grows to fit rather than scrolling inside itself.
 *
 * An ingredients list is the thing being edited; making somebody scroll a
 * four-line window through twenty ingredients while the modal itself also
 * scrolls is two scrollbars for one list.
 */
export function textArea(
  container: HTMLElement,
  value: string,
  onChange: (value: string) => void,
  minimumRows = 4
): HTMLTextAreaElement {
  const area = container.createEl('textarea', { cls: 'culi-edit-textarea' });
  area.value = value;

  // Sized by counting lines rather than by measuring `scrollHeight` and
  // assigning a height. The row count is what a textarea is already sized by,
  // so nothing here touches `element.style`, and a long wrapped line simply
  // wraps rather than being counted twice.
  const grow = (): void => {
    area.rows = Math.max(minimumRows, area.value.split('\n').length + 1);
  };

  area.addEventListener('input', () => {
    onChange(area.value);
    grow();
  });

  grow();
  return area;
}

export interface NumberFieldSpec {
  label: string;
  placeholder: string;
  value: number | null;
  onChange: (value: number | null) => void;
}

/** A row of number fields sharing one line, which is how prep/cook/total read. */
export function numberFieldRow(container: HTMLElement, fields: NumberFieldSpec[]): void {
  const row = container.createDiv({ cls: 'culi-edit-number-row' });

  for (const field of fields) {
    const cell = row.createDiv({ cls: 'culi-edit-number-cell' });
    cell.createSpan({ cls: 'culi-edit-number-label', text: field.label });

    const input = cell.createEl('input', {
      cls: 'culi-edit-input',
      attr: { type: 'text', placeholder: field.placeholder, 'aria-label': field.label },
    });
    // A decimal keypad on a phone, but a text field so a comma separator is
    // not rejected by the browser before it reaches parseNumberField().
    input.inputMode = 'decimal';
    input.value = field.value !== null ? String(field.value) : '';
    input.addEventListener('input', () => field.onChange(parseNumberField(input.value)));
  }
}

/**
 * A row of tappable values, any number of them chosen at once.
 *
 * Allergens are the case this exists for: a dish has three of them as often as
 * one, and a comma-separated text field made somebody remember both the
 * vocabulary and the punctuation. Chips show the vocabulary and the answer in
 * the same place, and there is no spelling to get wrong.
 *
 * **Redrawn from the values on every toggle**, rather than each chip tracking
 * its own state. A chip is a view of one entry in a list; two records of what
 * is chosen is the shape that drifts.
 */
export function chipsField(
  container: HTMLElement,
  label: string,
  choices: readonly string[],
  chosen: readonly string[],
  onChange: (chosen: string[]) => void
): void {
  fieldLabel(container, label);
  const row = container.createDiv({ cls: 'culi-edit-chips' });

  // Case-insensitively, because a note saying `gluten` and a setting saying
  // `Gluten` are one allergen and the chip has to show as pressed for both.
  const isChosen = (value: string): boolean =>
    chosen.some((entry) => entry.trim().toLowerCase() === value.trim().toLowerCase());

  for (const choice of choices) {
    const chip = row.createEl('button', { cls: 'culi-edit-chip', text: choice });
    const on = isChosen(choice);
    chip.toggleClass('culi-edit-chip-on', on);
    // The pressed state has to be readable as well as visible: a colour alone
    // says nothing to a screen reader, and these are the only controls here
    // whose whole meaning is whether they are on.
    chip.setAttr('aria-pressed', String(on));
    chip.setAttr('type', 'button');

    chip.addEventListener('click', (event) => {
      event.preventDefault();
      const next = on
        ? chosen.filter((entry) => entry.trim().toLowerCase() !== choice.trim().toLowerCase())
        : [...chosen, choice];
      onChange(next);
    });
  }
}

export interface ImageFieldDeps {
  app: App;
  label: string;
  get: () => string;
  set: (value: string) => void;
  refresh: () => void;
}

/**
 * The picture of the dish: what it is, and two ways to change it.
 *
 * The property has been read by the gallery and the meal view since long
 * before there was an editor, and the editor was the one place that could not
 * set it. A dish photographed on the day it was cooked had to be attached by
 * editing frontmatter by hand.
 *
 * **The value is kept exactly as the note writes it.** A wikilink stays a
 * wikilink; a path stays a path. Rewriting the shape on save would turn every
 * hand-written `[[dish.jpg]]` in the library into a path the first time
 * somebody opened its meal and pressed save, which is a diff nobody asked for
 * across a hundred notes.
 *
 * A file from the device is written in at Obsidian's own attachment location
 * for this note, so it lands wherever the vault already puts attachments
 * rather than somewhere this plugin invented.
 */
export function imageField(container: HTMLElement, deps: ImageFieldDeps): void {
  fieldLabel(container, deps.label);
  const value = deps.get();

  const row = container.createDiv({ cls: 'culi-edit-image' });

  const input = row.createEl('input', { cls: 'culi-edit-input', type: 'text' });
  input.value = value;
  input.placeholder = t('meals.editor.imageNone');
  input.addEventListener('change', () => deps.set(input.value.trim()));

  const pick = row.createEl('button', { cls: 'culi-edit-image-button', type: 'button' });
  setIcon(pick.createSpan({ cls: 'culi-icon' }), 'image');
  pick.setAttr('aria-label', t('meals.editor.imageFromVault'));
  pick.addEventListener('click', (event) => {
    event.preventDefault();
    new VaultImageSuggest(deps.app, (file) => {
      deps.set(file.path);
      deps.refresh();
    }).open();
  });

  const upload = row.createEl('button', { cls: 'culi-edit-image-button', type: 'button' });
  setIcon(upload.createSpan({ cls: 'culi-icon' }), 'upload');
  upload.setAttr('aria-label', t('meals.editor.imageFromDevice'));
  upload.addEventListener('click', (event) => {
    event.preventDefault();
    const picker = createEl('input', { type: 'file' });
    picker.accept = 'image/*';
    picker.addEventListener('change', () => {
      const chosen = picker.files?.[0];
      if (!chosen) return;
      void writeImageIn(deps.app, chosen).then((path) => {
        if (!path) return;
        deps.set(path);
        deps.refresh();
      });
    });
    picker.click();
  });

  // Shown rather than described. A path is not something anybody can check by
  // reading, and the commonest fault here is a value pointing at a file that
  // moved: the picture is either there or it is not.
  const resolved = usableImageValue(deps.app, value);
  if (resolved) {
    const preview = container.createDiv({ cls: 'culi-edit-image-preview' });
    renderImageCard(preview, deps.app, resolved);
  }
}

/**
 * Writes a chosen file into the vault, at Obsidian's own attachment location.
 *
 * Returns null and says so when the write fails, rather than leaving the field
 * pointing at a file that is not there.
 */
async function writeImageIn(app: App, file: File): Promise<string | null> {
  try {
    const bytes = await file.arrayBuffer();
    const path = await app.fileManager.getAvailablePathForAttachment(file.name);
    const written = await app.vault.createBinary(path, bytes);
    return written.path;
  } catch (error) {
    new Notice(t('meals.editor.imageNotSaved', { reason: String(error) }));
    return null;
  }
}

/** A quick chooser over the images a vault holds. */
class VaultImageSuggest extends FuzzySuggestModal<TFile> {
  constructor(
    app: App,
    private readonly onChoose: (file: TFile) => void
  ) {
    super(app);
    this.setPlaceholder(t('meals.editor.imageFromVault'));
  }

  getItems(): TFile[] {
    const kinds = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'heic']);
    return this.app.vault
      .getFiles()
      .filter((file) => kinds.has(file.extension.toLowerCase()))
      .sort((a, b) => b.stat.mtime - a.stat.mtime);
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile): void {
    this.onChoose(file);
  }
}
