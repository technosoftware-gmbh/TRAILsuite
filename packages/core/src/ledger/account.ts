/**
 * The chart of accounts: reading one account, and assembling the tree they make.
 *
 * The tree is derived rather than stored. An account carries a group path such
 * as `Gemeinsame Kosten/Renault Twingo`, and the sections and groups a report
 * prints are what those paths and the account kinds imply. There is no note
 * describing the tree, so a tree can never disagree with the accounts in it.
 *
 * App-free.
 */
import { readIsoDate } from '../dates/read.js';
import { readNumberLike, readString } from '../frontmatter/read.js';
import { linkOrText } from '../links/wikilink.js';
import { normalizeCurrency } from '../money/format.js';
import { type Account, type AccountKind, isAccountKind } from './types.js';

export interface AccountProperties {
  numberProperty: string;
  kindProperty: string;
  groupProperty: string;
  currencyProperty: string;
  openingProperty: string;
  openingDateProperty: string;
  closedProperty: string;
  ibanProperty: string;
  bankAccountProperty: string;
  personProperty: string;
}

/** A band of account numbers and what kind of account lives in it. */
export interface NumberRange {
  from: number;
  to: number;
  kind: AccountKind;
}

/**
 * The Swiss household convention, and only a default.
 *
 * **Used when an account note is created and never afterwards.** The kind is
 * written into the note, and every later reader trusts the property rather than
 * the number, so renumbering a chart or adopting a different convention cannot
 * silently reinterpret history.
 */
export const DEFAULT_NUMBER_RANGES: readonly NumberRange[] = [
  { from: 1000, to: 1999, kind: 'asset' },
  { from: 2000, to: 2999, kind: 'liability' },
  { from: 3000, to: 3999, kind: 'income' },
  { from: 4000, to: 5999, kind: 'expense' },
];

/** What kind an account number suggests, or null when no range claims it. */
export function kindForNumber(
  value: number,
  ranges: readonly NumberRange[] = DEFAULT_NUMBER_RANGES
): AccountKind | null {
  for (const range of ranges) {
    if (value >= range.from && value <= range.to) return range.kind;
  }
  return null;
}

/**
 * One account note read.
 *
 * Returns null only when there is no number, because a number is the account's
 * identity and every posting names it. Everything else has a defensible
 * fallback: no stated kind falls back to what the number suggests, and no
 * opening balance is zero, which is what an account nobody has opened holds.
 */
export function parseAccount(
  frontmatter: Record<string, unknown>,
  title: string,
  properties: AccountProperties,
  ranges: readonly NumberRange[] = DEFAULT_NUMBER_RANGES
): Account | null {
  const p = properties;
  const number = readNumberLike(frontmatter[p.numberProperty]);
  if (number === null) return null;

  const statedKind = readString(frontmatter[p.kindProperty]);
  const kind = isAccountKind(statedKind)
    ? statedKind
    : (kindForNumber(number, ranges) ?? 'expense');

  return {
    number,
    title,
    kind,
    group: (readString(frontmatter[p.groupProperty]) ?? '').trim().replace(/^\/+|\/+$/g, ''),
    currency: normalizeCurrency(readString(frontmatter[p.currencyProperty])),
    opening: readNumberLike(frontmatter[p.openingProperty]) ?? 0,
    openingDate: readIsoDate(frontmatter[p.openingDateProperty]),
    closed: readIsoDate(frontmatter[p.closedProperty]),
    iban: normalizeIban(readString(frontmatter[p.ibanProperty])),
    bankAccount: normalizeBankAccount(readString(frontmatter[p.bankAccountProperty])),
    personTitle: linkOrText(frontmatter[p.personProperty]),
  };
}

/** The accounts by number, for the many readers that resolve a posting's account. */
export function accountsByNumber(accounts: readonly Account[]): Map<number, Account> {
  const map = new Map<number, Account>();
  // First wins, so a duplicate number does not quietly shadow the account that
  // came before it. The duplicate is reported by `duplicateNumbers`.
  for (const account of accounts) if (!map.has(account.number)) map.set(account.number, account);
  return map;
}

