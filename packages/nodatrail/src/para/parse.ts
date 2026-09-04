/**
 * Reading a PARA note's frontmatter.
 *
 * Every property name arrives as a setting rather than a literal, so a vault
 * that already spells one of them its own way never has to rename anything on
 * disk. The shapes are read leniently for the reason every reader in this suite
 * is: frontmatter is edited by hand, and a property editor turns a value into a
 * list the moment somebody adds a second one.
 *
 * Pure.
 */
import { readIsoDate, readNumberLike, readString, readStringList } from 'trail-core';
import { linkOrText, wikilinkTargets } from 'trail-core';
import {
  type ParaCommon,
  type ParsedArea,
  type ParsedGoal,
  type ParsedProject,
  type ParsedResource,
  readParaStatus,
} from './types';

/** The names every PARA note is read by. */
export interface ParaCommonProperties {
  imageProperty: string;
  priorityProperty: string;
  archivedProperty: string;
}

export interface GoalProperties extends ParaCommonProperties {
  areaProperty: string;
  statusProperty: string;
  deadlineProperty: string;
  achievedProperty: string;
  closedProperty: string;
}

export interface ProjectProperties extends ParaCommonProperties {
  goalsProperty: string;
  areaProperty: string;
  statusProperty: string;
  deadlineProperty: string;
  completedProperty: string;
  closedProperty: string;
}

export interface ResourceProperties extends ParaCommonProperties {
  areaProperty: string;
  topicProperty: string;
  sourceProperty: string;
  tagProperty: string;
}

function parseCommon(
  frontmatter: Record<string, unknown>,
  properties: ParaCommonProperties
): ParaCommon {
  return {
    // Read as text rather than as a strict wikilink: an image is written as a
    // path, an embed or a link depending on how it got there, and all three
    // mean the same file.
    image: readString(frontmatter[properties.imageProperty]),
    priority: readNumberLike(frontmatter[properties.priorityProperty]),
    archived: readIsoDate(frontmatter[properties.archivedProperty]),
  };
}

export function parseArea(
  frontmatter: Record<string, unknown>,
  properties: ParaCommonProperties
): ParsedArea {
  return parseCommon(frontmatter, properties);
}

/**
 * An unrecognised `status:` reads as `ongoing`.
 *
 * That is what a half-typed note most likely means, and it is the reading that
 * keeps the goal on the list. A nullable status would add an "unknown" bucket
 * to every count in order to describe a typo.
 */
export function parseGoal(
  frontmatter: Record<string, unknown>,
  properties: GoalProperties
): ParsedGoal {
  const raw = readString(frontmatter[properties.statusProperty]);

  return {
    ...parseCommon(frontmatter, properties),
    areaTitle: linkOrText(frontmatter[properties.areaProperty]),
    // Through `readParaStatus`, not a cast: it is what turns a note's `paused`
    // into `blocked`, and casting the raw string would have left the old word
    // in the parsed value where every reader keys off the new one.
    //
    // An absent or unreadable status reads as `backlog`, which is what a note
    // that has not said anything means under this vocabulary.
    status: readParaStatus(raw) ?? 'backlog',
    deadline: readIsoDate(frontmatter[properties.deadlineProperty]),
    achieved: readIsoDate(frontmatter[properties.achievedProperty]),
    closed: readIsoDate(frontmatter[properties.closedProperty]),
  };
}

export function parseProject(
  frontmatter: Record<string, unknown>,
  properties: ProjectProperties
): ParsedProject {
  const raw = readString(frontmatter[properties.statusProperty]);

  return {
    ...parseCommon(frontmatter, properties),
    // Strict here, unlike the single-value links: a `goals:` list is a list of
    // references, and reading a stray sentence in it as a goal title would
    // invent a relationship the vault does not have.
    goalTitles: wikilinkTargets(frontmatter[properties.goalsProperty]),
    areaTitle: linkOrText(frontmatter[properties.areaProperty]),
    status: readParaStatus(raw) ?? 'backlog',
    deadline: readIsoDate(frontmatter[properties.deadlineProperty]),
    completed: readIsoDate(frontmatter[properties.completedProperty]),
    closed: readIsoDate(frontmatter[properties.closedProperty]),
  };
}

export function parseResource(
  frontmatter: Record<string, unknown>,
  properties: ResourceProperties
): ParsedResource {
  return {
    ...parseCommon(frontmatter, properties),
    areaTitle: linkOrText(frontmatter[properties.areaProperty]),
    topic: readString(frontmatter[properties.topicProperty]),
    source: readString(frontmatter[properties.sourceProperty]),
    tags: readStringList(frontmatter[properties.tagProperty]),
  };
}
