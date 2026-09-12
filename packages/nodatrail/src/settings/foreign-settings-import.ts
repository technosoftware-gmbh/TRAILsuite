/**
 * Adopting the shared settings from a sibling plugin, once, on a fresh install.
 *
 * APERtrail and CULItrail read the same `CRM/People` and `CRM/Companies` as
 * this plugin does, and a vault that has already told one of them where those
 * folders are should not have to tell a third. So on a genuinely fresh install
 * NODAtrail reads a sibling's `data.json` and adopts the CRM-shaped fields and
 * the two stamp property names.
 *
 * Two boundaries make it safe, and they are the same two CULItrail's version
 * has. **It reads a file, not a plugin**: there is no `app.plugins.getPlugin()`
 * call, no imported type and no runtime coupling, so the sibling need not be
 * installed or enabled. And it adopts **names and locations only**, never a
 * behaviour toggle: which folder the people are in is a fact about the vault,
 * whereas whether a ribbon icon shows is a preference about a plugin.
 *
 * **On a fresh install only**, which means a value changed in a sibling later
 * does not propagate. That is the usual reason two of these plugins disagree
 * about a setting in a long-lived vault, and it is stated here rather than
 * discovered.
 *
 * The mechanism is CULItrail's; the code is not. CULItrail is GPL and this
 * package is PolyForm, so this was written fresh. Do not copy that file here.
 */
import { App } from 'obsidian';
import { NODAtrailSettings } from './types';

/** The sibling plugin ids, in the order their answers are preferred. */
const SIBLINGS = ['apertrail', 'culitrail'] as const;

/**
 * Where the sibling's order notes are, and what they call things.
 *
 * Separate from the rest because these are adopted on a different rule, below:
 * they are the one group where the shipped value is a guess rather than an
 * answer.
 */
const ORDER_FIELDS = [
  'ordersFolder',
  'orderTypeValue',
  'orderCompanyProperty',
  'orderDateProperty',
  'orderPriceProperty',
  'orderPriceCurrencyProperty',
] as const satisfies readonly (keyof NODAtrailSettings)[];

/**
 * The fields worth adopting.
 *
 * Every one of them names a folder, a type value or a property. Nothing here
 * changes how NODAtrail behaves, only where it looks and what it calls things.
 *
 * The order fields are read from CULItrail alone, and the sibling order below
 * puts APERtrail first, which does not have them. That is the intended
 * behaviour of a per-field lookup rather than a per-plugin one: each field is
 * taken from the first sibling that states it.
 */
const ADOPTED = [
  'typePropertyName',
  'crmFolder',
  'personsFolder',
  'companiesFolder',
  'personTypeValue',
  'companyTypeValue',
  'personTagProperty',
  'companyTagProperty',
  'eligiblePersonTags',
  'createdProperty',
  'modifiedProperty',
  // Where the sibling's order notes are, and what they call things. A ledger
  // that knew the folder but not the property names would read every order as
  // unpriced, which is worse than not looking.
  ...ORDER_FIELDS,
] as const satisfies readonly (keyof NODAtrailSettings)[];

type AdoptedKey = (typeof ADOPTED)[number];

/**
 * Reads a sibling's saved settings, or null.
 *
 * Every failure is the same non-event: the sibling is not installed, has never
 * been configured, or its file is not readable. None of them is worth surfacing
 * to somebody who has just installed a third plugin.
 */
async function readSibling(app: App, id: string): Promise<Record<string, unknown> | null> {
  const path = `${app.vault.configDir}/plugins/${id}/data.json`;

  try {
    if (!(await app.vault.adapter.exists(path))) return null;

    const raw = await app.vault.adapter.read(path);
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * The adopted fields, merged into the settings object in place.
 *
 * The first sibling that states a field wins, so APERtrail's answer is
 * preferred where both have one. Only non-empty strings are adopted: a sibling
 * that has cleared a property name has said "do not write that stamp" about
 * itself, and inheriting that decision would be inheriting a behaviour rather
 * than a name.
 *
 * Returns the ids actually read, so the caller can say what happened.
 */
export async function adoptSiblingSettings(
  app: App,
  settings: NODAtrailSettings
): Promise<string[]> {
  const adoptedFrom: string[] = [];
  const taken = new Set<AdoptedKey>();

  for (const id of SIBLINGS) {
    const foreign = await readSibling(app, id);
    if (!foreign) continue;

    let usedAnything = false;
    for (const key of ADOPTED) {
      if (taken.has(key)) continue;

      const value = foreign[key];
      if (typeof value !== 'string' || value.trim() === '') continue;

      settings[key] = value;
      taken.add(key);
      usedAnything = true;
    }

    if (usedAnything) adoptedFrom.push(id);
  }

  return adoptedFrom;
}

/**
 * The order fields, adopted into a vault that has been running for a while.
 *
 * `adoptSiblingSettings` runs on a fresh install only, and that is right for
 * everything it covers: a vault that has answered a question should not be
 * asked again. But it leaves a gap that only appears when a field is added to
 * the list later, which is exactly what happened here -- every existing vault
 * would ship with a folder path pointing at nothing and no way to learn better
 * short of somebody noticing a settings row.
 *
 * So these six are adopted **whenever they still hold the value this plugin
 * shipped**, which cannot overwrite a choice because no choice has been made.
 * The reason it is safe here and would not be for the CRM fields is that an
 * orders folder is not a NODAtrail concept at all: nobody sets it to say
 * something, and `Eating/Orders` is a guess about somebody else's plugin rather
 * than a default anybody meant. Replacing a guess with a fact loses nothing.
 *
 * Returns true when anything changed, so the caller knows to save.
 */
export async function adoptOrderSettings(
  app: App,
  settings: NODAtrailSettings,
  shipped: Readonly<NODAtrailSettings>
): Promise<boolean> {
  const untouched = ORDER_FIELDS.filter((key) => settings[key] === shipped[key]);
  if (untouched.length === 0) return false;

  let changed = false;
  for (const id of SIBLINGS) {
    const foreign = await readSibling(app, id);
    if (!foreign) continue;

    for (const key of untouched) {
      // Still untouched a moment ago; an earlier sibling in this loop may have
      // answered it since.
      if (settings[key] !== shipped[key]) continue;
      const value = foreign[key];
      // Compared as well as assigned, so a sibling that happens to agree with
      // the shipped value does not report a change and cost a save. A vault
      // whose answer equals the default is indistinguishable from one that
      // never answered, which is inherent to the rule and harmless: adopting
      // the same string changes nothing.
      if (typeof value === 'string' && value.trim() && value !== settings[key]) {
        settings[key] = value;
        changed = true;
      }
    }
  }

  return changed;
}
