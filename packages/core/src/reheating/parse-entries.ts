/**
 * Reading a reheating section into one entry per appliance.
 *
 * **Groups in, entries out.** The caller has already split the section into
 * `## Steamer` blocks, because splitting a body into sections is a markdown
 * concern a caller already answers against its own host. What cannot be
 * answered twice is everything below: which heading names which
 * appliance, that `[temp:: 95 °C]` is a value rather than text, that a fenced
 * block belongs to whoever claims that language, and that **prose with no list
 * marker is one step here**. A reheating block is typically one or two
 * sentences, and treating it as no steps at all, the way an instructions parser
 * correctly does, would make the common case invisible.
 *
 * See CULItrail's `docs/design/ready-meals.md` for the note format.
 */
import { matchAppliance } from './appliances.js';
import type { ApplianceEntry, ReheatAppliance } from './types.js';

const LIST_MARKER = /^\s*(?:\d+\.|[-*+])\s+/;

/** A fenced code block's delimiter, in either notation. */
const FENCE = /^\s*(?:```|~~~)/;

/**
 * The lines, minus any fenced code block.
 *
 * Found on a real company note: the shared CRM note carries a
 * `culi-related-orders` fence after the reheating section, and since nothing
 * follows it but the end of the file, every line of it landed inside the last
 * appliance's instructions. A reader was told to remove the plastic wrap and
 * then shown a line of backticks.
 *
 * Dropped rather than terminated at, so a fence in the middle of a block does
 * not silently swallow the sentence after it.
 */
function withoutFencedBlocks(lines: readonly string[]): string[] {
  const kept: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) kept.push(line);
  }
  return kept;
}

/**
 * An inline field, the `[rating:: N]` notation the eating log already uses.
 *
 * The name is escaped because it comes from a caller's settings,
 * `reheatTempField` and `reheatTimeField` in CULItrail's case, and could
 * contain anything somebody types.
 */
function inlineField(text: string, name: string): string | null {
  const key = name.trim();
  if (!key) return null;

  const pattern = new RegExp(
    `\\[\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*::([^\\]]*)\\]`,
    'i'
  );
  const value = pattern.exec(text)?.[1]?.trim();
  return value ? value : null;
}

function stripInlineFields(text: string): string {
  return text.replace(/\[[^\]:]+::[^\]]*\]/g, '').trim();
}

/**
 * The lines under one appliance heading, as steps.
 *
 * A list becomes one step per item, so a three-step reheat reads as three.
 * Prose becomes one step per paragraph, which keeps a blank-line-separated pair
 * of sentences from being glued into one long line.
 */
export function parseBlockSteps(lines: readonly string[]): string[] {
  const cleaned = withoutFencedBlocks(lines).map((line) => stripInlineFields(line));

  if (cleaned.some((line) => LIST_MARKER.test(line))) {
    const steps: string[] = [];
    let current: string[] | null = null;
    for (const line of cleaned) {
      if (LIST_MARKER.test(line)) {
        if (current) steps.push(current.join('\n').trim());
        current = [line.replace(LIST_MARKER, '')];
      } else if (current && line.trim() !== '') {
        current.push(line);
      }
    }
    if (current) steps.push(current.join('\n').trim());
    return steps.filter((step) => step !== '');
  }

  const paragraphs: string[] = [];
  let current: string[] = [];
  for (const line of cleaned) {
    if (line.trim() === '') {
      if (current.length > 0) paragraphs.push(current.join(' ').trim());
      current = [];
    } else {
      current.push(line.trim());
    }
  }
  if (current.length > 0) paragraphs.push(current.join(' ').trim());
  return paragraphs.filter((step) => step !== '');
}

/** One block of a reheating section: its sub-heading and the lines under it. */
export interface ApplianceBlock {
  heading: string | null;
  lines: readonly string[];
}

export interface ReheatFieldNames {
  /** The inline field naming a temperature. `temp` in the shipped defaults. */
  temp: string;
  /** The inline field naming a duration. `time`. */
  time: string;
}

export const DEFAULT_REHEAT_FIELDS: ReheatFieldNames = { temp: 'temp', time: 'time' };

export interface ParseEntriesOptions {
  appliances: readonly ReheatAppliance[];
  fields?: ReheatFieldNames;
  /**
   * Headings that name a section some other feature renders, and are therefore
   * never an appliance however deep they sit.
   *
   * `## Eating History` under a `# Reheating` is the real case: the log was being
   * shown as a way to reheat the dish. The list is the caller's, because which
   * sections exist is the caller's question.
   */
  reserved?: readonly string[];
}

/** One block as an entry, or null when it says nothing worth offering. */
export function parseApplianceEntry(
  block: ApplianceBlock,
  options: ParseEntriesOptions
): ApplianceEntry | null {
  // A block with no heading names no appliance, and guessing which one it meant
  // would be worse than leaving it to render as part of the note.
  if (block.heading === null) return null;

  const heading = block.heading.trim();
  const reserved = options.reserved ?? [];
  if (reserved.some((name) => name.trim().toLowerCase() === heading.toLowerCase())) return null;

  const fields = options.fields ?? DEFAULT_REHEAT_FIELDS;

  // Fences excluded here too: an inline field inside a code block is an example
  // of one, not a value this dish is stating.
  const raw = withoutFencedBlocks(block.lines).join('\n');
  const match = matchAppliance(heading, options.appliances);

  const entry: ApplianceEntry = {
    applianceId: match.applianceId,
    label: match.label,
    unknown: match.unknown,
    steps: parseBlockSteps(block.lines),
    temp: inlineField(raw, fields.temp),
    time: inlineField(raw, fields.time),
  };

  // An appliance heading with nothing under it at all is dropped. It says only
  // that somebody typed a heading, and offering an empty instruction reads as a
  // parsing failure rather than as an absence.
  if (entry.steps.length === 0 && entry.temp === null && entry.time === null) return null;

  return entry;
}

/** Every appliance a note's reheating section says something about. */
export function parseApplianceEntries(
  blocks: readonly ApplianceBlock[],
  options: ParseEntriesOptions
): ApplianceEntry[] {
  const entries: ApplianceEntry[] = [];
  for (const block of blocks) {
    const entry = parseApplianceEntry(block, options);
    if (entry) entries.push(entry);
  }
  return entries;
}
