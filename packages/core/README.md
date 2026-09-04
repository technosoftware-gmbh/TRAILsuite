# TRAILcore

A [Technosoftware GmbH](https://technosoftware.com) product, part of
[TRAILsuite](https://github.com/technosoftware-gmbh/TRAILsuite).

The shared, Obsidian-free core behind two Obsidian plugins:

- **APERtrail** (`packages/apertrail`) - travel planning for photography
- **CULItrail** (`packages/culitrail`) - ordered meals, meal plans, orders

Everything exported from this package is pure: no Obsidian, no DOM, no
filesystem, no clock that cannot be injected. That is not tidiness. It is what
lets the same code run inside a plugin, inside vitest under Node, and inside a
standalone application that has never heard of Obsidian.

The rule is enforced twice, by `eslint`'s `no-restricted-imports` and again by
`tests/obsidian-free.test.ts`, which reads the source rather than trusting the
lint run.

## Status

Everything the extraction set out to move has landed: the CRM contract, `dates`,
`links`, `frontmatter`, `paths`, `markdown`, the vault port and its Obsidian
adapter, the note formats (`meal`, `plan`, `order`, `delivery`, `reheating`) and
`geo`/`solar`.

What remains is `i18n/`, and it is not scheduled. The core ships no user-facing
strings today and throws typed errors instead, so a shared `i18n/` would be a
place to put the message catalogues the plugins each own, not a gap that
anything is currently working around.

The extraction plan this was sequenced from is not in this repository and is not
in its history; it predates the merge into TRAILsuite. The promotion rule below
is what remains of it, and it is the part that still decides anything.

## Install

A workspace of this repository, linked by npm rather than fetched from a
registry:

```jsonc
"dependencies": { "trail-core": "*" }
```

npm runs `prepare` on install, so `dist/` is built by the root `npm install` and
is not committed. A change that spans the core and a plugin is visible to the
plugin as soon as the core is rebuilt.

All three plugins bundle with esbuild and list only `obsidian`, `electron`,
CodeMirror, Lezer and node builtins as external, so an import from here is
bundled into `main.js` like any other. No build configuration changes.

## Consuming the Obsidian adapter

`trail-core/obsidian` imports `obsidian` as a real value. That package ships
types only (`"main": ""`), so a consumer's test runner cannot resolve it from in
here and needs an alias:

```ts
// vitest.config.ts
resolve: {
  alias: {
    obsidian: new URL('./tests/obsidian-stub.ts', import.meta.url).pathname,
  }
}
```

Let the stub throw rather than approximate. Nothing in a test should be calling
through to a real serializer, and a loud failure names the problem where a
plausible-looking stand-in would not.

## Use

```ts
import { CRM_CONTRACT, crmContractMismatches } from 'trail-core';

// In a plugin's defaults:
export const DEFAULT_SETTINGS = {
  ...CRM_CONTRACT,
  // the plugin's own fields
};

// In that plugin's test suite:
expect(crmContractMismatches(DEFAULT_SETTINGS)).toEqual([]);
```

## Develop

```
npm install
npm run check     # typecheck + lint + test
```

## The promotion rule

Three doors, and a module has to come through one of them.

**Behaviour** moves here when **two** consumers genuinely need it: one consumer
is a module that belongs in its plugin, two is a contract.

**A note format** belongs here whatever the number of readers, because a format
is an agreement about a file rather than one plugin's model of it, and a format
defined inside the code that renders it changes whenever the rendering does.

**Arithmetic that describes the world** rather than a product, such as a
haversine or a solar solve, belongs here on the same footing.

What stays out is what a product decides for itself: views, user-facing strings,
settings objects, and schemas such as the trip and photo-spot shapes. See
`CLAUDE.md` for the worked examples.

## Licence

Copyright (c) 2026 Technosoftware GmbH, Switzerland. MIT, deliberately more
permissive than the plugins: CULItrail is GPL-3.0-or-later and APERtrail is
PolyForm Noncommercial 1.0.0. See `NOTICE.md` for why that direction and not
the other.
