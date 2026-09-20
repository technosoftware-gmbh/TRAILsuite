/**
 * What a wikilink on a day entry points at, so a view can say so.
 *
 * A day entry carries links and the line says nothing about what they are:
 * `[[Beruf]]` is an area, `[[Anna Muster]]` is a person, and the note spells
 * both the same way. The note at the other end already knows, and this is the
 * read that asks it. See `docs/design/day-entry-links.md` section D.4: what a
 * view may *show* is everything the note says, which is a different and larger
 * question from what the dialog may *edit*.
 *
 * **Folder AND type, which is the vault's own rule.** `isNoteOfType()` answers
 * on exactly the terms every reader in this plugin uses, so a chip can never
 * claim something a list would not. A note in the right folder with the wrong
 * type value, or the right type in the wrong folder, is one this cannot name --
 * which is the silence the health check exists to break rather than a thing for
 * a chip to paper over.
 *
 * **The archive counts.** `anyQueryFor()` rather than `queryFor()`: an archived
 * project is still a project, and a day note naming one is a day that is over
 * too. Archiving must not quietly take the label off a line already written.
 *
 * **Nothing here is written, and an unresolved link is not an error.** A
 * restaurant note written next week starts resolving next week, and writing a
 * day note must never wait on writing the notes it mentions.
 *
 * **A travel note is named by its type value alone, and that is the one place
 * the folder rule does not apply.** The rule protects readers that ACT: a list,
 * an archive command, a health check must not claim a note that merely says
 * `type: project`, because `project` is a word a vault may use for anything and
 * `projectTypeValue` is a setting. The twelve travel values are the opposite:
 * fixed in `trail-core`, agreed across the packages, and not configurable. A
 * note saying `type: fnb` is a restaurant wherever somebody keeps it. Matching
 * those on folder as well would mean NODAtrail carrying a copy of APERtrail's
 * nine place folders, to decide the wording of a label that writes nothing.
 *
 * So: a configurable type value needs its folder, a fixed one identifies
 * itself. PARA and CRM take the first rule, travel the second, and the
 * difference is which of them a vault is allowed to rename.
 */
import type { App, TFile } from 'obsidian';
import {
  TRAVEL_ENTITY_TYPES,
  isNoteOfType,
  matchesType,
  stripWikilink,
  type NoteKindQuery,
  type TravelEntityType,
} from '@technosoftware/trail-core';
import { hostFor } from '../shared/vault-host';
import type { NODAtrailSettings } from '../settings/types';
import { PARA_TYPES, anyQueryFor, type ParaType } from './entity-types';

/** The kinds a link can be named as: the four PARA notes, the two CRM ones, and the twelve travel ones. */
export const LINK_KINDS = [...PARA_TYPES, 'person', 'company', ...TRAVEL_ENTITY_TYPES] as const;
export type LinkKind = ParaType | 'person' | 'company' | TravelEntityType;

/** One link on a day entry, as the vault answers for it. */
export interface LinkedNote {
  /** The title as the line spells it, alias and heading removed. */
  title: string;
  /** Null when nothing answers to that title, or when what does is a kind this cannot name. */
  kind: LinkKind | null;
  /** False when no note of that title exists yet, which is allowed and ordinary. */
  exists: boolean;
}

/**
 * The CRM folders and type values, which `entity-types.ts` does not cover.
 *
 * It holds the kinds this plugin creates and archives; a Person is a note the
 * vault already owns and neither. Kept here rather than added there so the
 * registry keeps meaning one thing.
 */
function crmQuery(settings: NODAtrailSettings, kind: 'person' | 'company'): NoteKindQuery {
  return {
    folders: [kind === 'person' ? settings.personsFolder : settings.companiesFolder],
    typePropertyName: settings.typePropertyName,
    typeValue: kind === 'person' ? settings.personTypeValue : settings.companyTypeValue,
  };
}

/** Every query in the order they are tried. First match wins, and a note is only ever one kind. */
function queries(settings: NODAtrailSettings): readonly { kind: LinkKind; query: NoteKindQuery }[] {
  return [
    ...PARA_TYPES.map((type) => ({ kind: type, query: anyQueryFor(settings, type) })),
    { kind: 'person' as const, query: crmQuery(settings, 'person') },
    { kind: 'company' as const, query: crmQuery(settings, 'company') },
  ];
}

/**
 * What kind of note a file is, or null.
 *
 * Exported for the callers that already hold a file and would otherwise
 * resolve a title they got from that same file.
 */
export function kindOfFile(app: App, settings: NODAtrailSettings, file: TFile): LinkKind | null {
  const host = hostFor(app);
  for (const { kind, query } of queries(settings)) {
    if (isNoteOfType(host, file, query)) return kind;
  }

  // Then the fixed twelve, on the type value alone. Last, so a vault that has
  // deliberately renamed one of its own kinds to a travel word still gets its
  // own answer: what this plugin is configured for wins over what the suite
  // agreed, every time.
  const frontmatter = host.metadata.frontmatterOf(file) ?? {};
  for (const type of TRAVEL_ENTITY_TYPES) {
    if (matchesType(frontmatter, settings.typePropertyName, type)) return type;
  }
  return null;
}

/**
 * The target a link points at, with the alias and any heading taken off.
 *
 * `parseScheduleLine` captures whatever sits between the brackets, so
 * `[[Q3 Finanzen|das Budget]]` arrives whole and `getFirstLinkpathDest` would
 * look for a note of that entire name.
 */
export function linkTarget(raw: string): string {
  const bare = stripWikilink(raw.trim());
  const [beforeAlias = ''] = bare.split('|');
  const [target = ''] = beforeAlias.split('#');
  return target.trim();
}

/** One link, resolved. */
export function resolveLink(app: App, settings: NODAtrailSettings, raw: string): LinkedNote {
  const title = linkTarget(raw);
  if (!title) return { title: raw.trim(), kind: null, exists: false };

  const file = app.metadataCache.getFirstLinkpathDest(title, '');
  if (!file) return { title, kind: null, exists: false };

  return { title, kind: kindOfFile(app, settings, file), exists: true };
}

/** Several links, in the order the line spells them. */
export function resolveLinks(
  app: App,
  settings: NODAtrailSettings,
  raw: readonly string[]
): LinkedNote[] {
  return raw.map((one) => resolveLink(app, settings, one));
}
