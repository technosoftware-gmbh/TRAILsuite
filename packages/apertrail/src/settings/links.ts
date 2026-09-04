/**
 * Every URL the plugin points a person at, spelled once.
 *
 * They were scattered across the About section before, which is how a
 * repository link ends up correct in one place and stale in another.
 */
const REPOSITORY_URL = 'https://github.com/technosoftware-gmbh/TRAILsuite';

export const LINKS = {
  /** The plugin's own directory in the monorepo. */
  plugin: `${REPOSITORY_URL}/tree/main/packages/apertrail`,
  docs: `${REPOSITORY_URL}/tree/main/packages/apertrail/docs`,
  releases: `${REPOSITORY_URL}/releases`,
  issues: `${REPOSITORY_URL}/issues`,
  vendor: 'https://technosoftware.com',
  support: 'mailto:support@technosoftware.com',
  /**
   * The two donation targets. Both are Technosoftware's; change them here and
   * the buttons follow.
   */
  sponsor: 'https://github.com/sponsors/technosoftware-gmbh',
  coffee: 'https://buymeacoffee.com/technosoftware',
} as const;
