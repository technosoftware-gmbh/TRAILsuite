/**
 * The vault half of the check: listing the notes, and applying the one fix that
 * is safe to apply.
 *
 * Everything that is a decision rather than a listing lives in `claims.ts` and
 * `findings.ts`, both pure and both tested. What is left here is the `App`, and
 * it is deliberately as thin as it can be: this file is the part no unit test
 * can reach, so the less of it there is, the less goes unchecked.
 */
import { App, TFile } from 'obsidian';
import { stripWikilink } from 'trail-core';
import { hostFor } from '../../shared/vault-host';
import { readParaBoard } from '../../para/read-para';
import { readFinanceBoard } from '../../finance/read-finance';
import { readAccounts, readBudgets } from '../../ledger/read-ledger';
import type { NODAtrailSettings } from '../../settings/types';
import { claimedFolders, folderNotesOf, stampNotesOf, type ScannedNote } from './claims';
import {
  billFindings,
  budgetFindings,
  imageFindings,
  paraLinkFindings,
  purchaseFindings,
  sortFindings,
  stampFindings,
  typeFindings,
  type Finding,
} from './findings';

/** Every markdown note in the vault, reduced to what the checks read. */
function scannedNotes(app: App): ScannedNote[] {
  const host = hostFor(app);

  return host.vault.markdownFiles().map((file) => ({
    path: file.path,
    title: file.basename,
    frontmatter: host.metadata.frontmatterOf(file) ?? {},
  }));
}

/** Everything the check found, in report order. */
export function runHealthCheck(app: App, settings: NODAtrailSettings): Finding[] {
  const claims = claimedFolders(settings);
  const notes = scannedNotes(app);

  const para = readParaBoard(app, settings);
  const finance = readFinanceBoard(app, settings);
  const accounts = readAccounts(app, settings).map((record) => record.account);

  const resolves = (value: string) => {
    const target = stripWikilink(value);
    return (
      app.metadataCache.getFirstLinkpathDest(target, '') !== null ||
      app.vault.getAbstractFileByPath(target) !== null
    );
  };
  const pathOf = (record: { file: TFile }) => record.file.path;

  return sortFindings([
    ...typeFindings(folderNotesOf(notes, claims, settings.typePropertyName)),
    ...paraLinkFindings(para.goals, para.projects, para.areas, pathOf),
    ...imageFindings(para.areas, pathOf, resolves),
    ...imageFindings(para.goals, pathOf, resolves),
    ...imageFindings(para.projects, pathOf, resolves),
    ...billFindings(finance.bills, pathOf),
    ...purchaseFindings(finance.purchases, pathOf),
    ...budgetFindings(readBudgets(app, settings), pathOf, accounts),
    ...stampFindings(
      stampNotesOf(notes, claims, settings.createdProperty, settings.modifiedProperty)
    ),
  ]);
}

/**
 * The two fixes worth offering with a single click.
 *
 * A finding is fixable only when the check already knows the whole answer, and
 * most do not. A broken link cannot be repaired without knowing which note was
 * meant. A disagreeing total cannot be corrected without knowing which of the
 * two figures is right. Those are reported and left alone.
 *
 * The two that qualify are the type, where the folder states the answer, and a
 * stamp in an older shape, where the answer is the same moment spelt
 * differently. Nothing here guesses, and nothing here moves an instant.
 */
export function canFix(finding: Finding): boolean {
  if (!finding.expected) return false;
  return (
    finding.kind === 'wrongType' ||
    finding.kind === 'missingType' ||
    (finding.kind === 'oldStampShape' && !!finding.property)
  );
}

/**
 * Applies one fix, and says whether it did.
 *
 * False rather than a throw for a finding that cannot be fixed or a path that
 * no longer resolves: a report is a snapshot, and by the time somebody presses
 * a button the note may have been moved, renamed or already corrected. That is
 * an ordinary outcome, not an error, and the caller answers it by re-running
 * the check.
 */
export async function applyFix(
  app: App,
  settings: NODAtrailSettings,
  finding: Finding
): Promise<boolean> {
  if (!canFix(finding)) return false;

  const file = app.vault.getAbstractFileByPath(finding.path);
  if (!(file instanceof TFile)) return false;

  const property =
    finding.kind === 'oldStampShape'
      ? propertyNameFor(settings, finding)
      : settings.typePropertyName;
  if (!property) return false;

  await hostFor(app).frontmatter.process(file, (frontmatter) => {
    frontmatter[property] = finding.expected;
  });
  return true;
}

/**
 * The setting behind a stamp finding's property.
 *
 * The finding says `created` or `modified` because that is what the check
 * looked at; what gets written has to be the configured name, which is what the
 * check read them under in the first place. Going back through the settings
 * rather than trusting the label is what keeps this correct in a vault that
 * calls them something else.
 */
function propertyNameFor(settings: NODAtrailSettings, finding: Finding): string {
  return (
    finding.property === 'created' ? settings.createdProperty : settings.modifiedProperty
  ).trim();
}

/**
 * Every fixable finding, applied, and how many were.
 *
 * A vault that has never had this run carries these by the hundred -- the one
 * this was built against had 117 stamps across 59 notes -- and a fix that has
 * to be pressed once per finding is not a fix anybody will use.
 *
 * Applied one at a time rather than in parallel: each is a read-modify-write of
 * a file's frontmatter, and Obsidian's own writer is what serialises them.
 */
export async function applyAllFixes(
  app: App,
  settings: NODAtrailSettings,
  findings: readonly Finding[]
): Promise<number> {
  let fixed = 0;
  for (const finding of findings) {
    if (await applyFix(app, settings, finding)) fixed += 1;
  }
  return fixed;
}
