/**
 * Who sells this meal, and which of their ranges it belongs to.
 *
 * **The supplier has always been resolved and never shown.** It drives the
 * reheating merge, it can be inferred from the newest order naming the dish,
 * and until now the only way to find out which company a view had settled on
 * was to read the note. A line under the price fixes that, and putting it there
 * rather than in the badge row is deliberate: it is a fact about buying the
 * meal, like the price, rather than a categorical property like the diet.
 *
 * The line is shown beside it rather than on its own, because "Sport" means
 * nothing without the company whose range it is.
 */
import { setIcon } from 'obsidian';
import { t } from '../../lang/I18nManager';
import type { SupplierResolution } from '../reheating/read-supplier';

export function renderSupplierLine(
  container: HTMLElement,
  supplier: SupplierResolution,
  line: string | null
): void {
  if (!supplier.title) return;

  const row = container.createDiv({ cls: 'culi-supplier-line' });
  setIcon(row.createSpan({ cls: 'culi-supplier-icon' }), 'store');
  row.createSpan({ cls: 'culi-supplier-name', text: supplier.title });

  if (line?.trim()) {
    row.createSpan({ cls: 'culi-supplier-line-name', text: line.trim() });
  }

  // Said only when it was guessed. A stated supplier needs no explanation, and
  // a line that explained every one of them would be noise on the notes that
  // are already right.
  if (supplier.source === 'order') {
    row.createSpan({ cls: 'culi-supplier-inferred', text: t('meals.header.supplierFromOrder') });
  }
}
