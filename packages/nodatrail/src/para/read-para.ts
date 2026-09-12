/**
 * Reading the PARA notes out of the vault.
 *
 * Nothing is cached: every view re-reads on render, so what a view shows can
 * never drift from what is on disk.
 *
 * Live and archived are read separately and the record says which it was, so no
 * caller can include the archive by accident. Including an archived project in
 * a list of active ones is the mistake this shape exists to make impossible to
 * write without meaning to.
 */
import { App, TFile } from 'obsidian';
import type { NODAtrailSettings } from '../settings/types';
import { archiveFolderFor, type NodaFolderType } from '../vault/entity-types';
import { isArchivedPath, readAllNotes, type NodaNote } from '../vault/read-notes';
import { parseArea, parseGoal, parseProject, parseResource } from './parse';
import {
  commonProperties,
  goalProperties,
  projectProperties,
  resourceProperties,
} from './properties';
import type { AreaRecord, GoalRecord, ParaBoard, ProjectRecord, ResourceRecord } from './board';

/** Reads one kind, live and archived together, and marks each record. */
function records<T>(
  app: App,
  settings: NODAtrailSettings,
  type: NodaFolderType,
  parse: (frontmatter: Record<string, unknown>) => T
): { file: TFile; title: string; note: T; archived: boolean }[] {
  const archiveRoot = archiveFolderFor(settings, type) ?? '';

  return readAllNotes(app, settings, type).map((note: NodaNote) => ({
    file: note.file,
    title: note.title,
    note: parse(note.frontmatter),
    archived: isArchivedPath(note.file.path, archiveRoot),
  }));
}

export function readAreas(app: App, settings: NODAtrailSettings): AreaRecord<TFile>[] {
  const properties = commonProperties(settings);
  return records(app, settings, 'area', (fm) => parseArea(fm, properties));
}

export function readGoals(app: App, settings: NODAtrailSettings): GoalRecord<TFile>[] {
  const properties = goalProperties(settings);
  return records(app, settings, 'goal', (fm) => parseGoal(fm, properties));
}

export function readProjects(app: App, settings: NODAtrailSettings): ProjectRecord<TFile>[] {
  const properties = projectProperties(settings);
  return records(app, settings, 'project', (fm) => parseProject(fm, properties));
}

export function readResources(app: App, settings: NODAtrailSettings): ResourceRecord<TFile>[] {
  const properties = resourceProperties(settings);
  return records(app, settings, 'resource', (fm) => parseResource(fm, properties));
}

/**
 * The whole tree in one pass.
 *
 * One call rather than four, because every view that shows a project also needs
 * the goals to derive its area, and four independent reads in a render would be
 * four independent chances to show a half-updated picture.
 */
export function readParaBoard(app: App, settings: NODAtrailSettings): ParaBoard<TFile> {
  return {
    areas: readAreas(app, settings),
    goals: readGoals(app, settings),
    projects: readProjects(app, settings),
    resources: readResources(app, settings),
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
