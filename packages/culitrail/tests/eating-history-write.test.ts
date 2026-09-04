/**
 * The eating-history writer's body-section half.
 *
 * The round-trip cases are the point of this file. The plugin this code was
 * split out of wrote a log its own section parser could not read, which meant
 * every entry it wrote was invisible unless the frontmatter record happened to
 * be read too. These tests fail if that ever comes back.
 *
 * The merge cases are the second half of the contract: hand-written lines in
 * the section survive a write, because CULItrail's rule is that editing a note by
 * hand is always safe.
 */
import { describe, expect, it } from 'vitest';
import { mergeEatingHistory, parseEatingHistorySection } from '../src/meals/parser/eating-history';
import { applyEatingSection, readSectionPhotos } from '../src/meals/history/section-merge';
import { eatingRecordEntry } from '../src/meals/history/frontmatter-entry';
import { renderEatingLine } from '../src/meals/history/render-line';
import type { EatingRecord } from '../src/meals/history/types';

const HEADING = 'Eating History';

function record(over: Partial<EatingRecord> = {}): EatingRecord {
  return {
    id: 'c1',
    date: '2026-07-23T11:45',
    personLink: '[[Erika Muster]]',
    rating: 4,
    note: 'Sehr gut',
    ...over,
  };
}

function sectionOf(body: string): string {
  const lines = body.split('\n');
  const start = lines.findIndex((line) => line.trim() === `## ${HEADING}`);
  return lines.slice(start + 1).join('\n');
}

describe('the frontmatter entry', () => {
  it('writes the fields in the order a reader would want them', () => {
    expect(Object.keys(eatingRecordEntry(record()))).toEqual([
      'id',
      'date',
      'personLink',
      'rating',
      'note',
    ]);
  });

  it('omits an empty note rather than writing one per meal eaten', () => {
    // A household that says everything it wants to say with the star rating
    // would otherwise carry a `note: ""` line for every entry forever.
    expect(eatingRecordEntry(record({ note: '' }))).toEqual({
      id: 'c1',
      date: '2026-07-23T11:45',
      personLink: '[[Erika Muster]]',
      rating: 4,
    });
  });

  it('omits a person and a rating that were never given, but keeps a rating of 0', () => {
    // 0 is a real rating: "I ate this and did not like it" is not the same
    // information as "I have not rated this one."
    const entry = eatingRecordEntry({ id: 'c1', date: '2026-07-23T11:45', rating: 0, note: '' });
    expect(entry).toEqual({ id: 'c1', date: '2026-07-23T11:45', rating: 0 });
  });
});

describe('the rendered eating line', () => {
  it('is readable by the section parser it is written for', () => {
    const [line] = renderEatingLine(record(), null);
    const [entry] = parseEatingHistorySection(line);

    expect(entry.date).toBe('2026-07-23');
    expect(entry.rating).toBe(4);
    expect(entry.id).toBe('c1');
  });

  it('is not read back as a note, because it is a rendering of a record', () => {
    // The line says `11:45 · Erika Muster · Sehr gut`, all three parts
    // composed from fields the record already holds. Reading that back as the
    // note is what made the modal print the person twice on every row: once as
    // the person, once inside the note. A line with an id contributes its date,
    // its time, its rating and its identity, and no note.
    const [line] = renderEatingLine(record(), null);
    const [entry] = parseEatingHistorySection(line);

    expect(entry.id).toBe('c1');
    expect(entry.time).toBe('11:45');
    expect(entry.note).toBeNull();
  });

  it('keeps an HTML comment out of a note a person wrote', () => {
    // A hand-kept line carries no id, so its text *is* the note, and a comment
    // sitting in it must not become part of what a reader sees.
    const [entry] = parseEatingHistorySection(
      '- 2026-01-24 12:30 came out well <!-- check salt -->'
    );

    expect(entry.id).toBeNull();
    expect(entry.time).toBe('12:30');
    expect(entry.note).toBe('came out well');
  });

  it('carries the clock time into the line, since the day alone loses it', () => {
    const [line] = renderEatingLine(record({ date: '2026-07-23T18:30' }), null);
    expect(line).toContain('18:30');
  });

  it('writes no rating field when the meal was not rated', () => {
    const [line] = renderEatingLine(record({ rating: undefined }), null);
    expect(line).not.toContain('rating::');
    expect(parseEatingHistorySection(line)[0].rating).toBeNull();
  });

  it('writes a real zero, which is different information from unrated', () => {
    const [line] = renderEatingLine(record({ rating: 0 }), null);
    expect(parseEatingHistorySection(line)[0].rating).toBe(0);
  });

  it('puts a photo on its own indented line under the entry', () => {
    const lines = renderEatingLine(record(), 'dinner.png');
    expect(lines).toHaveLength(2);
    expect(lines[1].trim().startsWith('![[dinner.png|')).toBe(true);
  });

  it('uses no em dash, which the plugin ships in no rendered text', () => {
    const [line] = renderEatingLine(record(), null);
    expect(line).not.toContain('—');
  });
});

