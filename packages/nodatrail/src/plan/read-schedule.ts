/**
 * Reading the meetings back out of a day note, for display and nothing else.
 *
 * `docs/design/day-notes.md` deferred parsing the body: "a parser for the body
 * format is a parser that can mangle a note you also edited by hand". That
 * reasoning was about **writing**, and it still holds -- nothing here writes.
 *
 * What the design got wrong is that it deferred the reading too, and the first
 * day of real use showed why that was wrong: a day view that lists a task and
 * silently omits the two hours the day was actually spent in is not showing the
 * day. Reading is safe where writing is not, so the read half comes forward and
 * the write half stays deferred.
 *
 * **A line this cannot make sense of is skipped, never guessed at.** A day note
 * is written by hand as well as by the dialog, and a bullet somebody typed
 * under the schedule heading is not required to look like ours.
 */
import type { App, TFile } from 'obsidian';
import { splitFrontmatterBlock } from 'trail-core';
import { hostFor } from '../shared/vault-host';
import type { NODAtrailSettings } from '../settings/types';

/**
 * What the person whose calendar it is said about being there.
 *
 * Empty means accepted, or that nobody asked -- a meeting somebody wrote down
 * themselves. To a reader those are one thing: it is on, and they are going.
 */
export type Attendance = '' | 'tentative' | 'unanswered' | 'declined';

/** The marker each answer is written with. Blank switches a distinction off. */
export interface MeetingMarkers {
  accepted: string;
  tentative: string;
  unanswered: string;
  declined: string;
}

export function meetingMarkers(settings: NODAtrailSettings): MeetingMarkers {
  return {
    accepted: settings.dayMeetingMarker,
    tentative: settings.dayMeetingTentativeMarker,
    unanswered: settings.dayMeetingUnansweredMarker,
    declined: settings.dayMeetingDeclinedMarker,
  };
}

export interface ScheduleEntry {
  /** What was answered, from the marker the line carries. */
  attendance: Attendance;
  /** `11:00`, or empty for an entry with no time. */
  from: string;
  /** `12:00`, or empty. */
  to: string;
  /** What it is, with the marker, the time and the wikilink brackets off. */
  text: string;
  /** Note titles named on the line, so a view can show what it was about. */
  links: string[];
}

/** `11:00-12:00`, `11:00` or `-12:00` at the head of the line. */
const SPAN = /^(\d{1,2}:\d{2})?(?:-(\d{1,2}:\d{2}))?(?=\s|$)/;
const WIKILINK = /\[\[([^\]]+)\]\]/g;

/**
 * One bullet under the schedule heading, or null.
 *
 * The marker is stripped when it is there and not required: a vault that
 * cleared `dayMeetingMarker` writes plain bullets, and one somebody typed by
 * hand may carry no marker either. What makes a line an entry is that it is a
 * bullet under that heading, which is the heading's job to establish.
 *
 * A checkbox is **not** an entry. The follow-ups written under a meeting are
 * tasks, and `readTasks` already finds them; picking them up here as well would
 * show each one twice in the same view.
 */
export function parseScheduleLine(line: string, markers: MeetingMarkers): ScheduleEntry | null {
  const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
  if (!bullet) return null;

  let rest = (bullet[1] ?? '').trim();
  if (/^\[.\]/.test(rest)) return null;

  // Longest marker first, so a setting that is a prefix of another cannot
  // swallow it: two markers of one emoji plus a variation selector differ only
  // in their tail, and stripping the shorter would leave the difference
  // sitting in the text.
  const found = (['declined', 'unanswered', 'tentative', 'accepted'] as const)
    .map((key) => ({ key, mark: markers[key].trim() }))
    .filter((one) => one.mark !== '' && rest.startsWith(one.mark))
    .sort((a, b) => b.mark.length - a.mark.length)[0];

  let attendance: Attendance = '';
  if (found) {
    rest = rest.slice(found.mark.length).trim();
    if (found.key !== 'accepted') attendance = found.key;
  }

  const span = SPAN.exec(rest);
  const from = span?.[1] ?? '';
  const to = span?.[2] ?? '';
  if (span?.[0]) rest = rest.slice(span[0].length).trim();

  const links = [...rest.matchAll(WIKILINK)].map((match) => (match[1] ?? '').trim());
  const text = rest.replace(WIKILINK, '').replace(/\s+/g, ' ').trim();

  if (!text && links.length === 0) return null;
  return { attendance, from, to, text, links };
}

/**
 * The lines under the first of `headings` the note carries, stopping at the
 * next heading of the same level or shallower.
 *
 * Several spellings for the same reason the writer accepts several: a note
 * written before the vault switched language still holds the old heading, and a
 * schedule that could not find it would report an empty day rather than a
 * heading it did not recognise.
 */
function sectionLines(body: string, headings: readonly string[]): string[] {
  const lines = body.split('\n');
  const at = lines.findIndex((line) => headings.some((heading) => line.trim() === heading.trim()));
  if (at === -1) return [];

  const level = (/^(#{1,6})\s/.exec(lines[at] ?? '')?.[1] ?? '').length;
  const out: string[] = [];
  for (let index = at + 1; index < lines.length; index += 1) {
    const next = (/^(#{1,6})\s/.exec(lines[index] ?? '')?.[1] ?? '').length;
    if (next > 0 && next <= level) break;
    out.push(lines[index] ?? '');
  }
  return out;
}

/**
 * The day's schedule, in the order the note lists it.
 *
 * **Not sorted by time.** The note's order is the order somebody wrote things
 * down in, and a view that reordered them would disagree with the note it is
 * showing. An entry with no time has nowhere to sort to anyway.
 */
export async function readSchedule(
  app: App,
  settings: NODAtrailSettings,
  file: TFile,
  headings: readonly string[]
): Promise<ScheduleEntry[]> {
  const text = await hostFor(app).vault.read(file);
  const { body } = splitFrontmatterBlock(text);

  const found: ScheduleEntry[] = [];
  for (const line of sectionLines(body, headings)) {
    const entry = parseScheduleLine(line, meetingMarkers(settings));
    if (entry) found.push(entry);
  }
  return found;
}
