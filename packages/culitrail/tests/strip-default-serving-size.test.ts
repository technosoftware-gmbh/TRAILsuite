/**
 * Taking `default_serving_size` off a vault's meal notes.
 *
 * The property said the same as `serving_size` in all 126 notes that carried
 * it, which is why it is going, and that is also what makes this suite mostly a
 * suite about refusals. Every rule below fires on a note the vault does not
 * have. The one the vault does have is one line shorter afterwards and
 * otherwise identical, and proving *otherwise identical* is the whole job: a
 * script that edits somebody's notes is trusted for what it leaves alone.
 *
 * **Every fixture is a real note, copied byte for byte out of
 * `Eating/Meals` and `Eating/Orders`**, and the refusal cases are derived from
 * those by a visible transformation rather than typed out. A hand-written
 * fixture agrees with whatever the code does.
 *
 * - `Federkohlrisotto` is the ordinary case: the two weights agree, spelled the
 *   same way, and the note has a body.
 * - `Grüne Casarecce mit Poulet` carries a Reheating section, which is what says
 *   whether the deletion stays inside the frontmatter block.
 * - `Safranrisotto mit Ratatouille` is one of the two meals whose serving weight
 *   is blank in both places. An empty property states nothing, so it goes.
 * - `Mediterrane Shrimpspfanne mit Couscous` never carried the property at all,
 *   which is the same nothing-to-do as a note this has already been run over.
 * - The order note stands in for anything that is not a meal and happens to be
 *   in the folder.
 */
import { describe, expect, it } from 'vitest';
import { mergeSettings } from '../src/settings/validate';
import { planNoteStrip } from '../scripts/strip-default-serving-size';
import { frontmatterOf } from '../scripts/note-text';

const settings = mergeSettings({});

// Verbatim, converted breakdown and all.
const FEDERKOHLRISOTTO = `---
type: meal
image: Eating/Meals/_resources/Federkohlrisotto.png
source:
servings: 1
prepTime:
reheatTime:
totalTime:
calories: 575.4
kj: 2406.6
protein: 23.52
fat: 29.82
carbs: 60.9
serving_size: 420g
default_serving_size: 420g
diet: Vegetarisch
lastEaten: 2026-03-02
eatenCount: 5
icon: ph-fork-knife
created: "2026-08-02T10:37"
modified: "2026-08-13T11:22"
caloriesPer100g: 137
kjPer100g: 573
macronutrients:
  - name: fat
    unit: g
    value: 7.1
  - name: saturatedFat
    unit: g
    value: 2.5
  - name: carbs
    unit: g
    value: 14.5
  - name: sugar
    unit: g
    value: 1.4
  - name: protein
    unit: g
    value: 5.6
micronutrients:
  - name: salt
    unit: g
---

mit gebratenen Pilzen und Sbrinz
`;

// Verbatim, Reheating section and all.
const CASARECCE = `---
type: meal
image: Eating/Meals/_resources/CasareccePouletKrautstiel.jpg
source: manual_source
servings: 1
prepTime:
reheatTime:
totalTime:
calories: 646.8
kj: 2688.4
protein: 40.92
fat: 19.8
carbs: 70.4
serving_size: 440g
default_serving_size: 440g
diet: Fleisch
icon: ph-fork-knife
created: "2026-08-06T16:32"
modified: "2026-08-06T16:36"
price: 17
caloriesPer100g: 147
kjPer100g: 611
macronutrients:
  - name: fat
    unit: g
    value: 4.5
  - name: saturatedFat
    unit: g
    value: 2.1
  - name: carbs
    unit: g
    value: 16
  - name: sugar
    unit: g
    value: 1
  - name: protein
    unit: g
    value: 9.3
micronutrients:
  - name: salt
    unit: g
    value: 1
---

# Reheating

## Steamer
[temp:: 95 °C] [time:: 25 min]

`;

// Verbatim. One of the two meals whose serving weight is blank on both lines.
const SAFRANRISOTTO = `---
type: meal
image: Eating/Meals/_resources/SafranrisottomitRatatouille.jpg
source:
servings: 1
prepTime:
reheatTime:
totalTime:
calories:
kj:
protein:
fat:
carbs:
serving_size:
default_serving_size:
diet: Vegetarisch
lastEaten: 2026-03-16
eatenCount: 5
icon: ph-fork-knife
created: "2026-08-02T10:37"
modified: "2026-08-13T11:22"
caloriesPer100g: 748
macronutrients:
  - name: fat
    unit: g
    value: 46.7
  - name: saturatedFat
    unit: g
  - name: carbs
    unit: g
    value: 50.7
  - name: sugar
    unit: g
  - name: protein
    unit: g
    value: 23.8
micronutrients:
  - name: salt
    unit: g
---

`;

