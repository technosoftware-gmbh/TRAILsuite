/**
 * The summary row: that every note's editor draws one, and what saving it
 * says.
 *
 * The trip editor had this field alone for a year. Every other note in the
 * vault carries the same block, the prospect prints it, and there was no way
 * to edit it except by opening the note -- which is what "every entity type
 * gets this field" was decided to fix. A field added to four editors and
 * forgotten in the fifth is exactly the defect this package keeps finding, so
 * the coverage is asserted over the editors rather than over one of them.
 *
 * **The first suite reads source, because the alternative could not fail.**
 * Instantiating five modals would mean standing up a vault, a settings object
 * and a board for each, and what would be under test is still one argument at
 * one call site. Removing `summary:` from an editor is what this goes red on;
 * it has been done on purpose and watched.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('obsidian', async () => (await import('./fake-dom')).obsidianMock());

import { control, notices, resetSettings, rowsNamed } from './fake-dom';
import { saveNoteSummary, summaryField } from '../src/ui/components/summary-field';
import { t } from '../src/lang/I18nManager';

const SRC = join(__dirname, '..', 'src');

function sources(dir: string, out: { path: string; text: string }[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sources(full, out);
    else if (entry.name.endsWith('.ts')) out.push({ path: full, text: readFileSync(full, 'utf8') });
  }
  return out;
}

/** Each `coverFields(` call, as the text of its own argument object. */
function coverCalls(text: string): string[] {
  return text
    .split('coverFields(')
    .slice(1)
    .filter((chunk) => chunk.startsWith('contentEl') || chunk.startsWith('this.bodyEl'));
}

describe('every editor that draws a note offers its summary', () => {
  const files = sources(SRC);

  it('has editors to check, so a broken scan cannot pass silently', () => {
    // A floor rather than a census. What it guards is the scan: a `coverCalls`
    // that stopped matching would make the check below pass over nothing,
    // which is this package's own recurring defect in a test.
    const calls = files.flatMap((file) => coverCalls(file.text));
    expect(calls.length).toBeGreaterThanOrEqual(4);
  });

  it('passes a summary at every one of those call sites', () => {
    const missing: string[] = [];
    for (const file of files) {
      for (const call of coverCalls(file.text)) {
        if (!call.includes('summary: {')) missing.push(file.path);
      }
    }
    expect(missing).toEqual([]);
  });

  /** The one editor that draws no cover, because a trip's presentation section is its own. */
  it('leaves the trip editor drawing the row directly', () => {
    const trip = files.find((file) => file.path.endsWith('trip-editor-modal.ts'));
    expect(trip?.text).toContain('summaryField(');
  });
});

describe('the row', () => {
  beforeEach(() => resetSettings());

  it('is a text area under the label every editor uses', () => {
    summaryField({} as never, { value: 'Alt.', onChange: () => {} });

    expect(rowsNamed(t('modals.noteSummary.field'))).toHaveLength(1);
    expect(control(t('modals.noteSummary.field'), 'textarea')?.value).toBe('Alt.');
  });

  it('hands what was typed straight back, lists and all', () => {
    let typed = '';
    summaryField({} as never, {
      value: '',
      onChange: (value) => {
        typed = value;
      },
    });

    control(t('modals.noteSummary.field'), 'textarea')?.change?.(
      '- Nordkap\n- Hammerfest' as never
    );

    expect(typed).toBe('- Nordkap\n- Hammerfest');
  });
});

/**
 * A note with two summary callouts.
 *
 * Everything reads the first, so the second is text nothing shows, nothing
 * prints and nothing edits -- and the note looks fine. That is the case worth
 * a sentence rather than silence. The save still goes through: refusing it
 * would block an edit over what is almost always a paste that went in twice.
 */
describe('saving a note that holds more than one', () => {
  const file = { path: 'Plätze/Ausflüge/Wikinger.md' } as never;
  let text = '';
  let writes: string[] = [];
  const app = {
    vault: {
      read: async () => text,
      modify: async (_file: unknown, content: string) => {
        writes.push(content);
        text = content;
      },
    },
  } as never;

  beforeEach(() => {
    notices.length = 0;
    writes = [];
    text = '---\ntype: excursion\n---\n\n> [!summary]\n> Alt.\n';
  });

  it('says nothing about a note with one', async () => {
    await saveNoteSummary(app, file, 'Neu.');

    expect(writes).toHaveLength(1);
    expect(notices).toEqual([]);
  });

  it('says so about a note with two, and saves anyway', async () => {
    text = `${text}\n> [!SUMMARY]+\n> Noch einer.\n`;

    await saveNoteSummary(app, file, 'Neu.');

    expect(writes[0]).toContain('> Neu.');
    expect(notices).toEqual([t('modals.noteSummary.extraCallouts')]);
  });
});
