/**
 * The sample-vault planner, which decides whether a vault may be seeded.
 *
 * The rule under test is the one a user is trusting when they run this against
 * a vault that already holds their own notes, so the cases that matter are the
 * refusals rather than the happy path.
 */
import { describe, expect, it } from 'vitest';
import {
  planSampleVault,
  sampleAugmentCount,
  sampleFolders,
  sampleSkipCount,
  sampleVaultWritable,
  sampleWriteCount,
  type SampleNote,
} from '../src/sample/plan';

function note(folder: string, title: string, typeValue = 'city'): SampleNote {
  return { folder, title, typeValue, properties: {}, body: '' };
}

/** A person note, which is the kind that carries a block another plugin may already have written. */
function person(title: string): SampleNote {
  return { ...note('CRM/People', title, 'person'), ensureBlock: 'travel-related-trips' };
}

const NOTES: SampleNote[] = [
  note('Places/Cities', 'Brugg'),
  note('Places/Cities', 'Cape Town'),
  note('CRM/People', 'Stefan', 'person'),
  note('CRM/People', 'Erika', 'person'),
];

describe('planSampleVault', () => {
  it('writes everything into an empty vault', () => {
    const plan = planSampleVault(NOTES, []);

    expect(plan.notes.map((entry) => entry.status)).toEqual(['write', 'write', 'write', 'write']);
    expect(plan.occupied).toEqual([]);
    expect(plan.unconfigured).toEqual([]);
    expect(sampleVaultWritable(plan)).toBe(true);
    expect(sampleWriteCount(plan)).toBe(4);
  });

  it('skips a note that is already there rather than overwriting it', () => {
    // The case that makes the whole feature work: a second plugin seeded into
    // a vault the first one already put its people in.
    const plan = planSampleVault(NOTES, [{ folder: 'CRM/People', titles: ['Stefan', 'Erika'] }]);

    expect(plan.notes.map((entry) => entry.status)).toEqual(['write', 'write', 'exists', 'exists']);
    expect(plan.occupied).toEqual([]);
    expect(sampleVaultWritable(plan)).toBe(true);
    expect(sampleWriteCount(plan)).toBe(2);
    expect(sampleSkipCount(plan)).toBe(2);
  });

  it('refuses a folder holding a note the plan never named', () => {
    const plan = planSampleVault(NOTES, [
      { folder: 'CRM/People', titles: ['Stefan', 'Beatrice Aeschlimann'] },
    ]);

    expect(plan.occupied).toEqual([{ folder: 'CRM/People', strangers: ['Beatrice Aeschlimann'] }]);
    expect(sampleVaultWritable(plan)).toBe(false);
  });

  it('still plans the notes it would write when a folder refuses', () => {
    // The preview shows what would have happened alongside why it will not, so
    // the refusal reads as a decision rather than as a failure.
    const plan = planSampleVault(NOTES, [{ folder: 'Places/Cities', titles: ['Basel'] }]);

    expect(sampleWriteCount(plan)).toBe(4);
    expect(plan.occupied.map((entry) => entry.folder)).toEqual(['Places/Cities']);
    expect(sampleVaultWritable(plan)).toBe(false);
  });

  it('names a note whose folder setting is blank and refuses the run', () => {
    const plan = planSampleVault([...NOTES, note('', 'Nowhere')], []);

    expect(plan.unconfigured).toEqual(['Nowhere']);
    expect(plan.notes).toHaveLength(4);
    expect(sampleVaultWritable(plan)).toBe(false);
  });

  it('names a note whose type value is blank, which would be invisible once written', () => {
    const plan = planSampleVault([note('Places/Cities', 'Untyped', '')], []);

    expect(plan.unconfigured).toEqual(['Untyped']);
    expect(sampleVaultWritable(plan)).toBe(false);
  });

  it('is not writable when every note is already there', () => {
    const plan = planSampleVault(NOTES, [
      { folder: 'Places/Cities', titles: ['Brugg', 'Cape Town'] },
      { folder: 'CRM/People', titles: ['Stefan', 'Erika'] },
    ]);

    expect(plan.occupied).toEqual([]);
    expect(sampleWriteCount(plan)).toBe(0);
    expect(sampleVaultWritable(plan)).toBe(false);
  });

  it('reports a stranger in one folder without blaming the other', () => {
    const plan = planSampleVault(NOTES, [
      { folder: 'Places/Cities', titles: ['Brugg'] },
      { folder: 'CRM/People', titles: ['Someone Else'] },
    ]);

    expect(plan.occupied.map((entry) => entry.folder)).toEqual(['CRM/People']);
  });
});

