/**
 * A single folder-path settings field, backed by Obsidian's own folder
 * autocomplete (FolderSuggest). Every folder setting renders through this,
 * so path normalization and the suggest wiring are defined once.
 */
import { App, Setting, normalizePath } from 'obsidian';
import { FolderSuggest } from './folder-suggest';

export function renderFolderField(
  containerEl: HTMLElement,
  app: App,
  name: string,
  desc: string,
  value: string,
  placeholder: string,
  onChange: (value: string) => Promise<void>
): void {
  const setting = new Setting(containerEl).setName(name).setDesc(desc);

  const inputEl = setting.controlEl.createEl('input', {
    type: 'text',
    cls: 'folder-input-field',
    value,
    attr: { placeholder },
  });

  new FolderSuggest(app, inputEl);

  const commit = () => {
    void onChange(normalizePath(inputEl.value));
  };
  inputEl.addEventListener('change', commit);
  inputEl.addEventListener('blur', commit);
}
