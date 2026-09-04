/**
 * The Person and Company note format, which two plugins read and one writes.
 *
 * A CRM note is owned by no plugin. APERtrail creates and edits them,
 * CULItrail reads them to answer what somebody ordered, and both find them on
 * the same terms: the configured folder, plus the configured `type:` value.
 * That agreement is what `settings/crm-contract.ts` pins as defaults. What is
 * here is the layer above it, the reading of one note's fields, which had been
 * written twice in two repositories and had already drifted once: one side read
 * tags through a reader that strips a leading `#` and the other through one
 * that does not, so `#Familie` was a tag to one plugin and a different tag to
 * the other.
 *
 * Every property name arrives resolved. Neither this module nor anything under
 * it knows what a settings object looks like: a plugin maps its own settings to
 * `CrmPropertyNames` once, which is also what stops a reader and a writer in
 * the same plugin being handed different names.
 *
 * **A blank property name means the field is not read**, rather than falling
 * back to a literal. A plugin that displays no email has nothing to gain from
 * reading one, and a caller says so by leaving the name empty. The type
 * property is the exception: a blank there is a cleared field rather than a
 * decision, so it falls back to `type`.
 *
 * App-free: no `obsidian` import, no settings type, no user-facing string.
 */
import { readString, readStringList } from '../frontmatter/read.js';
import { readTags } from './tags.js';

/** The two kinds of note this module reads. */
export type CrmKind = 'person' | 'company';

/**
 * Every property name a CRM note is read by.
 *
 * The contact fields are optional because the two plugins read different ones.
 * CULItrail shows no address and therefore reads none; APERtrail shows several.
 * A field nothing displays is a setting somebody has to understand for no
 * visible effect, so each plugin names only what it renders.
 */
export interface CrmPropertyNames {
  typePropertyName: string;
  personTypeValue: string;
  companyTypeValue: string;
  personTagProperty: string;
  companyTagProperty: string;
  descriptionProperty?: string;
  addressProperty?: string;
  websiteProperty?: string;
  emailProperty?: string;
  phoneProperty?: string;
  mobileProperty?: string;
  /**
   * What a company or a person is to this household, so each plugin can narrow
   * its lists.
   *
   * One setting each, the same split the tag properties take, so neither name
   * has to lie about what it covers. They default to the same value, which
   * makes the split look pointless right up until a vault wants its people
   * classified under a different key from its companies.
   *
   * **One list, two kinds of answer, and that is deliberate.** `meals` and
   * `hotel` say what somebody supplies; `vendor` and `customer` say which way
   * an invoice travels. A company is often both at once, and a flat list says
   * so without a second property and a second vocabulary to fill in.
   */
  personRolesProperty?: string;
  companyRolesProperty?: string;
}

/**
 * The fields a CRM note contributes, minus the file and title its caller
 * already holds.
 *
 * One shape for both kinds rather than a union, because the readers walk both
 * kinds through one function and a union would make that function the one place
 * that has to know which kind it is holding. A field whose property name was not
 * given is null, which reads the same as a note that does not carry it.
 */
export interface CrmNoteFields {
  tags: string[];
  /**
   * What this company or person is: `meals`, `hotel`, `vendor`, `customer`,
   * whatever a vault decides. Several at once, because one company is often two
   * of them -- a supplier you also invoice is both.
   *
   * Empty means nobody has said. What a filter does about that is the filter's
   * business: `companyHasRole` answers it by asking for nothing until a setting
   * names a role, so an unclassified vault narrows nothing.
   */
  roles: string[];
  description: string | null;
  address: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
}

/** The configured `type:` value for a kind, or `''` when a vault has cleared it. A blank value matches nothing. */
export function crmTypeValue(properties: CrmPropertyNames, kind: CrmKind): string {
  return kind === 'person' ? properties.personTypeValue : properties.companyTypeValue;
}

/**
 * Which property holds this kind's tags.
 *
 * Person and Company get one setting each rather than sharing one, so neither
 * setting's name has to lie about what it covers. They default to the same
 * value, which makes the split look pointless right up until a vault tags its
 * companies under `kategorie` and its people under `tags`.
 */
export function crmTagProperty(properties: CrmPropertyNames, kind: CrmKind): string {
  return kind === 'person' ? properties.personTagProperty : properties.companyTagProperty;
}

/** Which property holds this kind's roles, or undefined when the caller named none. */
export function crmRolesProperty(properties: CrmPropertyNames, kind: CrmKind): string | undefined {
  return kind === 'person' ? properties.personRolesProperty : properties.companyRolesProperty;
}

/**
 * The roles list, through `readStringList` so a YAML list, a bare value and one
 * comma-separated string all read alike. That is how a hand-edited note spells
 * a short list, and all three occur in a real vault.
 */
function rolesFor(
  frontmatter: Record<string, unknown>,
  properties: CrmPropertyNames,
  kind: CrmKind
): string[] {
  const name = crmRolesProperty(properties, kind);
  return name ? readStringList(frontmatter[name]) : [];
}

/** A named field, or null when the caller did not name it. */
function field(frontmatter: Record<string, unknown>, name: string | undefined): string | null {
  if (!name || name.trim() === '') return null;
  return readString(frontmatter[name]);
}

/**
 * One CRM note's fields.
 *
 * Tags come through `readTags()` rather than a plain list reader, so a note
 * whose tags are a YAML list, a bare value or one comma-separated string all
 * read the same, and `#Familie` and `Familie` are one tag rather than two.
 */
export function parseCrmNote(
  frontmatter: Record<string, unknown>,
  properties: CrmPropertyNames,
  kind: CrmKind
): CrmNoteFields {
  return {
    tags: readTags(frontmatter[crmTagProperty(properties, kind)]),
    // Through `readStringList`, so a YAML list, a bare value and one
    // comma-separated string all read alike. That is how a hand-edited note
    // spells a short list, and all three occur in a real vault.
    roles: rolesFor(frontmatter, properties, kind),
    description: field(frontmatter, properties.descriptionProperty),
    address: field(frontmatter, properties.addressProperty),
    website: field(frontmatter, properties.websiteProperty),
    email: field(frontmatter, properties.emailProperty),
    phone: field(frontmatter, properties.phoneProperty),
    mobile: field(frontmatter, properties.mobileProperty),
  };
}

/**
 * Whether a company belongs in a list that asks for `required`.
 *
 * **A blank `required` asks for nothing and admits every company.** That is
 * where the migration safety lives: a plugin's role filter is a setting that
 * ships empty, so a vault that has never classified a company sees the list it
 * always saw, and narrowing begins the day somebody fills the setting in.
 *
 * An earlier version put that safety here instead, by treating a company with
 * no roles as eligible for everything. It was the wrong place: it made the
 * filter useless in exactly the state a vault is in while being classified --
 * one company answered, forty-three silent, and a list that still showed all
 * forty-four. A rule nobody can see is also a rule nobody can turn off.
 *
 * Case-insensitive, because `Meals` and `meals` are one role and nobody would
 * configure both.
 */
export function companyHasRole(roles: readonly string[], required: string): boolean {
  const target = required.trim().toLowerCase();
  if (!target) return true;
  return roles.some((role) => role.trim().toLowerCase() === target);
}