describe('the block a second plugin adds to a note the first one wrote', () => {
  const NOTES = [note('Places/Cities', 'Brugg'), person('Stefan'), person('Erika')];

  it('appends to an existing note that lacks the block', () => {
    const plan = planSampleVault(NOTES, [
      { folder: 'CRM/People', titles: ['Stefan', 'Erika'], withoutBlock: ['Stefan', 'Erika'] },
    ]);

    expect(plan.notes.filter((entry) => entry.augment).map((entry) => entry.note.title)).toEqual([
      'Stefan',
      'Erika',
    ]);
    expect(sampleAugmentCount(plan)).toBe(2);
  });

  it('leaves alone an existing note that already carries it', () => {
    const plan = planSampleVault(NOTES, [
      { folder: 'CRM/People', titles: ['Stefan', 'Erika'], withoutBlock: ['Erika'] },
    ]);

    expect(sampleAugmentCount(plan)).toBe(1);
  });

  it('appends nothing when the caller did not look', () => {
    // No `withoutBlock` means nothing was read, and a caller that does not look
    // does not get to write.
    const plan = planSampleVault(NOTES, [{ folder: 'CRM/People', titles: ['Stefan', 'Erika'] }]);

    expect(sampleAugmentCount(plan)).toBe(0);
  });

  it('never marks a note it is about to write as one to append to', () => {
    const plan = planSampleVault(NOTES, [
      { folder: 'CRM/People', titles: [], withoutBlock: ['Stefan'] },
    ]);

    expect(sampleAugmentCount(plan)).toBe(0);
    expect(sampleWriteCount(plan)).toBe(3);
  });

  it('is worth running for the blocks alone when every note is already there', () => {
    const plan = planSampleVault(
      [person('Stefan')],
      [{ folder: 'CRM/People', titles: ['Stefan'], withoutBlock: ['Stefan'] }]
    );

    expect(sampleWriteCount(plan)).toBe(0);
    expect(sampleVaultWritable(plan)).toBe(true);
  });

  it('never appends to a note that declares no block of its own', () => {
    const plan = planSampleVault(
      [note('Places/Cities', 'Brugg')],
      [{ folder: 'Places/Cities', titles: ['Brugg'], withoutBlock: ['Brugg'] }]
    );

    expect(sampleAugmentCount(plan)).toBe(0);
    expect(sampleVaultWritable(plan)).toBe(false);
  });
});

describe('a shared folder, which is the exception the combined vault forced', () => {
  // The case that broke it: APERtrail seeds a travel operator into
  // `CRM/Companies`, CULItrail seeds a meal supplier, and neither contract says
  // which companies a vault holds.
  const NOTES: SampleNote[] = [
    { ...note('Eating/Meals', 'Tom Yum Gai', 'meal') },
    { ...note('CRM/Companies', 'TomTasty AG', 'company'), shared: true },
    { ...person('Stefan'), shared: true },
  ];

  it('writes beside a sibling company rather than refusing the whole run', () => {
    const plan = planSampleVault(NOTES, [
      { folder: 'CRM/Companies', titles: ['Rovos Rail Charters'] },
    ]);

    expect(plan.occupied).toEqual([]);
    expect(plan.shared).toEqual([{ folder: 'CRM/Companies', others: ['Rovos Rail Charters'] }]);
    expect(sampleVaultWritable(plan)).toBe(true);
  });

  it('still refuses on a folder that is not shared', () => {
    const plan = planSampleVault(NOTES, [
      { folder: 'CRM/Companies', titles: ['Rovos Rail Charters'] },
      { folder: 'Eating/Meals', titles: ['Sunday Roast'] },
    ]);

    expect(plan.occupied.map((entry) => entry.folder)).toEqual(['Eating/Meals']);
    expect(plan.shared.map((entry) => entry.folder)).toEqual(['CRM/Companies']);
    expect(sampleVaultWritable(plan)).toBe(false);
  });

  it('says nothing about a shared folder holding only notes the plan names', () => {
    const plan = planSampleVault(NOTES, [{ folder: 'CRM/People', titles: ['Stefan'] }]);

    expect(plan.shared).toEqual([]);
  });

  it('does not share a folder because some other folder is shared', () => {
    const plan = planSampleVault(NOTES, [{ folder: 'Eating/Meals', titles: ['Sunday Roast'] }]);

    expect(plan.shared).toEqual([]);
    expect(plan.occupied.map((entry) => entry.folder)).toEqual(['Eating/Meals']);
  });
});

describe('sampleFolders', () => {
  it('lists each folder once, in first-seen order, ignoring the unconfigured', () => {
    expect(sampleFolders([...NOTES, note('', 'Nowhere')])).toEqual(['Places/Cities', 'CRM/People']);
  });
});
