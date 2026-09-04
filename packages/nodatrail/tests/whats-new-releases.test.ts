/**
 * What the What's New panel counts as a release.
 *
 * The panel shows three sections and the changelog carries a fourth kind:
 * `[Unreleased]`, which `docs/releasing.md` opens empty at every release. A
 * user opening the panel straight after an update is the one person guaranteed
 * to see whatever sits at the top, so an empty heading there is the failure
 * this guards.
 */
import { describe, expect, it } from 'vitest';
import { recentReleases } from '../src/ui/settings/whats-new-releases';

const CHANGELOG = [
  '# Changelog',
  '',
  'Prose about the format, which is not a release.',
  '',
  '## [Unreleased]',
  '',
  '## [1.0.0] - 2026-09-04',
  '',
  '- The first public release.',
  '',
  '## [0.1.0] - unreleased',
  '',
  '- The first version.',
  '',
].join('\n');

describe('recentReleases', () => {
  it('drops the preamble and the unreleased section', () => {
    const sections = recentReleases(CHANGELOG);
    expect(sections.map((section) => section.split('\n')[0])).toEqual([
      '## [1.0.0] - 2026-09-04',
      '## [0.1.0] - unreleased',
    ]);
  });

  it('keeps the newest sections when there are more than the limit', () => {
    const many = ['## [3.0.0]', 'c', '## [2.0.0]', 'b', '## [1.0.0]', 'a'].join('\n');
    expect(recentReleases(many, 2).map((s) => s.split('\n')[0])).toEqual([
      '## [3.0.0]',
      '## [2.0.0]',
    ]);
  });
});