// Verbatim. The one meal in the vault that never carried the property.
const SHRIMPSPFANNE = `---
type: meal
image: Eating/Meals/_resources/MediterraneShrimpspfannemitCouscous.png
created: "2026-08-14T15:19"
prepTime:
reheatTime:
totalTime:
servings:
diet: Fisch
supplier: "[[TomTasty AG]]"
modified: "2026-08-14T15:23"
calories:
protein:
fat:
carbs:
price: 18
---

`;

// Verbatim, out of `Eating/Orders`.
const ORDER = `---
type: order
company: "[[TomTasty AG]]"
orderDate: 2025-06-05
deliveryDate: 2025-06-11
price: 71
priceCurrency: CHF
selections:
  - person: "[[Erika Muster]]"
    meals:
      - "[[Bündner Pizokel mit Gemüse ⚖️]]"
      - "[[Satay Chicken mit Jasminreis ⚖️]]"
  - person: "[[Stefan Muster]]"
    meals:
      - "[[Älpler Magronen mit Speck]]"
      - "[[Satay Chicken mit Jasminreis ⚖️]]"
icon: shopping-cart
created: "2026-08-02T10:37"
modified: "2026-08-04T13:35"
---
`;

/** The block's own lines, fences excluded. */
function header(note: string): string[] {
  const block = frontmatterOf(note);
  if (!block) throw new Error('no frontmatter block');
  return block.lines.slice(1, block.close);
}

/** The lines under the block, which is everything the strip must not reach. */
function body(note: string): string[] {
  const block = frontmatterOf(note);
  if (!block) throw new Error('no frontmatter block');
  return block.body;
}

/** The same note with the two weights spelled differently. */
function respelled(note: string, servingSize: string, theOther: string): string {
  return note
    .replace(/^serving_size:.*$/m, `serving_size: ${servingSize}`)
    .replace(/^default_serving_size:.*$/m, `default_serving_size: ${theOther}`);
}

describe('the note the vault actually has', () => {
  const plan = planNoteStrip(FEDERKOHLRISOTTO, settings);

  it('strips the property', () => {
    expect(plan.state).toBe('stripped');
    expect(plan.text).not.toContain('default_serving_size');
  });

  it('leaves every other frontmatter line byte for byte, in order', () => {
    // Line for line rather than "the values still parse the same", because the
    // failure this is guarding against is a YAML round trip that reformats a
    // block to change one key in it. Requoting `created` would parse identically
    // and would still be this script editing a line it never came for.
    expect(header(plan.text)).toEqual(
      header(FEDERKOHLRISOTTO).filter((line) => !line.startsWith('default_serving_size:'))
    );
  });

  it('leaves the body byte for byte', () => {
    expect(body(plan.text)).toEqual(body(FEDERKOHLRISOTTO));
  });

  it('removes exactly one line and changes nothing else in the file', () => {
    const removed = FEDERKOHLRISOTTO.split('\n').filter(
      (line) => !line.startsWith('default_serving_size:')
    );
    expect(plan.text).toBe(removed.join('\n'));
  });

  it('leaves the serving weight the note still needs', () => {
    expect(plan.text).toContain('serving_size: 420g');
  });
});

describe('a note with a body section under the block', () => {
  it('stays inside the frontmatter', () => {
    const plan = planNoteStrip(CASARECCE, settings);
    expect(plan.state).toBe('stripped');
    expect(body(plan.text)).toEqual(body(CASARECCE));
    expect(plan.text).toContain('[temp:: 95 °C] [time:: 25 min]');
  });
});

describe('running it twice', () => {
  it('is a no-op the second time', () => {
    // The first run is the dry run and the second is the real one, so the third
    // is the one somebody does by accident. It has to find nothing to do.
    const once = planNoteStrip(FEDERKOHLRISOTTO, settings);
    const twice = planNoteStrip(once.text, settings);

    expect(twice.state).toBe('already-stripped');
    // By reference: nothing was rebuilt, so nothing can have moved.
    expect(twice.text).toBe(once.text);
  });

  it('reports a note that never carried it as nothing to do', () => {
    const plan = planNoteStrip(SHRIMPSPFANNE, settings);
    expect(plan.state).toBe('already-stripped');
    expect(plan.text).toBe(SHRIMPSPFANNE);
  });
});

describe('a blank value', () => {
  it('goes even though the note has no serving weight either', () => {
    // Both lines are blank in this real note. An empty property states nothing,
    // so nothing is lost with it, and refusing here would leave two meals
    // carrying a key that no longer exists for the sake of a rule about values.
    const plan = planNoteStrip(SAFRANRISOTTO, settings);

    expect(plan.state).toBe('stripped');
    expect(plan.text).not.toContain('default_serving_size');
    expect(plan.text).toContain('serving_size:\n');
  });
});

