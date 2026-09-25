/**
 * The entries in one day note's body, parsed and located. Pure: no note, no host.
 *
 * Split out of `read-day.ts`, which reads the note inside Obsidian and decides
 * whether an entry may be edited. That decision composes the entry back into
 * a line in the current language, which only Obsidian knows, so it arrives
 * here as `reproduces`: `read-day.ts` passes the real check, and the
 * interchange export, which edits nothing, passes one of its own. Everything
 * else about reading an entry is here once. `read-day.ts` says why the round
 * trip is the arbiter of editing.
 */
import { splitTaskFields } from '@technosoftware/trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { emptyDraft, type DayEntryDraft, type DayEntryKind, type FollowUp } from './day-draft';
import { parseScheduleLine, scheduleMarkers } from './schedule-line';

/** Whether composing `draft` gives back the `original` lines: the edit guard, decided by the caller. */
export type Reproduces = (draft: DayEntryDraft, original: string[]) => boolean;

export interface DayEntryRecord {
  kind: DayEntryKind;
  draft: DayEntryDraft;
  /** What to show: the line's own text, already stripped of marker and time. */
  label: string;
  /** `11:00-12:00`, or empty. */
  span: string;
  links: string[];
  /** Zero-based, into the **body** rather than the file. Half open, so a meeting covers its children. */
  from: number;
  to: number;
  /** False when the line says something the dialog has no field for. */
  editable: boolean;
}

