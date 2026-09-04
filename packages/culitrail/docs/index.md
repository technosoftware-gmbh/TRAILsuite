# CULItrail documentation

> **Status: built.** Every page in this tree describes code that runs,
> except where a page says otherwise. The `culi-related-orders` block, the
> last piece that was still outstanding, ships too.

**Every meal you order ready-made, as plain Markdown.** CULItrail is an
Obsidian plugin (TypeScript, built with esbuild) for the meals a household
buys ready-made from a company and reheats at home: a structured meal view
carrying the reheating instructions per appliance, a searchable gallery,
per-person weekly meal planning, eating
history, and order tracking with an invoice view.

**There is no cooking in it.** A meal note says what the dish is, what it
costs, what is in it and how to warm it up. It carries no ingredient list
and no method, because a dish that arrives ready-made has neither, and a
plugin that asked for them would be asking about somebody else's kitchen.

CULItrail reads and writes ordinary Markdown notes with YAML frontmatter,
and **the notes in your vault are always the source of truth**. Every view
is a read-time projection over the vault, so hand-editing a note is always
safe. The one narrow exception, a rebuild-on-demand mirror of the meal-plan
entries, is documented in
[Data model & note conventions](design/data-model.md).

## Where CULItrail came from

CULItrail is deliberately a plugin of its own rather than one module of a
larger one, for the same reason travel is: a plugin scoped to a single area
can evolve on its own release cycle without dragging the rest of a vault
along. [APERtrail](https://github.com/technosoftware-gmbh/TRAILsuite/tree/main/packages/apertrail)
keeps trips and places; CULItrail keeps what gets eaten.

The meal code was built on the GPL-3.0
[Recipe Box](https://github.com/AdamArcane/obsidian-recipebox) plugin by
Arcane Tech / AdamArcane rather than rebuilt from scratch (see `NOTICE.md`).
That licence travels with the code: **CULItrail is GPL-3.0-or-later**, unlike
APERtrail.

## How CULItrail is organized

Both the vault layout and the plugin's own `src/` tree are split into five
areas, so the plugin can grow one area at a time rather than as one flat
surface:

```
Eating/
  Meals/                    one note per meal
  Meal Plans/               one note per person per ISO week
  Orders/                   one note per order
  Deliveries/               one note per box that arrived
CRM/
  People/ Companies/
```

| Area                           | What it covers                                                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Meals** (`src/meals/`)       | The meal note, the structured meal view, the gallery, eating history, the badges and the reheating section                                          |
| **Planning** (`src/planning/`) | Per-person weekly meal plans, keyed by ISO week, and the eating history their entries record                                                       |
| **Orders** (`src/orders/`)     | One note per order: what was bought from which company, per person, and the invoice an order note opens as                                          |
| **Deliveries** (`src/deliveries/`) | One note per box: what arrived and when, which is what the meal picker offers first                                                             |
| **CRM** (`src/crm/`)           | Person and Company notes, read out of `CRM/People` and `CRM/Companies`. CULItrail keeps no contact registry and creates no contact notes; the one property it ever writes on one is a company's `lines:` |

Everything that is neither area-specific nor App-free sits alongside them:
`src/vault/` reads notes across areas, `src/shared/` holds what is genuinely
only CULItrail's plus the thin `App`-shaped edge that hands the rest to
`trail-core`, `src/settings/` owns the one settings object and
its page, and `src/ui/` holds the dashboard and the shared components. The
renderer an order or a delivery note opens as is `trail-core`'s, because a
document is a statement about a note rather than one plugin's view over it.

`Eating` and `CRM` sit at the vault root by default, which is the shape the
[sample vault](design/sample-vault.md) is built in. An optional common parent
(`rootFolder`) moves both together if you would rather keep them under, say,
`4 Resources/Eating`.

## Standalone, and better together

CULItrail works completely on its own. It does not need APERtrail installed,
and it degrades in no way when it is absent.

When APERtrail is also installed, the two plugins **read the same Person
and Company notes**: same folders, same `type:` values, same tag
properties, all by default in both English and German. Neither plugin
depends on the other at runtime, and neither imports the other's code.
They agree through the vault, which is the only place two Obsidian plugins
should ever have to agree. See
[Shared CRM with APERtrail](design/shared-crm.md).

## Where to start

| If you want to...                                                                     | Read                                                                  |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Install the plugin, or try it on the sample vault                                     | [Installation](installation.md)                                       |
| Get a walkthrough from an empty vault to a planned week                               | [Usage](usage.md)                                                     |
| Understand meal notes, the meal view, gallery, dashboard, eating history and badges   | [Meals](features/meals.md)                                            |
| Understand per-person weekly meal planning                                            | [Meal planning](features/meal-planning.md)                            |
| Understand order tracking, and the people and companies behind it                     | [Orders, people & companies](features/orders-and-crm.md)              |
| See how the plugin is put together internally                                         | [Architecture](design/architecture.md)                                |
| Understand the frontmatter and note conventions CULItrail relies on                    | [Data model & note conventions](design/data-model.md)                 |
| See every setting, grouped the way the settings page groups them                      | [Settings reference](design/settings-reference.md)                    |
| Understand the build, lint and test setup                                             | [Testing & development](design/testing-and-development.md)            |
| Understand how People and Companies are shared with APERtrail                            | [Shared CRM](design/shared-crm.md)                                    |
| See how the sample vault is built and what the plugin reads from it                   | [Sample vault](design/sample-vault.md)                                |
| Understand how a bought dish gets its reheating instructions                            | [Ready meals](design/ready-meals.md)                                  |
| Read the plan for figure badges and what a meal costs                                   | [Badges & prices](design/badges-and-prices.md)                         |
| Understand how an order and a delivery note render as documents, and how a second plugin adopts the model | [Document view](design/invoice-view.md)               |
| Copy a starting shape for a Meal, Order, Delivery, Person or Company note              | [Templates](templates/index.md)                                       |

## At a glance

- **Plugin id:** `culitrail`
- **Version:** 0.1.0 (`manifest.json`)
- **Minimum Obsidian version:** 1.12.0
- **Platforms:** desktop and mobile (`isDesktopOnly: false`), with a few
  deliberate desktop/mobile UI divergences (see [Meals](features/meals.md))
- **Languages:** English and German UI out of the box, detected from
  Obsidian's own language setting, with every folder name, type value and
  frontmatter property name configurable in Settings, the property names behind
  a lock that ships off because they are what existing notes are read by.
  Nothing matches a dish's prose against a built-in word list any more, so no
  feature quietly does nothing in a vault written in a third language
- **License:** GPL-3.0-or-later (see `NOTICE.md` for the Recipe Box
  attribution)

## Documentation conventions used in these docs

Folder names shown in examples (`Eating/Meals`, `CRM/People`, ...) are
the default **English** locale names from `src/settings/defaults.ts` and
`src/lang/translations/en.ts`. A German-locale vault seeds the German
defaults instead (`Essen/Mahlzeiten`, `CRM/Personen`, ...). Every one of these
paths is a plugin setting, not a hardcoded path, so any vault can rename
them freely without breaking anything. The same is true of every `type:`
value and every frontmatter property name.

Where a page and the code disagree, the code is right and the page is the
bug.
