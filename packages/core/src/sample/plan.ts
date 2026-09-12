/**
 * Planning a sample vault: what would be written, and what stands in the way.
 *
 * Three plugins each ship a "create the sample notes" command, and all three
 * face the same two questions before writing anything -- is this vault empty
 * enough to be seeded, and which of these notes is already there. The answers
 * are the same arithmetic in every case, so they live here rather than three
 * times over. The **content** does not: a sample note is product material, in
 * one product's voice, and it stays in the plugin that ships it.
 *
 * The planner writes nothing and touches no vault. It is handed the notes a
 * plugin wants and a description of what the target folders already hold, and
 * it answers. That is what makes the refusal rule below testable at all: it is
 * the rule a user is trusting when they run this against a vault they care
 * about.
 *
 * ## The refusal rule
 *
 * **A target folder may hold nothing except notes this plan would itself
 * write.** Anything else in it is a stranger, and one stranger refuses the
 * whole run.
 *
 * The obvious rule -- refuse a folder that is not empty -- is wrong in exactly
 * the case this feature exists for. Two plugins seeded into one vault both
 * write the same `CRM/People`, because the shared CRM contract is the thing
 * worth demonstrating; the second one to run would find the first one's people
 * there and give up. Naming the strangers instead lets the second run recognise
 * its own notes, skip them, and refuse a folder that holds somebody's real
 * work. A person note the plan names is not evidence of a real vault. A note
 * the plan has never heard of is.
 *
 * Refusal is whole-plan rather than per-folder on purpose. Half a sample vault
 * is worse than none: the notes reference each other, and a partial seed is a
 * screen full of unresolved wikilinks that looks like a broken plugin rather
 * than a skipped folder.
 *
 * ## The one exception, and why it had to exist
 *
 * The CRM folders are the exception, marked `shared` on the notes that live in
 * them. The rule above was written for `CRM/People`, where all three plugins
 * seed the same two people and nobody is a stranger to anybody -- and it broke
 * on `CRM/Companies` the first time the combined vault was actually tried. Each
 * plugin seeds the company its own notes need, a travel operator or a meal
 * supplier, and there is no contract saying which companies a vault holds. So
 * the second plugin to run found the first one's supplier sitting there, called
 * it a stranger, and refused everything.
 *
 * A shared folder therefore never refuses. What it does instead is report what
 * is already in it, so the preview can say "two notes will be added beside the
 * nine already here" and let a person decide. The safety the refusal rule buys
 * is still bought everywhere else: a vault with real trips, real meals or real
 * day notes in it refuses on those folders, and a vault that has only ever held
 * contacts is the one case where a person is asked rather than told.
 */

/** One note a plugin would like to write, with its folder already resolved through settings. */
export interface SampleNote {
  /** Vault-relative folder. Blank means the plugin's setting is unconfigured. */
  folder: string;
  /** The note's title, which is also its filename stem and what a wikilink resolves against. */
  title: string;
  /**
   * The frontmatter type value, blank for a note that carries none.
   *
   * Here rather than folded into the properties because a blank one is a
   * refusal: a note identified by folder AND type is invisible to the reader
   * that just wrote it if either half is missing.
   */
  typeValue: string;
  /** Everything after the type and the created stamp, in the order it should appear. */
  properties: Record<string, unknown>;
  /** The markdown below the frontmatter. May be empty. */
  body: string;
  /**
   * A fenced block language this plugin owns and this note must carry, even
   * when another plugin wrote the note first.
   *
   * This is how a shared note ends up answering to more than one plugin. Seed
   * APERtrail into an empty vault and `CRM/People/Stefan` gets a
   * related-trips block; seed CULItrail into the same vault afterwards and the
   * note is already there, so it is skipped -- but its own orders block is
   * appended, and the one note now renders in both. Each plugin only ever
   * writes a fence it owns the constant for, which is why this is a per-note
   * field rather than a list of every block the suite knows about: a plugin
   * cannot name another plugin's block without naming the other plugin.
   */
  ensureBlock?: string;
  /**
   * The folder this note lives in is written by more than one plugin by
   * agreement, so a note in it that this plan does not name belongs to a
   * sibling rather than to a stranger.
   *
   * True on the CRM notes and nowhere else. See the exception at the top of
   * this file for what it cost to learn that `CRM/People` and `CRM/Companies`
   * are not the same case.
   */
  shared?: boolean;
}

/** What a target folder holds now: note titles, not paths. */
export interface FolderContents {
  folder: string;
  /** Filename stems, without the `.md`. */
  titles: readonly string[];
  /**
   * Of those titles, the ones whose text does not carry the block the matching
   * sample note declares. Absent means nothing was checked, and nothing is
   * appended -- a caller that does not look does not get to write.
   */
  withoutBlock?: readonly string[];
}

/** Why a folder stops the run: the notes in it that this plan did not put there. */
export interface OccupiedFolder {
  folder: string;
  strangers: string[];
}

