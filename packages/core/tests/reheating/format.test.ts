/**
 * The reheating section as a file format: read, written, and read back.
 *
 * This section is written as well as read, so the round trip is the claim that
 * matters and it is asserted directly rather than inferred from the two halves
 * passing separately. Everything a note can carry goes through
 * `parse -> render -> parse` and has to come back the same.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APPLIANCES,
  findSection,
  parseApplianceEntries,
  renderFieldLine,
  renderReheatSection,
  upsertReheatSection,
  type ApplianceBlock,
  type ApplianceEntry,
} from '../../src/reheating';

const appliances = DEFAULT_APPLIANCES;

function blocks(...pairs: [string | null, string[]][]): ApplianceBlock[] {
  return pairs.map(([heading, lines]) => ({ heading, lines }));
}

function parse(...pairs: [string | null, string[]][]): ApplianceEntry[] {
  return parseApplianceEntries(blocks(...pairs), { appliances });
}

describe('reading a block into an entry', () => {
  it('reads prose as a step, which an instructions parser deliberately does not', () => {
    // A reheating block is one or two sentences. Treating unmarked prose as no
    // steps at all would make the common case invisible.
    const [read] = parse([
      'Steamer',
      [
        'Remove the clear plastic wrap from the dish. Use the reheat function at 95',
        'degrees Celsius and heat it for about 25 minutes.',
      ],
    ]);

    expect(read?.applianceId).toBe('steamer');
    expect(read?.steps).toHaveLength(1);
    expect(read?.steps[0]).toContain('about 25 minutes');
  });

  it('reads a list as one step per item', () => {
    expect(parse(['Oven', ['1. Preheat to 180 °C.', '2. Heat for 20 minutes.']])[0]?.steps).toEqual(
      ['Preheat to 180 °C.', 'Heat for 20 minutes.']
    );
  });

  it('splits prose on blank lines rather than gluing two sentences into one', () => {
    expect(parse(['Oven', ['Unwrap it.', '', 'Then heat it.']])[0]?.steps).toEqual([
      'Unwrap it.',
      'Then heat it.',
    ]);
  });

  it('reads the inline fields and keeps them out of the steps', () => {
    const [read] = parse(['Steamer', ['[temp:: 95 °C] [time:: 25 min]']]);

    expect(read?.temp).toBe('95 °C');
    expect(read?.time).toBe('25 min');
    expect(read?.steps).toEqual([]);
  });

  it('takes the field names it is given, because they are a setting in one app', () => {
    const read = parseApplianceEntries(blocks(['Oven', ['[grad:: 180 °C] [dauer:: 20 min]']]), {
      appliances,
      fields: { temp: 'grad', time: 'dauer' },
    });

    expect(read[0]).toMatchObject({ temp: '180 °C', time: '20 min' });
  });

  it('drops an appliance heading with nothing under it', () => {
    // It says only that somebody typed a heading. An empty instruction reads as a
    // parsing failure rather than as an absence.
    expect(
      parse(['Steamer', ['']], ['Oven', ['Heat for 20 minutes.']]).map((e) => e.applianceId)
    ).toEqual(['oven']);
  });

  it('ignores a block that names no appliance', () => {
    // Prose sitting directly under the section heading. Guessing which appliance
    // it meant would be worse than leaving it to render as part of the note.
    expect(parse([null, ['Do not refreeze.']], ['Oven', ['Heat it.']])).toHaveLength(1);
  });

  it('leaves a fenced block out of the instructions', () => {
    // Found on a real company note: the shared CRM note carries a
    // `culi-related-orders` fence after the section, and with no heading following
    // it every line landed inside the Steamer instruction.
    expect(
      parse(['Steamer', ['Remove the wrap and reheat.', '', '```culi-related-orders', '```']])[0]
        ?.steps
    ).toEqual(['Remove the wrap and reheat.']);
  });

  it('does not read an inline field out of a fenced example', () => {
    const [read] = parse(['Oven', ['```', '[temp:: 200 °C]', '```', 'Heat it.']]);

    expect(read?.temp).toBeNull();
    expect(read?.steps).toEqual(['Heat it.']);
  });

  it('never reads a reserved heading as an appliance', () => {
    // The real case: the cook-history writer emits `## Cook History` while these
    // notes write their other sections `#`, so a `# Reheating` pasted above the
    // log puts the log inside it. Without this the log was offered as a way to
    // reheat the dish.
    const read = parseApplianceEntries(
      blocks(['Steamer', ['[temp:: 95 °C]']], ['Cook History', ['- 2025-12-11 · Stefan']]),
      { appliances, reserved: ['Cook History', 'Ingredients'] }
    );

    expect(read.map((entry) => entry.label)).toEqual(['Steamer']);
  });
});

describe('writing a section', () => {
  it('writes the numbers as inline fields and the prose as it stands', () => {
    const section = renderReheatSection(parse(['Steamer', ['[temp:: 95 °C] [time:: 25 min]']]));

    expect(section).toContain('# Reheating');
    expect(section).toContain('## Steamer');
    expect(section).toContain('[temp:: 95 °C] [time:: 25 min]');
  });

  it('writes half a pair when only half is known', () => {
    expect(renderFieldLine({ temp: null, time: '3-7 min' })).toBe('[time:: 3-7 min]');
    expect(renderFieldLine({ temp: '180 °C', time: null })).toBe('[temp:: 180 °C]');
    expect(renderFieldLine({ temp: null, time: null })).toBe('');
  });

  it('writes nothing at all rather than a bare heading', () => {
    expect(renderReheatSection([])).toBe('');
  });

  it('takes the heading and the field names it is given', () => {
    const section = renderReheatSection(parse(['Oven', ['[temp:: 180 °C]']]), {
      heading: 'Aufwärmen',
      fields: { temp: 'grad', time: 'dauer' },
    });

    expect(section).toContain('# Aufwärmen');
    expect(section).toContain('[grad:: 180 °C]');
  });

  it('round-trips everything a block can carry', () => {
    const cases: [string, string[]][] = [
      ['Steamer', ['[temp:: 95 °C] [time:: 25 min]']],
      ['Oven', ['Preheat, then heat for 20 minutes.']],
      ['Microwave', ['[temp:: 800 W]', 'Pierce the film, stir halfway.']],
      ['Frying Pan', ['[time:: 3-7 min]']],
      ['Air fryer', ['Somehow.']],
    ];

    for (const [heading, lines] of cases) {
      const once = parse([heading, lines]);
      const written = renderReheatSection(once);
      const twice = parseApplianceEntries(
        // The renderer writes `## Heading` and its lines; splitting that back is
        // the caller's job, so it is done crudely here on purpose.
        blocks([heading, written.split('\n').filter((line) => !line.startsWith('#'))]),
        { appliances }
      );

      expect(twice, heading).toEqual(once);
    }
  });
});

describe('putting a section into a note', () => {
  const note = ['# Ingredients', '- Salt', '', '# Instructions', '1. Cook it.', ''].join('\n');

  it('adds one to a note that has none', () => {
    const next = upsertReheatSection(note, parse(['Oven', ['[temp:: 180 °C]']]));

    expect(next).toContain('# Ingredients');
    expect(next).toContain('1. Cook it.');
    expect(next).toContain('# Reheating');
    expect(next.indexOf('# Reheating')).toBeGreaterThan(next.indexOf('# Instructions'));
  });

  it('replaces the section it finds and leaves the rest of the note alone', () => {
    const with180 = upsertReheatSection(note, parse(['Oven', ['[temp:: 180 °C]']]));
    const with200 = upsertReheatSection(with180, parse(['Oven', ['[temp:: 200 °C]']]));

    expect(with200).toContain('[temp:: 200 °C]');
    expect(with200).not.toContain('180 °C');
    expect(with200).toContain('- Salt');
    // One section, not two.
    expect(with200.split('# Reheating')).toHaveLength(2);
  });

  it('removes the section when there is nothing left to say', () => {
    // How somebody takes the numbers back off a dish. An empty heading left
    // behind reads as a section that failed rather than one that is not there.
    const with180 = upsertReheatSection(note, parse(['Oven', ['[temp:: 180 °C]']]));

    expect(upsertReheatSection(with180, [])).not.toContain('Reheating');
    expect(upsertReheatSection(with180, [])).toContain('1. Cook it.');
  });

  it('keeps what follows the section, whatever the heading levels are', () => {
    // The note format this was built against writes `# Reheating` with `##`
    // appliances, so the section ends at the next heading of the same level.
    const body = [
      '# Reheating',
      '',
      '## Steamer',
      '[temp:: 95 °C]',
      '',
      '# Notes',
      'Do not refreeze.',
    ].join('\n');

    const next = upsertReheatSection(body, parse(['Oven', ['[temp:: 180 °C]']]));

    expect(next).toContain('# Notes');
    expect(next).toContain('Do not refreeze.');
    expect(next).not.toContain('Steamer');
  });

  it('finds the section at whatever level it was written', () => {
    expect(findSection('## Reheating\n### Oven\nHot.', 'Reheating')?.level).toBe(2);
    expect(findSection('# Ingredients\n- Salt', 'Reheating')).toBeNull();
  });

  it('does nothing to a note with no section and nothing to write', () => {
    expect(upsertReheatSection(note, [])).toBe(note);
  });
});
