/**
 * Reading the PARA notes through the core's vault ports.
 *
 * Nothing is cached: every view re-reads on render, so what a view shows can
 * never drift from what is on disk.
 *
 * Live and archived are read separately and the record says which it was, so no
 * caller can include the archive by accident. Including an archived project in
 * a list of active ones is the mistake this shape exists to make impossible to
 * write without meaning to.
 *
 * Imports nothing from `obsidian` at runtime; read-para.ts is the Obsidian side.
 */
import type { VaultFile, VaultHost } from '@technosoftware/trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { archiveFolderFor, type NodaFolderType } from '../vault/entity-types';
import { isArchivedPath, readAllNotesFrom, type NodaNote } from '../vault/notes-reader';
import { parseArea, parseGoal, parseProject, parseResource } from './parse';
import {
  commonProperties,
  goalProperties,
  projectProperties,
  resourceProperties,
} from './properties';
import type { AreaRecord, GoalRecord, ParaBoard, ProjectRecord, ResourceRecord } from './board';

/** Reads one kind, live and archived together, and marks each record. */
function records<F extends VaultFile, T>(
  host: VaultHost<F>,
  settings: NODAtrailSettings,
  type: NodaFolderType,
  parse: (frontmatter: Record<string, unknown>) => T
): { file: F; title: string; note: T; archived: boolean }[] {
  const archiveRoot = archiveFolderFor(settings, type) ?? '';

  return readAllNotesFrom(host, settings, type).map((note: NodaNote<F>) => ({
    file: note.file,
    title: note.title,
    note: parse(note.frontmatter),
    archived: isArchivedPath(note.file.path, archiveRoot),
  }));
}

export function readAreasFrom<F extends VaultFile>(
  host: VaultHost<F>,
  settings: NODAtrailSettings
): AreaRecord<F>[] {
  const properties = commonProperties(settings);
  return records(host, settings, 'area', (fm) => parseArea(fm, properties));
}

export function readGoalsFrom<F extends VaultFile>(
  host: VaultHost<F>,
  settings: NODAtrailSettings
): GoalRecord<F>[] {
  const properties = goalProperties(settings);
  return records(host, settings, 'goal', (fm) => parseGoal(fm, properties));
}

export function readProjectsFrom<F extends VaultFile>(
  host: VaultHost<F>,
  settings: NODAtrailSettings
): ProjectRecord<F>[] {
  const properties = projectProperties(settings);
  return records(host, settings, 'project', (fm) => parseProject(fm, properties));
}

export function readResourcesFrom<F extends VaultFile>(
  host: VaultHost<F>,
  settings: NODAtrailSettings
): ResourceRecord<F>[] {
  const properties = resourceProperties(settings);
  return records(host, settings, 'resource', (fm) => parseResource(fm, properties));
}

/**
 * The whole tree in one pass.
 *
 * One call rather than four, because every view that shows a project also needs
 * the goals to derive its area, and four independent reads in a render would be
 * four independent chances to show a half-updated picture.
 */
export function readParaBoardFrom<F extends VaultFile>(
  host: VaultHost<F>,
  settings: NODAtrailSettings
): ParaBoard<F> {
  return {
    areas: readAreasFrom(host, settings),
    goals: readGoalsFrom(host, settings),
    projects: readProjectsFrom(host, settings),
    resources: readResourcesFrom(host, settings),
  };
}

/** Only the live notes of a board, which is what every "what am I working on" view wants. */
export function liveOnly<F>(board: ParaBoard<F>): ParaBoard<F> {
  return {
    areas: board.areas.filter((record) => !record.archived),
    goals: board.goals.filter((record) => !record.archived),
    projects: board.projects.filter((record) => !record.archived),
    resources: board.resources.filter((record) => !record.archived),
  };
}