/** The lines of a section, with the index each one sits at in the body. */
function sectionLines(body: string, headings: readonly string[]): { line: string; at: number }[] {
  const lines = body.split('\n');
  const start = lines.findIndex((line) =>
    headings.some((heading) => line.trim() === heading.trim())
  );
  if (start === -1) return [];

  const level = (/^(#{1,6})\s/.exec(lines[start] ?? '')?.[1] ?? '').length;
  const out: { line: string; at: number }[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const next = (/^(#{1,6})\s/.exec(lines[index] ?? '')?.[1] ?? '').length;
    if (next > 0 && next <= level) break;
    out.push({ line: lines[index] ?? '', at: index });
  }
  return out;
}

/** A meeting's children: the indented lines that follow it, up to the next unindented bullet. */
function childrenOf(lines: readonly { line: string; at: number }[], index: number): number {
  let end = index + 1;
  while (end < lines.length && /^\s+\S/.test(lines[end]?.line ?? '')) end += 1;
  return end;
}

export function meetingsOf(
  body: string,
  settings: NODAtrailSettings,
  headings: readonly string[],
  reproduces: Reproduces
): DayEntryRecord[] {
  const lines = sectionLines(body, headings);
  const out: DayEntryRecord[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const row = lines[index];
    if (!row || /^\s/.test(row.line)) continue;

    const parsed = parseScheduleLine(row.line, scheduleMarkers(settings));
    if (!parsed) continue;

    // **A span adopts its children too, and it did not used to.** The note
    // against this said a span "is a fortnight away and has no room", which is
    // true of a holiday and false of a week in a hotel: that has a place and
    // the people who came, and both are true of every day of it. What a span
    // still does not take is what was said and what follows -- a fortnight has
    // no room in the sense that matters there -- so a checkbox indented under
    // one is a line this cannot compose back, and the entry goes read-only
    // rather than being rewritten without it. See J.8 of
    // `docs/design/day-entry-links.md`.
    const end = childrenOf(lines, index);
    const own = lines.slice(index, end).map((entry) => entry.line);
    const place = childLinks(own, settings.dayPlaceMarker).at(0) ?? '';
    const persons = childLinks(own, settings.dayPersonMarker);

    const draft: DayEntryDraft =
      parsed.kind === 'span'
        ? {
            ...emptyDraft('span'),
            text: parsed.text,
            context: parsed.links[0] ?? '',
            place,
            persons,
          }
        : {
            ...emptyDraft('meeting'),
            attendance: parsed.attendance,
            text: parsed.text,
            context: parsed.links[0] ?? '',
            startTime: parsed.from,
            endTime: parsed.to,
            place,
            persons,
            notes: childText(own, settings),
            followUps: childTasks(own),
          };

    out.push({
      kind: parsed.kind,
      draft,
      label: parsed.text,
      span: parsed.from && parsed.to ? `${parsed.from}-${parsed.to}` : parsed.from || parsed.to,
      // **Every link the entry carries, headline and children alike.** What a
      // view may show is everything the note says; what the dialog may rewrite
      // is only what composes back, and a read-only entry still gets its chips.
      links: [...parsed.links, ...(place ? [place] : []), ...persons],
      from: row.at,
      to: (lines[end - 1]?.at ?? row.at) + 1,
      editable: reproduces(draft, own),
    });
    index = end - 1;
  }
  return out;
}

/**
 * The titles named on an entry's child lines under one marker.
 *
 * **Exactly one wikilink and nothing else counts.** A child carrying a title
 * plus somebody's own words is a line the dialog has no field for, so it is not
 * read back here; the round trip then fails and the entry is shown read-only
 * rather than rewritten without what it said. That is the same arbiter the
 * headline already has, applied one level down.
 *
 * A blank marker reads nothing, which is what "do not distinguish these" means.
 */
function childLinks(own: readonly string[], marker: string): string[] {
  const mark = marker.trim();
  if (!mark) return [];

  return own.slice(1).flatMap((line) => {
    const rest = /^\s*[-*+]\s+(.*)$/.exec(line)?.[1]?.trim() ?? '';
    if (!rest.startsWith(mark)) return [];
    const link = /^\[\[([^\]]+)\]\]$/.exec(rest.slice(mark.length).trim());
    return link ? [(link[1] ?? '').trim()] : [];
  });
}

/**
 * The indented note lines under a meeting, as the dialog's box would hold them.
 *
 * **A place or a person child is not a note.** All three are children of the
 * same shape, and a reader that took everything indented would put
 * `\u{1F4CD} [[Gifthuettli]]` in the notes box, write it back as a note on save,
 * and lose the place. So the two marked kinds are skipped here by the marker
 * they carry.
 */
function childText(own: readonly string[], settings: NODAtrailSettings): string {
  const mark = settings.dayNoteMarker.trim();
  const others = [settings.dayPlaceMarker.trim(), settings.dayPersonMarker.trim()].filter(Boolean);

  return own
    .slice(1)
    .filter((line) => !/^\s*[-*+]\s+\[.\]/.test(line))
    .map((line) => /^\s*[-*+]\s+(.*)$/.exec(line)?.[1]?.trim() ?? '')
    .filter((rest) => !others.some((other) => rest.startsWith(other)))
    .map((rest) => (mark && rest.startsWith(mark) ? rest.slice(mark.length).trim() : rest))
    .filter((line) => line !== '')
    .join('\n');
}

/**
 * The indented checkbox lines under a meeting, as the row editor holds them.
 *
 * **Read back into the three fields the row actually has**, by `splitTaskFields`
 * undoing what `composeTaskLine` did: the project is one wikilink at the end,
 * and the date follows it. Anything else on the line stays in `text`, which is
 * what keeps this safe -- a line carrying a priority marker, a second link or
 * somebody's own wording comes back with that part in the text field, composes
 * to the same characters, and is edited without losing it.
 *
 * **The round trip is still the arbiter**, as it is for the meeting line
 * itself: if lifting these parts out and putting them back does not reproduce
 * the line, `reproduces()` says so and the meeting goes read-only. Nothing here
 * has to decide that for itself.
 *
 * This used to keep the remainder whole, on the reasoning that a link and a
 * date put back separately would land in a different order. They do not -- the
 * order above is the one they were written in. What the whole-remainder reading
 * cost was worse than untidy: the row's date box was always empty and setting
 * it did nothing, and choosing a project appended a second link after the date.
 */
function childTasks(own: readonly string[]): FollowUp[] {
  return own
    .slice(1)
    .map((line) => /^\s*[-*+]\s+\[.\]\s*(.*)$/.exec(line)?.[1] ?? '')
    .filter((line) => line !== '')
    .map((line) => splitTaskFields(line));
}

export function thoughtsOf(
  body: string,
  settings: NODAtrailSettings,
  headings: readonly string[],
  reproduces: Reproduces
): DayEntryRecord[] {
  const lines = sectionLines(body, headings);
  const out: DayEntryRecord[] = [];

  for (const row of lines) {
    if (/^\s/.test(row.line)) continue;
    // No markers: a thought's own marker is read below, and handing the
    // meeting markers to a note would strip one off a line that merely starts
    // with the same emoji.
    const parsed = parseScheduleLine(row.line, {
      accepted: '',
      tentative: '',
      unanswered: '',
      declined: '',
      span: '',
      // Blank for the same reason as the five above: this section's lines are
      // thoughts, and a note that merely starts with the same emoji must not
      // be refused for it. Nothing writes a child under a thought anyway, and
      // an indented line is skipped before this is reached.
      place: '',
      person: '',
    });
    if (!parsed) continue;

    // Which of the two it is comes from the marker it carries. A line with
    // neither is a note: that is the milder reading, and the one that does not
    // claim somebody wrote down an idea when they wrote down a fact.
    const idea = settings.dayIdeaMarker.trim();
    const rest = /^\s*[-*+]\s+(.*)$/.exec(row.line)?.[1]?.trim() ?? '';
    const kind: DayEntryKind = idea && rest.startsWith(idea) ? 'idea' : 'note';

    const marker = kind === 'idea' ? idea : settings.dayNoteMarker.trim();
    const text = marker && rest.startsWith(marker) ? rest.slice(marker.length).trim() : rest;
    const links = [...text.matchAll(/\[\[([^\]]+)\]\]/g)].map((match) => (match[1] ?? '').trim());

    const draft: DayEntryDraft = {
      ...emptyDraft(kind),
      text: text
        .replace(/\[\[[^\]]+\]\]/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
      context: links[0] ?? '',
    };

    out.push({
      kind,
      draft,
      label: draft.text,
      span: '',
      links,
      from: row.at,
      to: row.at + 1,
      editable: reproduces(draft, [row.line]),
    });
  }
  return out;
}
