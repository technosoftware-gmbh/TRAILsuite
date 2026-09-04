/**
 * One `VaultHost` per `App`, for the shims that still take an `App`.
 *
 * `trail-core`'s vault primitives read and write through three ports rather
 * than through an Obsidian `App`. Threading a host down to every call site
 * would be a large diff for no behaviour change, so the modules around this one
 * keep their `App`-shaped signatures and build the host here on the way in.
 *
 * Memoised because a host is three closures over one app and a vault read
 * builds one per call: a `WeakMap` keyed on the app allocates once per plugin
 * instance and still lets a test's throwaway app be collected.
 */
import type { App } from 'obsidian';
import { obsidianHost, type ObsidianHost } from 'trail-core/obsidian';

const hosts = new WeakMap<App, ObsidianHost>();

/** The vault host over an `App`, built once and reused. */
export function hostFor(app: App): ObsidianHost {
  const existing = hosts.get(app);
  if (existing) return existing;

  const host = obsidianHost(app);
  hosts.set(app, host);
  return host;
}
