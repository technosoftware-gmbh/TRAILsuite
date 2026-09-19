/**
 * Entries in a legacy downward list that the derived hierarchy does not
 * reproduce.
 *
 * A Country's `states:` and a State's `cities:` used to be how the plugin
 * knew what sat under a note. They are not read for that any more: the
 * hierarchy is derived from the child's own `country:`/`state:` link
 * (read-entities.ts), which is the only side any editor writes. Almost
 * every entry in an existing list is therefore redundant and harmless --
 * the same fact, written twice, agreeing.
 *
 * The entries that are not harmless are the ones that disagree: a state
 * listed under a country it does not name back, a city listed under a
 * province whose note points somewhere else, or a link to a note that was
 * renamed or never existed. Under the old reading those showed up in the
 * list anyway; under this one they vanish. This check is what keeps that
 * from being silent, and it is the whole reason `statesProperty` and
 * `citiesProperty` still exist as settings.
 *
 * A warning and no `apply`, for the reason missing-file-issues.ts gives:
 * which of the two notes is wrong is a decision. Writing the child's
 * `state:` from the parent's list would be this plugin guessing that the
 * list is the truthful half, and it is usually the stale one.
 *
 * The rule half is pure and takes plain titles, so it is testable without a
 * vault; the scan half walks the same board every other surface reads.
 */
import { App, TFile } from 'obsidian';
import { caseFold, findValue, wikilinkTargets } from '@technosoftware/trail-core';
import { APERtrailSettings } from '../../settings/types';
import { frontmatterOf } from '../../shared/vault-host';
import { readTravelBoard } from '../read-entities';

/** What went wrong with one entry. `unknown` is a link to nothing; `notLinkedBack` is a note that exists and names somebody else, or nobody. */
export type ChildListProblem = 'unknown' | 'notLinkedBack';

export interface ChildListIssue {
  /** The parent note carrying the list. */
  file: TFile;
  /** The property the entry came from, so the row can say where to look. */
  property: string;
  /** The wikilink target, exactly as the list spells it. */
  child: string;
  problem: ChildListProblem;
  /** What the child names instead, when it names anything. Null when it names nothing, or when there is no such note. */
  actualParent: string | null;
}

interface ChildListFinding {
  child: string;
  problem: ChildListProblem;
  actualParent: string | null;
}

/**
 * The listed children the derivation will not produce.
 *
 * `parentOf` answers with the title the child points at, `null` when the
 * child names no parent, and `undefined` when there is no such child note at
 * all. Three answers rather than two, because "renamed the note" and "never
 * filled in the link" are different mistakes and the row says which.
 *
 * A blank or whitespace entry is not a broken one, it is an absent one, and
 * `wikilinkTargets` has already dropped it before this sees it.
 */
export function unreproducedChildren(
  parent: string,
  children: string[],
  parentOf: (child: string) => string | null | undefined
): ChildListFinding[] {
  const seen = new Set<string>();
  const issues: ChildListFinding[] = [];

  for (const child of children) {
    // A list naming the same child twice is one mistake, not two rows, and
    // two spellings of the same umlaut are one name -- read-entities.ts
    // resolves them as one, so this has to agree or it reports a town that
    // is in fact already there.
    const key = caseFold(child);
    if (seen.has(key)) continue;
    seen.add(key);

    const actual = parentOf(child);
    if (actual === undefined) {
      issues.push({ child, problem: 'unknown', actualParent: null });
      continue;
    }
    if (caseFold(actual) !== caseFold(parent)) {
      issues.push({ child, problem: 'notLinkedBack', actualParent: actual });
    }
  }

  return issues;
}

/** Every entry in every legacy child list that the derived hierarchy drops, in path order. */
export function scanChildListIssues(app: App, settings: APERtrailSettings): ChildListIssue[] {
  const board = readTravelBoard(app, settings);

  // Folded keys, for the reason read-entities.ts folds its own: the title in
  // a list and the title on the note it names are two things a person typed.
  const stateCountry = new Map(
    board.states.map((state) => [caseFold(state.title), state.countryTitle])
  );
  const cityState = new Map(board.cities.map((city) => [caseFold(city.title), city.stateTitle]));

  const listed = (file: TFile, property: string): string[] => {
    const frontmatter = frontmatterOf(app, file);
    return frontmatter ? wikilinkTargets(findValue(frontmatter, property)) : [];
  };

  const issues: ChildListIssue[] = [];

  for (const country of board.countries) {
    const property = settings.statesProperty;
    const findings = unreproducedChildren(country.title, listed(country.file, property), (title) =>
      stateCountry.has(caseFold(title)) ? stateCountry.get(caseFold(title)) : undefined
    );
    for (const finding of findings) issues.push({ file: country.file, property, ...finding });
  }

  for (const state of board.states) {
    const property = settings.citiesProperty;
    const findings = unreproducedChildren(state.title, listed(state.file, property), (title) =>
      cityState.has(caseFold(title)) ? cityState.get(caseFold(title)) : undefined
    );
    for (const finding of findings) issues.push({ file: state.file, property, ...finding });
  }

  return issues.sort(
    (a, b) => a.file.path.localeCompare(b.file.path) || a.child.localeCompare(b.child)
  );
}
