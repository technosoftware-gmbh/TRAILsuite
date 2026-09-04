/**
 * The package's public surface.
 *
 * Everything reachable from here is pure: no Obsidian, no DOM, no filesystem,
 * no clock that cannot be injected. That is what lets the same code run inside
 * an Obsidian plugin, inside vitest under Node, and inside a standalone
 * application that has never heard of Obsidian.
 *
 * Modules arrive here one at a time, and each has to earn the move. For
 * behaviour the test is two consumers: one consumer is a module that belongs in
 * its plugin, two is a contract. A note format earns it on its own terms,
 * whatever the number of codebases reading it, because the shape of a note is
 * an agreement about the file rather than one plugin's model of it, and a
 * format defined inside the code that renders it changes whenever the rendering
 * does. Arithmetic that describes the world rather than a product, a haversine
 * or a solar solve, earns it the same way.
 * See docs/design/extraction-plan.md.
 */
export * from './calendar/index.js';
export * from './crm/index.js';
export * from './dates/index.js';
export * from './delivery/index.js';
export * from './fulfilment/index.js';
export * from './expense/index.js';
export * from './document/index.js';
export * from './frontmatter/index.js';
export * from './geo/index.js';
export * from './ledger/index.js';
export * from './links/index.js';
export * from './markdown/index.js';
export * from './money/index.js';
export * from './paths/index.js';
export * from './period/index.js';
export * from './priority/index.js';
export * from './plan/index.js';
export * from './meal/index.js';
export * from './order/index.js';
export * from './reheating/index.js';
export * from './sample/index.js';
export * from './settings/index.js';
export * from './solar/index.js';
export * from './tasks/index.js';
export * from './vault/index.js';
