/**
 * Matching a note's sub-heading to a configured appliance.
 *
 * Deliberately forgiving, and deliberately consulting every name rather than
 * selecting a set by locale: a vault that switches language must not stop
 * recognising the headings it has already written, and a German note opened in an
 * English vault is a real case for a household that shares one. Same reasoning as
 * a matcher walking both keyword dictionaries.
 *
 * A heading that matches nothing is **not** dropped. Text somebody typed under a
 * heading the plugin does not recognise is still their instruction, and hiding it
 * would be the parser deciding it knows better.
 */
import type { ReheatAppliance } from './types.js';

export const DEFAULT_APPLIANCE_IDS = ['microwave', 'oven', 'steamer', 'skillet'] as const;

export type DefaultApplianceId = (typeof DEFAULT_APPLIANCE_IDS)[number];

/** The English labels, and the alias set every locale's reader falls back to. */
export const APPLIANCE_LABELS_EN: Record<DefaultApplianceId, string> = {
  microwave: 'Microwave',
  oven: 'Oven',
  steamer: 'Steamer',
  skillet: 'Skillet',
};

/**
 * The German labels, kept beside the English ones rather than in a consumer's
 * string table.
 *
 * They are not display wording, which is why they are not translations: a
 * consumer that shows an appliance name looks it up in its own locale files,
 * the way CULItrail's settings layer does. These are heading text that notes
 * already carry, so matching against them is reading a file rather than
 * translating one, and reading a file is this package's half of the work.
 *
 * They are consulted as aliases when matching a sub-heading, in either locale,
 * the same way a locale-blind matcher walks both keyword dictionaries rather than
 * selecting one: a vault that switches language must not stop recognising the
 * headings it has already written.
 */
export const APPLIANCE_LABELS_DE: Record<DefaultApplianceId, string> = {
  microwave: 'Mikrowelle',
  oven: 'Backofen',
  steamer: 'Dampfgarer',
  skillet: 'Bratpfanne',
};

/** The four that ship, in the order they are offered. */
export const DEFAULT_APPLIANCES: ReheatAppliance[] = DEFAULT_APPLIANCE_IDS.map((id) => ({
  id,
  label: APPLIANCE_LABELS_EN[id],
}));

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export interface ApplianceMatch {
  applianceId: string;
  label: string;
  unknown: boolean;
}

/**
 * The appliance a heading names.
 *
 * In order: the configured label, the configured id, then the shipped English and
 * German defaults as aliases. The alias pass is what makes a rename survivable
 * for the four that ship, and its limit is worth knowing: an appliance a vault
 * invented and then renamed has no alias to fall back on. That is why the list
 * editor keeps the id fixed across a label edit.
 */
export function matchAppliance(
  heading: string,
  appliances: readonly ReheatAppliance[]
): ApplianceMatch {
  const text = normalize(heading);
  if (text === '') return { applianceId: '', label: heading.trim(), unknown: true };

  for (const appliance of appliances) {
    if (normalize(appliance.label) === text || normalize(appliance.id) === text) {
      return { applianceId: appliance.id, label: appliance.label, unknown: false };
    }
  }

  for (const id of DEFAULT_APPLIANCE_IDS) {
    if (
      normalize(APPLIANCE_LABELS_EN[id]) !== text &&
      normalize(APPLIANCE_LABELS_DE[id]) !== text
    ) {
      continue;
    }
    // Resolved to the id, then labelled from the vault's own list when it still
    // holds that appliance: a German vault reading `## Steamer` should show its
    // own word for it rather than echoing the note.
    const configured = appliances.find((appliance) => appliance.id === id);
    return {
      applianceId: id,
      label: configured?.label ?? APPLIANCE_LABELS_EN[id],
      unknown: false,
    };
  }

  // Kept, labelled as written. An unknown appliance is a vault saying something
  // this plugin has no vocabulary for, not an error.
  return { applianceId: heading.trim(), label: heading.trim(), unknown: true };
}

/** The configured label for an id, for a caller that has the id and wants the word. */
export function applianceLabel(
  applianceId: string,
  appliances: readonly ReheatAppliance[]
): string {
  const configured = appliances.find((appliance) => appliance.id === applianceId);
  if (configured) return configured.label;

  const known = DEFAULT_APPLIANCE_IDS.find((id) => id === applianceId);
  return known ? APPLIANCE_LABELS_EN[known] : applianceId;
}

/**
 * Sorts entries into the configured order, with unknown appliances last.
 *
 * The order in the settings list is the order somebody arranged, and it should
 * decide the order on screen rather than the order a note happens to list them.
 * An appliance the list does not know goes to the end, where it reads as an
 * addition rather than as an interruption.
 */
export function inApplianceOrder<T extends { applianceId: string; label: string }>(
  entries: T[],
  appliances: readonly ReheatAppliance[]
): T[] {
  const rank = new Map(appliances.map((appliance, index) => [appliance.id, index]));
  return [...entries].sort((a, b) => {
    const ra = rank.get(a.applianceId) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b.applianceId) ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return a.label.localeCompare(b.label);
  });
}
