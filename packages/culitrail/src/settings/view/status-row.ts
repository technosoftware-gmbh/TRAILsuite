/**
 * The read-only diagnostic block on the Library and Orders tabs.
 *
 * Diagnostic, not configuration. A note is identified by folder AND type
 * together, and when a vault ends up seeing zero meals there is otherwise
 * no way to tell whether the folder is wrong or the type value is. This says
 * which, by counting.
 */
import { App, setIcon } from 'obsidian';
import { t } from '../../lang/I18nManager';
import type { ForeignImportResult } from '../foreign-settings-import';
import { readNotesOfType } from '../../vault/read-notes';
import { foldersFor, typeValueFor, type CuliEntityType } from '../../vault/entity-types';
import type { CULItrailSettings } from '../types';

export interface StatusLine {
  label: string;
  folders: string;
  typeValue: string;
  count: number;
}

export function statusFor(
  app: App,
  settings: CULItrailSettings,
  kind: CuliEntityType,
  label: string
): StatusLine {
  const folders = foldersFor(settings, kind).filter((folder) => folder.trim() !== '');

  return {
    label,
    folders: folders.join(', ') || t('settings.status.noFolder'),
    typeValue: typeValueFor(settings, kind) || t('settings.status.noType'),
    count: readNotesOfType(app, settings, kind).length,
  };
}

export function renderStatusRows(container: HTMLElement, lines: StatusLine[]): void {
  const block = container.createDiv({ cls: 'culi-settings-status' });

  for (const line of lines) {
    const row = block.createDiv({ cls: 'culi-settings-status-row' });
    // A zero count is the thing this block exists to make visible, so it gets
    // an icon rather than only a number that has to be noticed.
    setIcon(
      row.createSpan({ cls: 'culi-settings-status-icon' }),
      line.count === 0 ? 'alert-circle' : 'check'
    );
    row.toggleClass('is-empty', line.count === 0);

    row.createSpan({ cls: 'culi-settings-status-label', text: line.label });
    row.createSpan({
      cls: 'culi-settings-status-detail',
      text: t('settings.status.detail')
        .replace('{folders}', line.folders)
        .replace('{type}', line.typeValue),
    });
    row.createSpan({ cls: 'culi-settings-status-count', text: String(line.count) });
  }
}

/**
 * Where the CRM settings came from.
 *
 * The one line on this page that reports history rather than state. On a fresh
 * install CULItrail adopts CRM-shaped settings from a sibling plugin's
 * `data.json` if it finds one, which is what stops somebody configuring the same
 * two folders twice. It is also invisible: a German vault that suddenly says
 * `CRM/Personen` when nobody typed that is confusing until you know why.
 *
 * Nothing is rendered when the adoption never ran, which is the ordinary case
 * for every load after the first. Silence there is right: a line saying "not
 * adopted" on every visit would imply something had gone wrong.
 */
export function renderAdoptionRow(
  container: HTMLElement,
  foreignImport: ForeignImportResult | null
): void {
  if (!foreignImport) return;

  const row = container.createDiv({ cls: ['culi-settings-status-row', 'culi-settings-adoption'] });
  setIcon(row.createSpan({ cls: 'culi-settings-status-icon' }), 'import');

  row.createSpan({
    cls: 'culi-settings-status-label',
    text: t('settings.status.adoptedFrom', { plugin: foreignImport.source }),
  });

  // The key names, not their values. The values are already on the rows above,
  // and what is not otherwise visible is *which* of them somebody did not
  // choose.
  row.createSpan({
    cls: 'culi-settings-status-detail',
    text:
      foreignImport.adopted.length > 0
        ? foreignImport.adopted.join(', ')
        : t('settings.status.adoptedNothing'),
  });
}
