/**
 * Building a PARA note's frontmatter.
 *
 * An object rather than YAML text, so the writer hands it to Obsidian's own
 * serialiser and a test can inspect it. Optional fields are omitted rather than
 * written empty: a note holding `deadline:` with nothing after it says
 * something different from one that never had the property.
 *
 * `created` is not written here. It is stamped as a second pass by the core's
 * `touchCreated()`, because splicing a property into a YAML block by hand is
 * how a quoting bug is born, and because the stamp has to land directly after
 * `type:` whatever else the note carries.
 *
 * Pure.
 */
import { wikilinkValue } from '@technosoftware/trail-core';
import type {
  GoalProperties,
  ParaCommonProperties,
  ProjectProperties,
  ResourceProperties,
} from './parse';
import type { ParsedGoal, ParsedProject, ParsedResource, ParaCommon } from './types';

/** The type property and its value, which every note leads with. */
export interface TypeProperties {
  typePropertyName: string;
  typeValue: string;
}

function commonEntries(
  properties: ParaCommonProperties,
  content: ParaCommon
): Record<string, unknown> {
  const entries: Record<string, unknown> = {};

  if (content.image) entries[properties.imageProperty] = content.image;
  if (content.priority !== null) entries[properties.priorityProperty] = content.priority;
  // The archive stamp is written by the archive command rather than by a
  // creation, so this is only ever carrying an existing one across a rewrite.
  if (content.archived) entries[properties.archivedProperty] = content.archived;

  return entries;
}

export function buildAreaFrontmatter(
  type: TypeProperties,
  properties: ParaCommonProperties,
  content: ParaCommon
): Record<string, unknown> {
  return {
    [type.typePropertyName]: type.typeValue,
    ...commonEntries(properties, content),
  };
}

export function buildGoalFrontmatter(
  type: TypeProperties,
  properties: GoalProperties,
  content: ParsedGoal
): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {
    [type.typePropertyName]: type.typeValue,
  };

  if (content.areaTitle) frontmatter[properties.areaProperty] = wikilinkValue(content.areaTitle);
  frontmatter[properties.statusProperty] = content.status;
  Object.assign(frontmatter, commonEntries(properties, content));
  if (content.deadline) frontmatter[properties.deadlineProperty] = content.deadline;
  if (content.achieved) frontmatter[properties.achievedProperty] = content.achieved;

  return frontmatter;
}

export function buildProjectFrontmatter(
  type: TypeProperties,
  properties: ProjectProperties,
  content: ParsedProject
): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {
    [type.typePropertyName]: type.typeValue,
  };

  // A project with no goals is written with no `goals:` at all rather than an
  // empty list. Unlike a meal plan's entries, an empty list here says nothing
  // an absent property does not.
  if (content.goalTitles.length > 0) {
    frontmatter[properties.goalsProperty] = content.goalTitles.map(wikilinkValue);
  }
  if (content.areaTitle) frontmatter[properties.areaProperty] = wikilinkValue(content.areaTitle);
  frontmatter[properties.statusProperty] = content.status;
  Object.assign(frontmatter, commonEntries(properties, content));
  if (content.deadline) frontmatter[properties.deadlineProperty] = content.deadline;
  if (content.completed) frontmatter[properties.completedProperty] = content.completed;

  return frontmatter;
}

export function buildResourceFrontmatter(
  type: TypeProperties,
  properties: ResourceProperties,
  content: ParsedResource
): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {
    [type.typePropertyName]: type.typeValue,
  };

  if (content.areaTitle) frontmatter[properties.areaProperty] = wikilinkValue(content.areaTitle);
  if (content.topic) frontmatter[properties.topicProperty] = content.topic;
  if (content.source) frontmatter[properties.sourceProperty] = content.source;
  if (content.tags.length > 0) frontmatter[properties.tagProperty] = content.tags;
  Object.assign(frontmatter, commonEntries(properties, content));

  return frontmatter;
}