/** A shared folder that already holds notes of somebody else's. Reported, never a refusal. */
export interface SharedFolder {
  folder: string;
  /** Titles already in it that this plan does not name. */
  others: string[];
}

/**
 * `write` when the note is not there, `exists` when a note of that title
 * already sits in that folder.
 *
 * `exists` is a skip and never an overwrite. The note that is already on disk
 * may have been edited, and a sample vault is not worth losing an edit over.
 */
export type SampleNoteStatus = 'write' | 'exists';

export interface PlannedSampleNote {
  note: SampleNote;
  status: SampleNoteStatus;
  /**
   * The note is already there and does not carry this plugin's block, so the
   * run would append one. Never true for a note being written: a new note
   * carries its blocks in its body.
   *
   * This is the one thing a seed does to a note somebody else's hand may have
   * touched, so it is counted separately and shown separately.
   */
  augment: boolean;
}

export interface SampleVaultPlan {
  /** Every note, in the order the plugin offered them, each with its verdict. */
  notes: PlannedSampleNote[];
  /** Folders holding something this plan did not name. Any entry refuses the run. */
  occupied: OccupiedFolder[];
  /**
   * Shared folders already holding notes this plan does not name. Shown so the
   * preview can say what it is writing beside; never a reason to refuse.
   */
  shared: SharedFolder[];
  /**
   * Titles of notes whose folder or type value is blank, so they cannot be
   * written at all. Any entry refuses the run: an unconfigured folder is a
   * setting the vault has emptied, and writing the rest would produce the
   * partial seed described above.
   */
  unconfigured: string[];
}

/** Every distinct folder the plan writes into, in first-seen order. */
export function sampleFolders(notes: readonly SampleNote[]): string[] {
  const seen: string[] = [];
  for (const note of notes) {
    if (!note.folder.trim()) continue;
    if (!seen.includes(note.folder)) seen.push(note.folder);
  }
  return seen;
}

/**
 * The verdict on a set of sample notes, given what the vault holds now.
 *
 * `present` need not cover every folder: a folder nobody has created yet is
 * simply absent from the list and holds nothing, which is the ordinary case on
 * a fresh vault.
 */
export function planSampleVault(
  notes: readonly SampleNote[],
  present: readonly FolderContents[]
): SampleVaultPlan {
  const held = new Map<string, FolderContents>();
  for (const entry of present) held.set(entry.folder, entry);

  // What the plan itself would put in each folder, so a title can be told apart
  // from a stranger without caring which plugin wrote it last.
  const ours = new Map<string, Set<string>>();
  for (const note of notes) {
    if (!note.folder.trim()) continue;
    const titles = ours.get(note.folder) ?? new Set<string>();
    titles.add(note.title);
    ours.set(note.folder, titles);
  }

  const planned: PlannedSampleNote[] = [];
  const unconfigured: string[] = [];

  for (const note of notes) {
    if (!note.folder.trim() || !note.typeValue.trim()) {
      unconfigured.push(note.title);
      continue;
    }
    const contents = held.get(note.folder);
    const exists = (contents?.titles ?? []).includes(note.title);
    const augment =
      exists &&
      note.ensureBlock !== undefined &&
      (contents?.withoutBlock ?? []).includes(note.title);
    planned.push({ note, status: exists ? 'exists' : 'write', augment });
  }

  // A folder is shared when any note the plan puts there says so. Per note
  // rather than per folder because the notes are what a plugin writes down, and
  // a second list of folder names would be a second thing to keep in step.
  const sharedFolders = new Set(
    notes.filter((note) => note.shared && note.folder.trim()).map((note) => note.folder)
  );

  const occupied: OccupiedFolder[] = [];
  const shared: SharedFolder[] = [];
  for (const folder of sampleFolders(notes)) {
    const others = (held.get(folder)?.titles ?? []).filter(
      (title) => !ours.get(folder)?.has(title)
    );
    if (others.length === 0) continue;
    if (sharedFolders.has(folder)) shared.push({ folder, others: [...others] });
    else occupied.push({ folder, strangers: [...others] });
  }

  return { notes: planned, occupied, shared, unconfigured };
}

/** Nothing in the way, and something left to do. */
export function sampleVaultWritable(plan: SampleVaultPlan): boolean {
  return (
    plan.occupied.length === 0 &&
    plan.unconfigured.length === 0 &&
    plan.notes.some((entry) => entry.status === 'write' || entry.augment)
  );
}

/** How many notes the run would create, which is what a preview counts. */
export function sampleWriteCount(plan: SampleVaultPlan): number {
  return plan.notes.filter((entry) => entry.status === 'write').length;
}

/** How many it would leave alone because they are already there. */
export function sampleSkipCount(plan: SampleVaultPlan): number {
  return plan.notes.filter((entry) => entry.status === 'exists').length;
}

/** How many existing notes would gain this plugin's block. Shown on its own, because it is the one edit. */
export function sampleAugmentCount(plan: SampleVaultPlan): number {
  return plan.notes.filter((entry) => entry.augment).length;
}
