/** The frontmatter layer's public surface. */
export * from './read.js';
export * from './block.js';
export * from './stamps.js';
export * from './stamp-read.js';
export { setFrontmatterBlock, setFrontmatterValue, setFrontmatterValues } from './write.js';
export type { FrontmatterValue } from './write.js';