describe('one meal read from both places at once', () => {
  it('collapses to a single entry rather than appearing twice', () => {
    const written = record();
    const [line] = renderEatingLine(written, null);

    // What the two readers see: the frontmatter record holds the note, and the
    // body line is a rendering of the same record. Without the shared id these
    // would be two separate entries on one day.
    const merged = mergeEatingHistory(
      [
        {
          id: written.id,
          date: '2026-07-23',
          time: '11:45',
          rating: 4,
          note: 'Sehr gut',
          person: 'Erika Muster',
        },
      ],
      parseEatingHistorySection(line)
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].person).toBe('Erika Muster');
    expect(merged[0].rating).toBe(4);
    expect(merged[0].time).toBe('11:45');
    // The person appears once. The body line names them too, but that line is a
    // rendering of this record rather than a second source, so its text is not
    // read back as a note; otherwise the modal shows the name twice per row.
    expect(merged[0].note).toBe('Sehr gut');
  });

  it('still collapses a hand-kept log by date and note, with no id anywhere', () => {
    const merged = mergeEatingHistory(
      [
        {
          id: null,
          date: '2026-01-24',
          time: null,
          rating: null,
          note: 'good',
          person: null,
        },
      ],
      parseEatingHistorySection('- 2026-01-24 good')
    );
    expect(merged).toHaveLength(1);
  });
});

describe('applying the section to a note body', () => {
  it('appends the heading and the log to a note that has neither', () => {
    const body = applyEatingSection('Some prose.\n', HEADING, [record()], new Map());

    expect(body).toContain(`## ${HEADING}`);
    expect(body).toContain('Some prose.');
    expect(parseEatingHistorySection(sectionOf(body))).toHaveLength(1);
  });

  it('leaves a note alone when there is nothing to write into it', () => {
    expect(applyEatingSection('Some prose.\n', HEADING, [], new Map())).toBe('Some prose.\n');
  });

  it('keeps a hand-written line in the section', () => {
    const before = ['## Eating History', '- 2025-01-01 from before the plugin', ''].join('\n');
    const after = applyEatingSection(before, HEADING, [record()], new Map());

    expect(after).toContain('from before the plugin');
    expect(parseEatingHistorySection(sectionOf(after))).toHaveLength(2);
  });

  it('rewrites an entry in place rather than appending a second copy', () => {
    const first = applyEatingSection('', HEADING, [record()], new Map());
    const edited = applyEatingSection(first, HEADING, [record({ note: 'Zu salzig' })], new Map());

    const entries = parseEatingHistorySection(sectionOf(edited));
    expect(entries).toHaveLength(1);
    // Asserted on the raw line rather than on the parsed note: the line is a
    // rendering, so the new text has to be visible in the Markdown, while the
    // parsed note comes from the record instead.
    expect(sectionOf(edited)).toContain('Zu salzig');
    expect(sectionOf(edited)).not.toContain('Sehr gut');
  });

  it('drops the line for a record that has gone', () => {
    const first = applyEatingSection('', HEADING, [record(), record({ id: 'c2' })], new Map());
    expect(parseEatingHistorySection(sectionOf(first))).toHaveLength(2);

    const after = applyEatingSection(first, HEADING, [record()], new Map());
    const entries = parseEatingHistorySection(sectionOf(after));
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('c1');
  });

  it('removes the banner the inherited writer stamped on the section', () => {
    const before = [
      '## Eating History',
      '<!-- This section managed by the Recipe Box plugin. Manual edits will be overwritten. -->',
      '- **2026-07-23:** 11:45 · Erika <!--rb-id:c1-->',
    ].join('\n');

    const after = applyEatingSection(before, HEADING, [record()], new Map());
    expect(after).not.toContain('Recipe Box plugin');
  });

  it('upgrades a legacy rb-id line in place, since the id still matches', () => {
    const before = ['## Eating History', '- **2026-07-23:** 11:45 · Erika <!--rb-id:c1-->'].join(
      '\n'
    );
    const after = applyEatingSection(before, HEADING, [record()], new Map());

    expect(after).not.toContain('**2026-07-23:**');
    expect(parseEatingHistorySection(sectionOf(after))).toHaveLength(1);
  });

  it('does not disturb a section that follows the log', () => {
    const before = ['## Eating History', '', '## Notes', 'Works with rigatoni.'].join('\n');
    const after = applyEatingSection(before, HEADING, [record()], new Map());

    expect(after).toContain('## Notes');
    expect(after).toContain('Works with rigatoni.');
    expect(after.indexOf('culi-id:c1')).toBeLessThan(after.indexOf('## Notes'));
  });

  it('finds the section whatever heading level it was written at', () => {
    const before = ['# Eating History', '- 2025-01-01 older'].join('\n');
    const after = applyEatingSection(before, HEADING, [record()], new Map());

    expect(after).toContain('# Eating History');
    expect(after).not.toContain('## Eating History');
    // Lifted to `##` only so the section helper above, which looks for the
    // level this suite writes at, can find it.
    expect(
      parseEatingHistorySection(sectionOf(after.replace(`# ${HEADING}`, `## ${HEADING}`)))
    ).toHaveLength(2);
  });
});

describe('photos already in the section', () => {
  it('are recovered by id, so a rewrite does not lose them', () => {
    const body = applyEatingSection('', HEADING, [record()], new Map([['c1', 'dinner.png']]));
    expect(readSectionPhotos(body, HEADING).get('c1')).toBe('dinner.png');
  });

  it('survive the entry being edited', () => {
    const body = applyEatingSection('', HEADING, [record()], new Map([['c1', 'dinner.png']]));
    const photos = readSectionPhotos(body, HEADING);
    const edited = applyEatingSection(body, HEADING, [record({ note: 'again' })], photos);

    expect(edited).toContain('dinner.png');
  });

  it('ignore the size suffix, which is not part of the filename', () => {
    const body = [
      '## Eating History',
      '- 2026-07-23 x <!--culi-id:c1-->',
      '  ![[a b.png|200]]',
    ].join('\n');
    expect(readSectionPhotos(body, HEADING).get('c1')).toBe('a b.png');
  });
});
