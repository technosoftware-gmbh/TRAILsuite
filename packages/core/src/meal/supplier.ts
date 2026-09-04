/**
 * Which suppliers the meal editor offers.
 *
 * A file of its own, and app-free, because the interesting rule here is not the
 * dropdown but what must never fall out of it.
 */

/**
 * The company titles to offer, with the empty string meaning "nobody in
 * particular", and **always including whatever the meal already names**.
 *
 * That last clause is the whole point. A meal names its supplier by title, and
 * the Company note behind that title is not the meal editor's to create: it is
 * written elsewhere, or by hand, and can be renamed or moved without anything
 * here being told. So a meal can name a supplier whose note has since been
 * renamed, moved out of the companies folder, or never existed at all. A list
 * built from the companies alone would not contain that value; a `<select>`
 * whose value matches no option falls back to its first, and saving the meal
 * would then replace a supplier somebody typed with "none" without anybody
 * asking for it. Keeping it in the list makes the form say what the note says,
 * and leaves correcting it a deliberate act.
 */
export function supplierOptionValues(
  companies: readonly string[],
  current: string | null
): string[] {
  const values = ['', ...companies];
  const named = current?.trim();

  if (named && !companies.includes(named)) values.push(named);
  return values;
}

/** Whether a named supplier has no company note behind it, so it can be labelled as such. */
export function isUnknownSupplier(companies: readonly string[], current: string | null): boolean {
  const named = current?.trim();
  return named !== undefined && named !== '' && !companies.includes(named);
}
