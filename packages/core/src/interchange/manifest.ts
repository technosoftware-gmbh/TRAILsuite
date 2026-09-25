/**
 * Every note in a vault, raw, read through the vault ports.
 *
 * App-free, and reads no filesystem itself: the host does, whichever host it is.
 */
import { splitFrontmatterBlock } from '../frontmatter/block.js';
import type { VaultFile, VaultHost } from '../vault/ports.js';
import {
  INTERCHANGE_FORMAT,
  INTERCHANGE_VERSION,
  VAULT_SOURCE,
  type RawNote,
  type VaultManifest,
} from './types.js';

/** One note as the vault holds it: the host's parsed frontmatter and the text after the block. */
export async function readRawNote<F extends VaultFile>(
  host: VaultHost<F>,
  file: F
): Promise<RawNote> {
  const text = await host.vault.read(file);
  return {
    path: file.path,
    title: file.basename,
    frontmatter: host.metadata.frontmatterOf(file),
    body: splitFrontmatterBlock(text).body,
  };
}

/**
 * `vault.json`: every markdown note the host lists, in path order.
 *
 * Path order so two exports of an unchanged vault are the same file, which is
 * what makes a diff between them mean something.
 */
export async function vaultManifest<F extends VaultFile>(
  host: VaultHost<F>,
  meta: { sourceVersion: string; generatedAt: string }
): Promise<VaultManifest> {
  const files = [...host.vault.markdownFiles()].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0
  );
  const notes: RawNote[] = [];
  for (const file of files) notes.push(await readRawNote(host, file));

  return {
    format: INTERCHANGE_FORMAT,
    version: INTERCHANGE_VERSION,
    source: VAULT_SOURCE,
    sourceVersion: meta.sourceVersion,
    generatedAt: meta.generatedAt,
    notes,
  };
}