/** A node in the printed chart: a group, its subgroups, and the accounts directly in it. */
export interface AccountGroup {
  /** The last segment, which is what a heading shows. */
  name: string;
  /** The whole path, which is what identifies it. */
  path: string;
  accounts: Account[];
  children: AccountGroup[];
}

/**
 * The accounts of one kind, arranged into the tree their group paths describe.
 *
 * Accounts sort by number within a group, and a group sorts by the lowest
 * number it contains anywhere beneath it, which is what makes the printed chart
 * come out in the order somebody numbered it in.
 */
export function accountTree(accounts: readonly Account[], kind: AccountKind): AccountGroup {
  const root: AccountGroup = { name: '', path: '', accounts: [], children: [] };

  for (const account of accounts) {
    if (account.kind !== kind) continue;

    let node = root;
    const segments = account.group === '' ? [] : account.group.split('/');
    for (const segment of segments) {
      const path = node.path === '' ? segment : `${node.path}/${segment}`;
      let child = node.children.find((candidate) => candidate.path === path);
      if (!child) {
        child = { name: segment, path, accounts: [], children: [] };
        node.children.push(child);
      }
      node = child;
    }
    node.accounts.push(account);
  }

  sortGroup(root);
  return root;
}

/** The lowest account number anywhere beneath a node, or Infinity for an empty one. */
export function lowestNumber(group: AccountGroup): number {
  const own = group.accounts.reduce((low, account) => Math.min(low, account.number), Infinity);
  return group.children.reduce((low, child) => Math.min(low, lowestNumber(child)), own);
}

function sortGroup(group: AccountGroup): void {
  group.accounts.sort((a, b) => a.number - b.number);
  group.children.sort((a, b) => lowestNumber(a) - lowestNumber(b));
  for (const child of group.children) sortGroup(child);
}

/** Every account beneath a node, its own and its children's. */
export function accountsIn(group: AccountGroup): Account[] {
  return [...group.accounts, ...group.children.flatMap((child) => accountsIn(child))];
}

/** The numbers claimed by more than one account note. */
export function duplicateNumbers(accounts: readonly Account[]): number[] {
  const seen = new Set<number>();
  const twice = new Set<number>();
  for (const account of accounts) {
    if (seen.has(account.number)) twice.add(account.number);
    seen.add(account.number);
  }
  return [...twice].sort((a, b) => a - b);
}

/**
 * Accounts whose number sits outside the band its siblings occupy.
 *
 * The check that catches a real filing mistake: an account numbered in one
 * person's block but grouped under the other. It only speaks when the siblings
 * agree among themselves, so a group that was never numbered as a block stays
 * quiet rather than complaining about every member.
 */
export function strandedByNumber(accounts: readonly Account[]): Account[] {
  const groups = new Map<string, Account[]>();
  for (const account of accounts) {
    const key = `${account.kind} ${account.group}`;
    const list = groups.get(key);
    if (list) list.push(account);
    else groups.set(key, [account]);
  }

  const stranded: Account[] = [];
  for (const members of groups.values()) {
    if (members.length < 3) continue;

    for (const account of members) {
      const others = members
        .filter((member) => member !== account)
        .map((member) => member.number)
        .sort((a, b) => a - b);

      const low = others[0];
      const high = others[others.length - 1];
      if (low === undefined || high === undefined) continue;

      // The tolerance is the group's own widest step rather than a fixed
      // number, because a chart numbered in tens is as deliberate as one
      // numbered in ones. Judging 3010, 3020, 3030 by the same margin as 4030,
      // 4031, 4032 called the first of them stranded, which it plainly is not.
      let step = 1;
      for (let index = 1; index < others.length; index += 1) {
        step = Math.max(step, (others[index] ?? 0) - (others[index - 1] ?? 0));
      }

      const margin = step * 2;
      if (account.number < low - margin || account.number > high + margin) stranded.push(account);
    }
  }

  return stranded.sort((a, b) => a.number - b.number);
}