describe('the same weight spelled differently', () => {
  it('counts as the same weight', () => {
    // `440g`, `440 g` and `440` are one weight to the plugin's own reader, and
    // a script that refused them would refuse a note nobody has damaged.
    for (const [left, right] of [
      ['420g', '420 g'],
      ['420g', '420'],
      ['420', '420g'],
    ]) {
      const plan = planNoteStrip(respelled(FEDERKOHLRISOTTO, left, right), settings);
      expect(plan.state).toBe('stripped');
    }
  });

  it('does not treat two unreadable values as equal', () => {
    // Neither parses to a number, so a comparison on numbers alone would find
    // them both null and delete a sentence somebody wrote.
    const note = respelled(FEDERKOHLRISOTTO, 'ein Teller', 'eine Schale');
    expect(planNoteStrip(note, settings).state).toBe('failed');

    const same = respelled(FEDERKOHLRISOTTO, 'ein Teller', 'ein Teller');
    expect(planNoteStrip(same, settings).state).toBe('stripped');
  });
});

describe('what it refuses', () => {
  const refuses = (note: string): ReturnType<typeof planNoteStrip> => {
    const plan = planNoteStrip(note, settings);
    expect(plan.state).toBe('failed');
    // The note comes back by reference, so a refusal cannot have half-written.
    expect(plan.text).toBe(note);
    expect(plan.detail).not.toBe('');
    return plan;
  };

  it('refuses a value that disagrees with serving_size', () => {
    const plan = refuses(respelled(FEDERKOHLRISOTTO, '420g', '430g'));
    expect(plan.detail).toContain('serving_size');
  });

  it('refuses when serving_size is absent and this one states a weight', () => {
    // The refusal that matters most: the property being removed would be the
    // only weight the note has left.
    const plan = refuses(FEDERKOHLRISOTTO.replace('serving_size: 420g\n', ''));
    expect(plan.detail).toContain('absent');
  });

  it('refuses when serving_size is blank and this one states a weight', () => {
    const plan = refuses(respelled(SAFRANRISOTTO, '', '420g'));
    expect(plan.detail).toContain('blank');
  });

  it('refuses a note that states it twice', () => {
    // A duplicate key drops a note out of every view in Obsidian. Removing one
    // of the two would hide that rather than fix it.
    const plan = refuses(
      FEDERKOHLRISOTTO.replace(
        'default_serving_size: 420g\n',
        'default_serving_size: 420g\ndefault_serving_size: 420g\n'
      )
    );
    expect(plan.detail).toContain('twice');
  });

  it('refuses a value that runs past one line', () => {
    // A list under the key means this is some other property that happens to
    // share the name, and a one-line deletion would leave its entries orphaned.
    const plan = refuses(
      FEDERKOHLRISOTTO.replace(
        'default_serving_size: 420g\n',
        'default_serving_size:\n  - 420g\n  - 210g\n'
      )
    );
    expect(plan.detail).toContain('single line');
  });

  it('refuses frontmatter it cannot parse', () => {
    const plan = refuses(FEDERKOHLRISOTTO.replace('diet: Vegetarisch', 'diet: "unclosed'));
    expect(plan.detail).toContain('does not parse');
  });
});

describe('what it passes over', () => {
  it('skips a note that is not a meal', () => {
    const plan = planNoteStrip(ORDER, settings);
    expect(plan.state).toBe('skipped');
    expect(plan.text).toBe(ORDER);
  });

  it('skips a note with no frontmatter block', () => {
    const plan = planNoteStrip('Just a note.\n\ndefault_serving_size: 420g\n', settings);
    expect(plan.state).toBe('skipped');
    expect(plan.detail).toBe('no frontmatter block');
  });

  it('leaves a property that only looks like the one it came for', () => {
    // A key whose name merely starts the same is a different key. This is what
    // makes the `startsWith` on `default_serving_size:` safe rather than lucky.
    const note = FEDERKOHLRISOTTO.replace(
      'default_serving_size: 420g\n',
      'default_serving_size_note: gemessen\n'
    );
    const plan = planNoteStrip(note, settings);

    expect(plan.state).toBe('already-stripped');
    expect(plan.text).toBe(note);
  });
});

describe('a differently spelled property', () => {
  it('is what --property is for, now that no setting holds the name', () => {
    // The setting that used to carry this name is gone, so the flag is the only
    // way a vault that spelled it differently can say so.
    const note = FEDERKOHLRISOTTO.replace('default_serving_size:', 'portion_default:');

    expect(planNoteStrip(note, settings).state).toBe('already-stripped');

    const plan = planNoteStrip(note, settings, 'portion_default');
    expect(plan.state).toBe('stripped');
    expect(plan.text).not.toContain('portion_default');
  });
});

describe('a note with Windows line endings', () => {
  it('keeps every other line ending exactly as it found it', () => {
    const crlf = FEDERKOHLRISOTTO.replace(/\n/g, '\r\n');
    const plan = planNoteStrip(crlf, settings);

    expect(plan.state).toBe('stripped');
    expect(plan.text).toBe(crlf.replace('default_serving_size: 420g\r\n', ''));
  });
});
