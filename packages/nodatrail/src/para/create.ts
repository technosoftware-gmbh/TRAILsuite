/**
 * Creating the four PARA notes.
 *
 * Each is a thin arrangement of three things that already exist: the builder
 * from `write.ts`, the property mapping from `properties.ts`, and the one
 * creation helper. Creation writes a note and never touches it again, exactly
 * like the sibling plugins' creators.
 *
 * **`body` is forwarded, not composed.** These functions know that a note may
 * open with text and nothing about what the text says; the summary block is
 * `summary.ts`'s shape and the form's to fill in. Keeping the vocabulary out of
 * here is what lets a second kind of opening block arrive without touching four
 * creation functions.
 */
import { newProjectFolder } from './project-folder';
import { App, TFile } from 'obsidian';
import type { NODAtrailSettings } from '../settings/types';
import { createTypedNote } from '../vault/create-note';
import { folderFor } from '../vault/entity-types';
import {
  buildAreaFrontmatter,
  buildGoalFrontmatter,
  buildProjectFrontmatter,
  buildResourceFrontmatter,
} from './write';
import {
  commonProperties,
  goalProperties,
  projectProperties,
  resourceProperties,
  typeProperties,
} from './properties';
import type { ParaCommon, ParsedGoal, ParsedProject, ParsedResource } from './types';

/** What every creation form fills in, before the kind-specific fields. */
export const EMPTY_COMMON: ParaCommon = {
  image: null,
  priority: null,
  archived: null,
};

export function createArea(
  app: App,
  settings: NODAtrailSettings,
  title: string,
  content: ParaCommon,
  now: Date,
  body?: string
): Promise<TFile> {
  return createTypedNote(
    app,
    settings,
    {
      folder: folderFor(settings, 'area'),
      title,
      typeValue: settings.areaTypeValue,
      properties: stripType(
        buildAreaFrontmatter(
          typeProperties(settings, settings.areaTypeValue),
          commonProperties(settings),
          content
        ),
        settings
      ),
      body,
    },
    now
  );
}

export function createGoal(
  app: App,
  settings: NODAtrailSettings,
  title: string,
  content: ParsedGoal,
  now: Date,
  body?: string
): Promise<TFile> {
  return createTypedNote(
    app,
    settings,
    {
      folder: folderFor(settings, 'goal'),
      title,
      typeValue: settings.goalTypeValue,
      properties: stripType(
        buildGoalFrontmatter(
          typeProperties(settings, settings.goalTypeValue),
          goalProperties(settings),
          content
        ),
        settings
      ),
      body,
    },
    now
  );
}

export function createProject(
  app: App,
  settings: NODAtrailSettings,
  title: string,
  content: ParsedProject,
  now: Date,
  body?: string
): Promise<TFile> {
  return createTypedNote(
    app,
    settings,
    {
      // A folder of its own, named after the project: see `project-folder.ts`
      // for why, and for how a grouping folder keeps working alongside it.
      folder: newProjectFolder(settings, title),
      title,
      typeValue: settings.projectTypeValue,
      properties: stripType(
        buildProjectFrontmatter(
          typeProperties(settings, settings.projectTypeValue),
          projectProperties(settings),
          content
        ),
        settings
      ),
      body,
    },
    now
  );
}

export function createResource(
  app: App,
  settings: NODAtrailSettings,
  title: string,
  content: ParsedResource,
  now: Date,
  body?: string
): Promise<TFile> {
  return createTypedNote(
    app,
    settings,
    {
      folder: folderFor(settings, 'resource'),
      title,
      typeValue: settings.resourceTypeValue,
      properties: stripType(
        buildResourceFrontmatter(
          typeProperties(settings, settings.resourceTypeValue),
          resourceProperties(settings),
          content
        ),
        settings
      ),
      body,
    },
    now
  );
}

/**
 * The builders lead with the type property, and so does `frontmatterObject`.
 *
 * Handing the type through twice would put it before the created stamp and then
 * again after it, and the second one would win. Taking it off here rather than
 * giving the builders a mode keeps them usable for a rewrite of an existing
 * note, which is what they will be for once the editors land.
 */
function stripType(
  frontmatter: Record<string, unknown>,
  settings: NODAtrailSettings
): Record<string, unknown> {
  const { [settings.typePropertyName]: _type, ...rest } = frontmatter;
  return rest;
}
