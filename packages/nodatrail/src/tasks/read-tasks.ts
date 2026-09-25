/**
 * The tasks inside Obsidian: one delegation to the host-free reader in
 * `task-reader.ts`, which the interchange export runs outside it, plus the
 * one-note read a block rendered inside a note uses.
 *
 * Reading a note's text is asynchronous, so this is too. Every view that shows
 * tasks awaits it once per render rather than caching, which is the suite's
 * rule and the reason a task list can never disagree with the note it came
 * from.
 */
import { App, TFile } from 'obsidian';
import { scanTasks } from '@technosoftware/trail-core';
import { hostFor } from '../shared/vault-host';
import type { NODAtrailSettings } from '../settings/types';
import { readTasksFrom, type HostTask } from './task-reader';

/** A task, and the note it was found in. */
export type VaultTask = HostTask<TFile>;

/** Every checkbox line under the configured folders. See `task-reader.ts`. */
export async function readTasks(app: App, settings: NODAtrailSettings): Promise<VaultTask[]> {
  return readTasksFrom(hostFor(app), settings);
}

/** The tasks in one note, for a block rendered inside it. */
export async function readTasksIn(app: App, file: TFile): Promise<VaultTask[]> {
  const text = await hostFor(app).vault.read(file);
  return scanTasks(text).map((task) => ({ ...task, file }));
}