/**
 * An IBAN with the spaces taken out and the letters raised.
 *
 * `CH93 0076 2011 6238 5295 7` and `ch9300762011623852957` are the same
 * account, and a statement is free to print either. Comparison happens on this
 * form so it never depends on how somebody typed it.
 */
export function normalizeIban(value: string | null): string | null {
  const stripped = (value ?? '').replace(/[\s-]/g, '').toUpperCase();
  return stripped === '' ? null : stripped;
}

/**
 * Whether a written identity is an IBAN rather than a printed account number.
 *
 * Two letters, two check digits, then the rest. Recognised by shape so that one
 * field on screen can hold either: asking somebody which kind they are about to
 * type is asking them to do the parser's job, and a wrong guess costs nothing
 * because the reader tries both properties anyway.
 */
export function looksLikeIban(value: string | null): boolean {
  const stripped = (value ?? '').replace(/[\s-]/g, '');
  return /^[A-Za-z]{2}\d{2}[A-Za-z0-9]{4,}$/.test(stripped);
}

/**
 * A bank account number reduced to its digits.
 *
 * Swiss statements print the same account as `0510.5272.2002`, `0510-5272.2002`
 * or `051052722002` depending on where it appears. The digits are the only part
 * that is stable.
 */
export function normalizeBankAccount(value: string | null): string | null {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits === '' ? null : digits;
}

/**
 * The shortest printed number that may be matched inside an IBAN.
 *
 * Twelve digits is what a Swiss account number is. Anything shorter is a
 * fragment, and matching a fragment against the tail of an IBAN would start
 * finding accounts by coincidence.
 */
const SHORTEST_TAIL = 8;

/**
 * The account a statement line's counter-account number belongs to.
 *
 * Three ways to match, in descending order of certainty: the same IBAN, the
 * same printed number, and **an IBAN that ends with the printed number**.
 *
 * The third exists because of what a Swiss statement actually does. It prints
 * `0510.5272.2002` while the account note carries `CH04 0076 1051 0527 2200 2`,
 * and the first is inside the second: the IBAN is the clearing number and the
 * account number together. Comparing them as equals matched nothing at all, so
 * every transfer between two of the household's own accounts had to be assigned
 * by hand, which is precisely the case the bank identity was added to solve.
 *
 * Returns null rather than a guess, and null again when two accounts both
 * match: a transfer posted to the wrong account is worse than one left for a
 * person to assign.
 */
export function accountForBankNumber(
  accounts: readonly Account[],
  printed: string | null
): Account | null {
  const iban = normalizeIban(printed);
  const digits = normalizeBankAccount(printed);
  if (!iban && !digits) return null;

  for (const account of accounts) {
    if (iban && account.iban && account.iban === iban) return account;
    if (digits && account.bankAccount && account.bankAccount === digits) return account;
  }

  if (!digits || digits.length < SHORTEST_TAIL) return null;
  const inside = accounts.filter(
    (account) => account.iban && normalizeBankAccount(account.iban)?.endsWith(digits)
  );
  // Exactly one, or nothing. Two accounts whose IBANs both end in the same
  // digits is a question this cannot answer.
  return inside.length === 1 ? (inside[0] ?? null) : null;
}

/**
 * An account as a line of text, without saying the number twice.
 *
 * The note is titled `1001 Household cash EUR`, because a folder of account
 * notes has to sort the way the printed chart reads. Every list that then wrote
 * the number in front of the title again said it twice. So the number is added
 * only when the title does not already begin with it, which keeps a renamed
 * account labelled properly and leaves a seeded one alone.
 */
export function accountLabel(account: Account): string {
  const title = account.title.trim();
  const number = String(account.number);
  if (title === number) return title;
  if (title.startsWith(number)) {
    const next = title.charAt(number.length);
    // Only a separator counts: an account numbered 101 must not swallow the
    // title of one called `1010 Bargeld`.
    if (next === ' ' || next === '-' || next === '_' || next === '.') return title;
  }
  return `${number} ${title}`;
}
