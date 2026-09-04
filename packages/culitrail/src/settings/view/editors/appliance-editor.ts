/**
 * The appliances a bought pre-eaten dish can be reheated in.
 *
 * The id column is deliberately read-only. Everything downstream resolves an
 * appliance by id, and a note's sub-heading is matched against the id as well as
 * the label, so letting an id be edited here would silently orphan every note
 * that already names that appliance. Renaming the label is the supported edit,
 * and it keeps working precisely because the id did not move.
 */
import { t } from '../../../lang/I18nManager';
import type { ReheatAppliance } from '../../types';
import { renderListEditor } from '../../../ui/list-editor';
import { section } from '../rows';
import type { SettingsTabContext } from '../settings-tab';

/** A new row's id, from its label, so a hand-added appliance is addressable at all. */
function idFromLabel(label: string, taken: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .normalize('NFD')
      // Diacritics out, so `Heissluftfritteuse` and `Heißluftfritteuse` do not
      // produce two ids for one appliance.
      .replace(/[̀-ͯ]/g, '')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'appliance';

  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function renderApplianceEditor(container: HTMLElement, context: SettingsTabContext): void {
  const { settings } = context;

  section(container, t('settings.reheating.appliances'), t('settings.reheating.appliancesNote'));

  renderListEditor<ReheatAppliance>(container, {
    items: settings.reheatAppliances,
    emptyText: t('settings.reheating.noAppliances'),
    addLabel: t('settings.reheating.addAppliance'),
    // An empty label to type into, and an id assigned on first save rather than
    // now: an id derived from an empty label would be `appliance`, and a second
    // one would be `appliance-2` before either had a name.
    onAdd: () => ({ id: '', label: '' }),
    onChange: (items) => {
      settings.reheatAppliances = items;
      void context.save();
      context.refresh();
    },
    renderItem: (row, appliance, index) => {
      const label = row.createEl('input', {
        cls: 'culi-list-input',
        attr: { type: 'text', placeholder: t('settings.reheating.appliancePlaceholder') },
      });
      label.value = appliance.label;
      label.addEventListener('change', () => {
        const next = [...settings.reheatAppliances];
        const taken = new Set(next.filter((_, i) => i !== index).map((entry) => entry.id));
        const text = label.value.trim();
        next[index] = {
          // Kept once it exists. This is the whole point of the two fields being
          // separate: a label somebody corrects must not move the id that the
          // notes are matched against.
          id: appliance.id || idFromLabel(text, taken),
          label: text,
        };
        settings.reheatAppliances = next;
        void context.save();
        context.refresh();
      });

      // Shown rather than editable, and shown at all because it is what a note's
      // sub-heading can say and what somebody debugging a note needs to see.
      row.createSpan({ cls: 'culi-list-detail', text: appliance.id || '-' });
    },
  });
}
