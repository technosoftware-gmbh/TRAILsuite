/**
 * One-time adoption of a sibling plugin's CRM settings on a fresh install.
 *
 * CULItrail and APERtrail both read Person and Company notes out of two
 * configured folders. A vault that has already told one of them where those
 * folders are should not have to tell the second one again, so on a fresh
 * install only, CULItrail reads the sibling's `data.json` and adopts the
 * contact-related settings it recognizes.
 *
 * Two boundaries make this safe to do at all:
 *
 *   - It reads a FILE, not a plugin. There is no `app.plugins.getPlugin()`
 *     call anywhere in CULItrail, no imported types and no runtime coupling.
 *     The sibling does not have to be installed, enabled, or even present.
 *   - It adopts only folder paths, type values and property names. Adopting a
 *     folder changes where the plugin looks; adopting a behaviour toggle would
 *     change what it does, and nobody asked for that.
 */
import { App } from 'obsidian';

/**
 * The siblings worth reading, checked in order: the first one that yields
 * anything usable wins.
 *
 * A list rather than a single id, because which siblings exist is the part
 * that changes. Adding one is an entry here plus a reader function below; the
 * order is the preference order, and nothing else has to move.
 */
const FOREIGN_PLUGIN_IDS = ['apertrail'] as const;

export type ForeignPluginId = (typeof FOREIGN_PLUGIN_IDS)[number];

/** Only these keys are ever adopted. Everything else comes from CULItrail's own defaults. */
export interface ForeignCrmSettings {
  rootFolder?: string;
  crmFolder?: string;
  personsFolder?: string;
  companiesFolder?: string;
  typePropertyName?: string;
  personTypeValue?: string;
  companyTypeValue?: string;
  personTagProperty?: string;
  companyTagProperty?: string;
  eligiblePersonTags?: string;
}

export interface ForeignImportResult {
  source: ForeignPluginId;
  /** The adopted values, ready to hand to mergeSettings(). */
  settings: ForeignCrmSettings;
  /** Which keys actually came across, for the settings tab's status row. */
  adopted: (keyof ForeignCrmSettings)[];
}

/**
 * Reads `<configDir>/plugins/<pluginId>/data.json`.
 *
 * Never throws. Returns null when the plugin was never installed in this
 * vault, or its file is missing, unreadable or not valid JSON, so callers
 * fall through to normal defaults exactly as a genuinely fresh install would.
 */
export async function readForeignPluginData(app: App, pluginId: string): Promise<unknown> {
  try {
    const path = `${app.vault.configDir}/plugins/${pluginId}/data.json`;
    const exists = await app.vault.adapter.exists(path);
    if (!exists) return null;
    const raw = await app.vault.adapter.read(path);
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return !!val && typeof val === 'object' && !Array.isArray(val);
}

/** A non-empty string, or undefined. A blank value is not worth adopting: it would hide the folder it names. */
function text(val: unknown): string | undefined {
  return typeof val === 'string' && val.trim() !== '' ? val : undefined;
}

/**
 * APERtrail's keys are already the names CULItrail uses, because CULItrail
 * adopted its naming for exactly this reason. Nothing has to be translated.
 */
function fromAPERtrail(raw: Record<string, unknown>): ForeignCrmSettings {
  return {
    rootFolder: text(raw.rootFolder),
    crmFolder: text(raw.crmFolder),
    personsFolder: text(raw.personsFolder),
    companiesFolder: text(raw.companiesFolder),
    typePropertyName: text(raw.typePropertyName),
    personTypeValue: text(raw.personTypeValue),
    companyTypeValue: text(raw.companyTypeValue),
    personTagProperty: text(raw.personTagProperty),
    companyTagProperty: text(raw.companyTagProperty),
    eligiblePersonTags:
      typeof raw.eligiblePersonTags === 'string' ? raw.eligiblePersonTags : undefined,
  };
}

/** Drops every key whose value came back undefined, so mergeSettings() falls back to CULItrail's own default for it. */
function compact(settings: ForeignCrmSettings): {
  settings: ForeignCrmSettings;
  adopted: (keyof ForeignCrmSettings)[];
} {
  const out: ForeignCrmSettings = {};
  const adopted: (keyof ForeignCrmSettings)[] = [];

  for (const [key, value] of Object.entries(settings)) {
    if (value === undefined) continue;
    out[key as keyof ForeignCrmSettings] = value as string;
    adopted.push(key as keyof ForeignCrmSettings);
  }

  return { settings: out, adopted };
}

/**
 * Tries each sibling in turn and returns the first that yielded anything.
 *
 * "Anything" means at least one adopted key, not merely a readable file: a
 * vault with an APERtrail install that never configured CRM has nothing to
 * hand over, and stopping there would report an import that adopted nothing
 * instead of falling on to the next sibling, or to CULItrail's own defaults.
 */
export async function importForeignCrmSettings(app: App): Promise<ForeignImportResult | null> {
  for (const source of FOREIGN_PLUGIN_IDS) {
    const raw = await readForeignPluginData(app, source);
    if (!isPlainObject(raw)) continue;

    const parsed = fromAPERtrail(raw);
    const { settings, adopted } = compact(parsed);
    if (adopted.length === 0) continue;

    return { source, settings, adopted };
  }

  return null;
}
