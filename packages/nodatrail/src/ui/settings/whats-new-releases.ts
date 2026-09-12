/**
 * Which sections of a changelog the What's New panel treats as releases.
 *
 * Split out from the modal because the modal imports `CHANGELOG.md` as a
 * string at build time, which only esbuild can do: a test that imported the
 * modal would be asking vitest to parse Markdown as JavaScript. The rule for
 * what counts as a release is the part worth testing, so it lives here where
 * it can be.
 */

/** How many releases the modal shows before deferring to the full changelog. */
export const RELEASES_SHOWN = 3;

/** The heading the next release is written under, which is not a release. */
const UNRELEASED = /^##\s*\[unreleased\]/i;

/**
 * The changelog's release sections, newest first.
 *
 * A release starts at a level-two heading and runs to the next one, which is
 * the shape "Keep a Changelog" prescribes and the changelogs follow. The
 * preamble above the first such heading is prose about the format rather than
 * a release, so it is dropped.
 *
 * `[Unreleased]` is dropped as well. It is where the next release is written,
 * and `docs/releasing.md` opens an empty one at every release, so keeping it
 * would spend one of the three places on a heading with nothing under it for
 * whoever opens the panel first after an update.
 */
export function recentReleases(source: string, limit = RELEASES_SHOWN): string[] {
  const sections: string[] = [];
  let current: string[] | null = null;

  for (const line of source.split('\n')) {
    if (line.startsWith('## ')) {
      if (current) sections.push(current.join('\n').trim());
      current = [line];
      continue;
    }
    if (current) current.push(line);
  }
  if (current) sections.push(current.join('\n').trim());

  return sections.filter((section) => !UNRELEASED.test(section)).slice(0, limit);
}
