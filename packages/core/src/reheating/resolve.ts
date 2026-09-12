/**
 * Resolving a dish's reheating entry against its supplier's, per appliance.
 *
 * The whole risk of the feature is in this file, and it is written to be read
 * against the table in CULItrail's `docs/design/ready-meals.md` rather than
 * instead of it. `tests/reheating/resolve.test.ts` has one case per row.
 *
 * The rule in one sentence: **the dish's prose wins outright, the dish's numbers
 * fill the supplier's wording, and a supplier instruction whose token nothing
 * fills is not offered at all.**
 */
import { inApplianceOrder } from './appliances.js';
import type { ApplianceEntry, ReheatAppliance, ReheatInstruction } from './types.js';

/**
 * `{temp}` and `{time}`, the token notation the path settings already use.
 *
 * Two pairs, and the duplication is deliberate. A `/g` regex carries `lastIndex`
 * between calls, so one shared object used with `.test()` across several steps
 * answers about where it left off rather than about the string it was handed: the
 * second appliance's token goes unfound and its numbers are appended on top of a
 * sentence that already states them.
 *
 * As the code below happens to be ordered that cannot currently bite, because
 * `fill()` runs first and `String.replace` resets `lastIndex` to 0. **That is a
 * trap rather than a defence**: it makes the correctness of these two functions
 * depend on the order of two statements with no visible connection. Separate
 * non-global patterns for testing cost nothing and remove the dependency.
 */
const TEMP_TOKEN = /\{temp\}/gi;
const TIME_TOKEN = /\{time\}/gi;
const HAS_TEMP_TOKEN = /\{temp\}/i;
const HAS_TIME_TOKEN = /\{time\}/i;

function hasToken(steps: string[]): boolean {
  return steps.some((step) => HAS_TEMP_TOKEN.test(step) || HAS_TIME_TOKEN.test(step));
}

function fill(steps: string[], temp: string | null, time: string | null): string[] {
  return steps.map((step) =>
    step
      .replace(TEMP_TOKEN, temp ?? '')
      .replace(TIME_TOKEN, time ?? '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  );
}

/**
 * Every token in these steps has something to fill it.
 *
 * Checked per token rather than per step: a wording that names both a temperature
 * and a time needs both, and filling one while blanking the other produces
 * "at 95 °C for" which is worse than not offering the appliance.
 */
function tokensSatisfied(steps: string[], temp: string | null, time: string | null): boolean {
  const text = steps.join('\n');
  if (HAS_TEMP_TOKEN.test(text) && !temp) return false;
  return !(HAS_TIME_TOKEN.test(text) && !time);
}

/** The numbers as an instruction of their own, for a dish whose supplier says nothing. */
function numbersOnly(temp: string | null, time: string | null): string[] {
  const parts = [temp, time].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? [parts.join(', ')] : [];
}

/**
 * One appliance, resolved. Null means the appliance is not offered for this dish.
 *
 * Either side may be absent. Both absent cannot happen, since the caller only
 * asks about appliances one of the two notes mentions.
 */
export function resolveAppliance(
  dish: ApplianceEntry | undefined,
  supplier: ApplianceEntry | undefined
): ReheatInstruction | null {
  const label = dish?.label ?? supplier?.label ?? '';
  const applianceId = dish?.applianceId ?? supplier?.applianceId ?? '';
  const unknown = dish?.unknown ?? supplier?.unknown ?? false;

  const temp = dish?.temp ?? supplier?.temp ?? null;
  const time = dish?.time ?? supplier?.time ?? null;
  const base = { applianceId, label, unknown, temp, time };

  // The dish said something in words. Its own tokens are filled from its own
  // numbers, which lets a dish carry a template of its own without knowing
  // whether it has a supplier at all.
  if (dish && dish.steps.length > 0) {
    if (!tokensSatisfied(dish.steps, temp, time)) return null;
    return { ...base, steps: fill(dish.steps, temp, time), source: 'dish' };
  }

  const supplierSteps = supplier?.steps ?? [];

  if (supplierSteps.length > 0) {
    // A supplier wording with a token and nothing to fill it is withheld. This is
    // the row of the table worth defending: "heat for about {time}" looks like a
    // bug and cannot be acted on in a kitchen, and silence is the honest answer
    // until somebody types the number.
    if (!tokensSatisfied(supplierSteps, temp, time)) return null;

    const filled = fill(supplierSteps, temp, time);
    const carriedTokens = hasToken(supplierSteps);

    // Numbers the wording did not consume are appended rather than dropped: a
    // supplier that never mentions a temperature and a dish that states one are
    // both saying something a reader needs.
    const trailing = carriedTokens ? [] : numbersOnly(temp, time);
    return { ...base, steps: [...filled, ...trailing], source: 'supplier' };
  }

  // Only numbers, from either side, and nobody's wording to put them in.
  const steps = numbersOnly(temp, time);
  return steps.length > 0 ? { ...base, steps, source: 'numbers' } : null;
}

/**
 * Every appliance offered for a dish, in the configured order.
 *
 * The union of what the two notes mention, not the intersection: a supplier that
 * lists four appliances and a dish that overrides one should offer four.
 */
export function resolveReheating(
  dishEntries: readonly ApplianceEntry[],
  supplierEntries: readonly ApplianceEntry[],
  appliances: readonly ReheatAppliance[]
): ReheatInstruction[] {
  const byId = new Map<string, { dish?: ApplianceEntry; supplier?: ApplianceEntry }>();

  for (const entry of supplierEntries) {
    byId.set(entry.applianceId, { ...byId.get(entry.applianceId), supplier: entry });
  }
  for (const entry of dishEntries) {
    byId.set(entry.applianceId, { ...byId.get(entry.applianceId), dish: entry });
  }

  const resolved: ReheatInstruction[] = [];
  for (const [, pair] of byId) {
    const instruction = resolveAppliance(pair.dish, pair.supplier);
    if (instruction) resolved.push(instruction);
  }

  return inApplianceOrder(resolved, appliances);
}
