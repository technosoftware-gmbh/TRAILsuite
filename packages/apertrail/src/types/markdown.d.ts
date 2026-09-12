/**
 * Markdown files imported as text.
 *
 * `whats-new-modal.ts` imports the package's own CHANGELOG.md so the release
 * notes shown in Obsidian are the released notes rather than a copy of them
 * that can drift. esbuild is told to load `.md` as text (see
 * esbuild.config.mjs); this declaration is what tells the typechecker the
 * same thing.
 */
declare module '*.md' {
  const content: string;
  export default content;
}
