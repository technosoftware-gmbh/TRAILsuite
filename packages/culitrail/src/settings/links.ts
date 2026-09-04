/**
 * Every URL the plugin points a person at, spelled once.
 *
 * Scattering them across the About section is how a repository link ends up
 * correct in one place and stale in another.
 */
const REPOSITORY_URL = 'https://github.com/technosoftware-gmbh/TRAILsuite';

export const LINKS = {
  /** The plugin's own directory in the monorepo. */
  plugin: `${REPOSITORY_URL}/tree/main/packages/culitrail`,
  docs: `${REPOSITORY_URL}/tree/main/packages/culitrail/docs`,
  releases: `${REPOSITORY_URL}/releases`,
  issues: `${REPOSITORY_URL}/issues`,
  vendor: 'https://technosoftware.com',
  support: 'mailto:support@technosoftware.com',
  /**
   * The project CULItrail descends from. Not decoration: this plugin is
   * GPL-3.0-or-later because of it, and the credit is part of honouring that
   * licence rather than merely complying with it.
   */
  recipeBox: 'https://github.com/AdamArcane/obsidian-recipebox',
  /** The two donation targets. Change them here and the buttons follow. */
  sponsor: 'https://github.com/sponsors/technosoftware-gmbh',
  coffee: 'https://buymeacoffee.com/technosoftware',
} as const;
