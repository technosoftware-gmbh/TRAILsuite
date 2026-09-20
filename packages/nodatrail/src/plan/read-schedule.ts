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
import { splitFrontmatterBlock } from '@technosoftware/trail-core';
import { hostFor } from '../shared/vault-host';
import type { NODAtrailSettings } from '../settings/types';

/**
 * What the person whose calendar it is said about being there.
 *
 * Empty means accepted, or that nobody asked -- a meeting somebody wrote down
 * themselves. To a reader those are one thing: it is on, and they are going.
 */
export type Attendance = '' | 'tentative' | 'unanswered' | 'declined';

/**
 * The markers a line under the schedule heading may carry. Blank switches a
 * distinction off.
 *
 * **Four say what was answered; the fifth says this is not an appointment at
 * all.** A span runs over days rather than hours, so it has no answer to give
 * and is not one of the four -- keeping it in the same object only because a
 * reader has to know all five to strip whichever it finds.
 */
export interface ScheduleMarkers {
  accepted: string;
  tentative: string;
  unanswered: string;
  declined: string;
  span: string;
  /**
   * The two child markers, here only so a line carrying one can be refused.
   *
   * They are not answers and not kinds: a place and a person belong to the
   * entry above them, and a reader that took them for entries of their own
   * would put two extra rows in the week for every lunch.
   */
  place: string;
  person: string;
}

export function scheduleMarkers(settings: NODAtrailSettings): ScheduleMarkers {
  return {
    accepted: settings.dayMeetingMarker,
    tentative: settings.dayMeetingTentativeMarker,
    unanswered: settings.dayMeetingUnansweredMarker,
    declined: settings.dayMeetingDeclinedMarker,
    span: settings.daySpanMarker,
    place: settings.dayPlaceMarker,
    person: settings.dayPersonMarker,
  };
}

export interface ScheduleEntry {
  /**
   * Which of the two shapes the line is: an appointment, or a stretch of days.
   *
   * Read off the marker, which is the only thing that distinguishes them -- a
   * span is an untimed line and so is a meeting nobody gave a time.
   */
  kind: 'meeting' | 'span';
  /** What was answered, from the marker the line carries. Always empty for a span. */
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
 *
 * **Nor is a place or a person child.** Both belong to the entry above them,
 * and the week reads a day through here: without this, a lunch with a
 * restaurant and two people would draw four rows where the day draws one. They
 * are refused by the marker they carry rather than by being indented, which is
 * narrower on purpose -- the notes indented under a meeting have been read as
 * entries of their own since this file was written, `findDayEntry` accounts for
 * it, and changing what the week shows for those is a decision about an
 * existing behaviour rather than part of adding two new children.
 */
export function parseScheduleLine(line: string, markers: ScheduleMarkers): ScheduleEntry | null {
  const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
  if (!bullet) return null;

  let rest = (bullet[1] ?? '').trim();
  if (/^\[.\]/.test(rest)) return null;

  for (const child of [markers.place, markers.person]) {
    const mark = child.trim();
    if (mark && rest.startsWith(mark)) return null;
  }

  // Longest marker first, so a setting that is a prefix of another cannot
  // swallow it: two markers of one emoji plus a variation selector differ only
  // in their tail, and stripping the shorter would leave the difference
  // sitting in the text. The span marker is in the same sort for the same
  // reason, and it wins on its own length rather than by being tried first.
  const found = (['span', 'declined', 'unanswered', 'tentative', 'accepted'] as const)
    .map((key) => ({ key, mark: markers[key].trim() }))
    .filter((one) => one.mark !== '' && rest.startsWith(one.mark))
    .sort((a, b) => b.mark.length - a.mark.length)[0];

  let attendance: Attendance = '';
  let kind: ScheduleEntry['kind'] = 'meeting';
  if (found) {
    rest = rest.slice(found.mark.length).trim();
    if (found.key === 'span') kind = 'span';
    else if (found.key !== 'accepted') attendance = found.key;
  }

  const span = SPAN.exec(rest);
  const from = span?.[1] ?? '';
  const to = span?.[2] ?? '';
  if (span?.[0]) rest = rest.slice(span[0].length).trim();

  const links = [...rest.matchAll(WIKILINK)].map((match) => (match[1] ?? '').trim());
  const text = rest.replace(WIKILINK, '').replace(/\s+/g, ' ').trim();

  if (!text && links.length === 0) return null;
  // A span keeps no time even if the line carries one. Nothing this plugin
  // writes puts a clock on a span, so a line with both is one somebody typed,
  // and the round-trip guard in `read-day.ts` will refuse to edit it rather
  // than this reader quietly deciding which half to believe.
  return kind === 'span'
    ? { kind, attendance: '', from: '', to: '', text, links }
    : { kind, attendance, from, to, text, links };
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
    const entry = parseScheduleLine(line, scheduleMarkers(settings));
    if (entry) found.push(entry);
  }
  return found;
}
