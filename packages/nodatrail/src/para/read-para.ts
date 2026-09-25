/**
 * Reading the PARA notes out of Obsidian's vault.
 *
 * One delegation per function to para-reader.ts through `hostFor()`, which
 * says why live and archived notes are read separately and marked.
 */
import { App, TFile } from 'obsidian';
import { hostFor } from '../shared/vault-host';
import type { NODAtrailSettings } from '../settings/types';
import {
  readAreasFrom,
  readGoalsFrom,
  readParaBoardFrom,
  readProjectsFrom,
  readResourcesFrom,
} from './para-reader';
import type { AreaRecord, GoalRecord, ParaBoard, ProjectRecord, ResourceRecord } from './board';

export { liveOnly } from './para-reader';

export function readAreas(app: App, settings: NODAtrailSettings): AreaRecord<TFile>[] {
  return readAreasFrom(hostFor(app), settings);
}

export function readGoals(app: App, settings: NODAtrailSettings): GoalRecord<TFile>[] {
  return readGoalsFrom(hostFor(app), settings);
}

export function readProjects(app: App, settings: NODAtrailSettings): ProjectRecord<TFile>[] {
  return readProjectsFrom(hostFor(app), settings);
}

export function readResources(app: App, settings: NODAtrailSettings): ResourceRecord<TFile>[] {
  return readResourcesFrom(hostFor(app), settings);
}

/** The whole tree in one pass. */
export function readParaBoard(app: App, settings: NODAtrailSettings): ParaBoard<TFile> {
  return readParaBoardFrom(hostFor(app), settings);
}
