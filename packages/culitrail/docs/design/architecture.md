# Architecture

> **Status: built.** Describes the shape `src/` actually has.

## Entry point

CULItrail is one Obsidian plugin (`CULItrailPlugin`, `src/main.ts`,
`id: culitrail`) and one real `Plugin` subclass. There is nothing else to
compose:

```
CULItrailPlugin (extends Plugin)
├── I18nManager                 localization, initialized first
├── CULItrailSettingsStore      the one settings object + persistence
├── eight registered views      meal, gallery, meal plan, plan note, orders,
│                               order note, delivery note, dashboard
├── commands                    open-a-view, act-on-the-active-note, create
├── one code-block processor    culi-related-orders
├── ribbon icons                built once, toggled by CSS class
└── one settings page           Vault setup, Meal view, Planning, Orders,
                                Browsing, About, plus four sub-pages:
                                Folders, Property keys, Header badges,
                                Reheat appliances
```

`onload()` runs in a fixed order that matters: `I18nManager` first, because
every command name and view label below resolves through `t()`
synchronously and the locale-aware folder defaults resolve through it too;
then the settings store, because everything else takes a `getSettings()`
callback; then the views, the lifecycle subscriptions, the settings tab, the
code block, the ribbon and the commands.

Being a real `Plugin` rather than a `Component` hosted by one is a deliberate
structural choice. Composing several `Component` modules under a single
`Plugin`, the obvious move when they share a settings store, forces a
`ready: Promise<void>` convention on every one of them:
`Component.load()`/`onload()` are typed synchronous in Obsidian's API, so
nothing guarantees an async `onload()` body has finished before the plugin
is considered loaded. A real `Plugin` gets an awaited async `onload()`
from Obsidian itself, so the ordering above is expressed by plain `await`
and no `ready` promise is needed. Neither is a forwarding layer for
`addCommand` / `registerView` / `addRibbonIcon` / `addSettingTab`.

One small consequence to know when reading the source: the live settings
object is reached through **`plugin.getSettings()`**, a method rather than a
`settings` getter. Obsidian's own `Plugin` already declares a `settings`
property, and overriding a property with an accessor is an error. Same
reason APERtrail does it.

Everything downstream of `main.ts` takes settings as a
`getSettings: () => CULItrailSettings` callback rather than a snapshot, so a
settings change is picked up on the next render without anything having to
be rewired. Each view is handed a small deps object naming exactly the
callbacks it may use, so a view can ask for a gallery without deciding how
one opens.

## Source layout: five areas

`src/` is laid out in the same five areas the vault is, so a file's folder
answers "which part of the product owns this" before you open it:

```
src/main.ts        the one Plugin subclass
src/commands.ts    every command palette entry, in one file
src/lang/          I18nManager, the en/de translation tables, and the
                   fixed vocabularies (weekdays, meal slots)
src/settings/      types, defaults, validation, store, links, the settings
                   page (shell, sections/, pages/, editors/), the first-load
                   import from a sibling plugin
src/shared/        the thin App-bound edge (vault scanning, note reading and
                   writing, note stamps) plus the helpers that are only
                   CULItrail's: path templates, leaf opening, debounce,
                   expression eval, plain text. Dates, frontmatter reading,
                   wikilinks, vault paths, tags, the plan-line format and the
                   reheating merge come from trail-core
src/vault/         cross-area note reading: entity-types.ts, read-notes.ts
src/meals/         parser/, discovery/, editor/, gallery/, history/,
                   lifecycle/, reheating/, safety/, view/, view-model/
src/planning/      meal-plan/, view/, view-model/
src/orders/        types.ts, read-orders.ts, write-order.ts,
                   related-orders.ts, related-orders-block-lang.ts,
                   invoice-model.ts, company-defaults.ts, view/, view-model/
src/deliveries/    types.ts, read-deliveries.ts, write-delivery.ts,
                   delivery-note-model.ts, view/
src/crm/           types.ts, crm-note.ts, read-crm.ts, persons.ts,
                   company-terms.ts, supplier-lines-modal.ts
src/ui/            shared UI: the dashboard, the one toolbar every listing
                   view is built from, the lightbox, the modal shell, the
                   stat strip, the tab strip, the disclosure card, the field
                   picker, the reorderable list editor, the star row, the
                   week nav, the ribbon. The invoice renderer is NOT here:
                   it moved into trail-core with the model, and this package
                   only ships the two adapters and the CSS
src/types/         the one ambient module declaration
```

The dependency direction is one-way and worth keeping that way: `shared/`
knows about nothing, `vault/` knows about `shared/`, the area folders
know about `vault/`, and the views know about all of them. Nothing under
`vault/`, `meals/` (outside its own `view/`), `planning/`, `orders/`,
`deliveries/` or `crm/` imports a view.

`deliveries/` is the one area folder that reads a type from another: its `view/`
imports `OrderRecord` to offer the orders a delivery settles. The subtraction
itself is not here at all - `trail-core`'s `delivery/from-orders.ts` takes an
order's selections to work out what a box is still short of, and it takes the
narrowest shape it can rather than `OrderRecord`, so that dependency is on the
two fields it needs rather than on the orders area.

Three arrangements are worth naming:

- **Meal planning is its own area, `src/planning/`, not a folder under
  `meals/`.** It is keyed by ISO week and person rather than by dish, and
  since a plan entry marked eaten is what records a meal eaten, it is also where eating
  history lives. Leaving it under `meals/` would keep `meals/` as the place
  everything lives, which is the shape this split exists to get away from.
- **The settings types live in `src/settings/types.ts`, not beside the areas
  that use them.** The dependency direction is the reason: areas depend on
  settings, settings must not depend on an area.
- **The reorderable list editor is in `src/ui/`, not under `src/settings/`.**
  The three list settings were its only caller for a while, but the meal
  editor's two nutrient lists need the same add, remove, reorder and empty-state
  behaviour, and a `meals/` module importing out of `settings/view/` would have
  been the first cross-area import of its kind. Its button labels are still
  `settings.list.*`, since the settings lists remain its main caller.
- **`src/crm/` is deliberately shaped like APERtrail's**, down to the file
  names, so the two can be compared side by side. They are not shared code
  and never will be. They are two implementations that agreed on one
  contract, described in [Data model](data-model.md#people-and-companies).

## Settings and validation

`CULItrailSettingsStore` (`src/settings/store.ts`) owns one
`CULItrailSettings` object (`src/settings/types.ts`), a single flat interface
persisted as one `data.json`. The store is deliberately thin: it calls
`loadData()`, records whether anything came back, and hands the raw value to
`mergeSettings()`.

`mergeSettings()` (`src/settings/validate.ts`) validates every field
individually and falls back to the default for anything missing or of the
wrong type, so a hand-edited or corrupt `data.json` can never put a
non-string into a folder path. It is the only way a settings object is ever
built, which is what lets the rest of the codebase treat every field as
present and correctly typed.

Folder and heading defaults come from `getLocalizedDefaults()`
(`src/settings/defaults.ts`) rather than the static table, so a first load
in a German vault seeds German names instead of English ones that would then
have to be renamed by hand. Every sub-folder is derived from its module root
rather than being its own literal, which is what keeps the `Eating` tree
relocatable as a unit; the resolver falls back to the static English literals
when `I18nManager` is not initialized yet, which is the case in unit tests and
in the first moments of load.

`getLocalizedDefaults()` also takes the roots a saved `data.json`
already carries, so a sub-folder setting added later lands under the
**saved** root rather than under the pristine default. The saved root is the
vault owner's answer to "where does this live", and that answer has to
apply to sub-folders that did not exist when they gave it.

The store exposes `isFreshInstall`, set when `loadData()` returned `null`
(no file) or `{}` (an interrupted first write). It is acted on in one place
only: a fresh install runs the sibling-plugin settings import described
below. **No folder is created on first launch.** A plugin that made three
folders in a vault that may already have its own would be guessing, and every
reader here treats a folder that does not exist as a folder holding nothing.

### First-load import from a sibling plugin

On a fresh install only, `src/settings/foreign-settings-import.ts` reads
`<configDir>/plugins/apertrail/data.json` and adopts only the CRM-shaped
fields it recognizes: the folder paths, the type property name, the two type
values, the two tag properties and the person tag filter. Nothing else is
adopted, because adopting a folder only changes where the plugin looks, while
adopting a behaviour toggle changes what it does.

The read goes through a helper that never throws and returns `null` for a
missing, unreadable or invalid file, so an absent sibling plugin is
indistinguishable from a genuinely fresh vault. What it found is kept after
load for the one status row in the Orders section that reports it.

## Data flow: read and derive on every render

There is no index and no cache of note content. Every view, block and stat
is a **read-time projection** over the vault:

```
app.vault.getMarkdownFiles()
  -> filter by folder AND type          (vault/read-notes.ts)
  -> read frontmatter defensively        (shared/vault-scan.ts, trail-core)
  -> parse the note body where relevant  (meals/parser/, meals/reheating/)
  -> resolve wikilinks by title          (trail-core + vault/read-notes.ts)
  = the shape the caller asked for
```

The pure half of the model is deliberately kept free of `obsidian` imports
so it can be unit-tested without mocking `App`: the whole of
`meals/parser/`, `meals/view-model/`, `meals/safety/warnings.ts`,
`planning/meal-plan/note-parse.ts` and `plan-note.ts`,
`orders/view-model/orders-filter.ts` and `orders-sort.ts`,
`orders/invoice-model.ts` and `crm/crm-note.ts` all take plain data. The `App`-dependent wrappers sit beside them: `vault/read-notes.ts`,
`crm/read-crm.ts`, `orders/read-orders.ts`, `orders/write-order.ts`,
`meals/reheating/read-supplier.ts` and `planning/meal-plan/write.ts`.

Two reads are deliberately done once per render rather than once per note,
and both are worth knowing about because the per-note shape is the obvious
one to reach for. The suppliers are resolved in one pass over the orders, and
the eating history in one pass over the plan notes: 117 plan notes hold 444
events in the vault this was written against, and asking the question once
and keying the answer by meal is the difference between that and 126 passes.

Writes are the mirror image, and the order is always **note first, state
second**. A crash between the two leaves the note right and state stale,
which the next sync repairs; the other order leaves state claiming a meal the
note never held, which nothing repairs. The order writer clears only the keys
its own schema owns and never touches the note body, so it is one save path
rather than a set of field-level writes.

### The one exception: the meal-plan mirror

`settings.state.mealPlan` holds the meal-plan entries as structured objects.
This is a **mirror, not a source**: the per-person weekly note is
authoritative, and `planning/meal-plan/sync.ts` rebuilds the mirror from it.

The rule, stated in `CLAUDE.md`: the meal plan note and the order note are
Markdown, always the source of truth; plugin state mirrors them, and state
and note content never drift without an explicit sync path. The one action
that exists for saying "the note is right, make state agree" is the resync
command, which reconciles the currently viewed week. Every other sync fires
on navigation or on opening a view, which is exactly why a manual one is
needed for the week already on screen.

## Views

Eight views: meal, gallery, meal plan, one plan note rendered as its week,
orders, one order note rendered as an invoice, one delivery note rendered as
the same document without the money, and the dashboard. Four are `ItemView`s;
the meal view, the plan note view, the order note view and the delivery note
view are `TextFileView`s, because Obsidian then hands each the file's text and
treats the tab as the file itself. None of them ever writes `this.data` back,
which is what makes all four safe read-only presentations of an editable note.

All follow the **singleton-leaf** pattern via `findOrOpenLeaf()`
(`src/shared/open-leaf.ts`): opening the dashboard or gallery a second time
reveals the existing leaf rather than opening a duplicate. The gallery's
optional folder filter and search query travel through its own persisted
state rather than as arguments, which is how the dashboard's search box, the
folder-click integration and the browse footers all land in one gallery
showing what its own toolbar says it is showing.

The meal view, the plan note view, the order note view and the delivery note
view are the exception to "views are opened deliberately": each can **replace**
Obsidian's Markdown rendering when a note of its kind is opened
(`autoOpenMealView`, `autoOpenMealPlanView`, `autoOpenOrderView`,
`autoOpenDeliveryView`), through the subscriptions in
`meals/lifecycle/register-lifecycle.ts`. One registration serves all four
kinds: it takes a list of targets, each naming a kind, a view type,
the setting that enables it and how to open it. **Open as Markdown** suppresses
the conversion once for the file it acts on, so the escape hatch does not
immediately undo itself, and that suppression is shared, because it is about the
path rather than about which view it came from.

The meal view renders through one of two layout modules chosen by platform
(`meals/view/layouts/`), both fed by a single context built once per render.
A layout decides arrangement and nothing else: if it finds itself reading
frontmatter or splitting the body, that work belongs in the context builder
instead.

**Between emptying a container and drawing into it there must be no await.**
Three things ask the meal view to redraw -- `setViewData`, the metadata cache
and the plugin's own change signal -- and one save trips at least two of them
within a few milliseconds. The meal view used to empty its container on the
first line of `render()` and build the meal after two awaits, so a second
render emptied a container the first had not drawn into yet, both reads
finished, and both passes appended their own copy: saving a price put the whole
meal on screen twice, and any later redraw put it right again. The window is
exactly as long as the reads take, which is why it was sporadic rather than
constant. A `renderToken` now makes a superseded pass return before it draws,
and the container is emptied late, once the reads are done, which also removes
the blank flash while it reads. Either order works -- build first and await
afterwards, as the sibling views do, or empty late -- and
`tests/render-race.test.ts` is a source scan over every method in the package,
because the shape is easy to reintroduce and impossible to see in a diff.

Ribbon icons are built **once**, at load, and shown or hidden by toggling a
class on every settings save. Obsidian's ribbon does not reliably drop an icon
added via `addRibbonIcon()`; it keeps its own record of registered ribbon
actions and can redraw a "removed" one back in. Building every icon once and
toggling a class sidesteps that entirely.

## Code-block processors

One fenced-code-block language:

| Language | Rendered in | File |
|---|---|---|
| `culi-related-orders` | A Person or Company note | `src/orders/view/related-orders-block.ts` |

It takes no arguments and works out what to render from the rendering
context's own file path, so it is copy-pasteable between notes of the same
kind and cannot be pointed at the wrong note. Its language constant lives
outside the UI module that renders it
(`orders/related-orders-block-lang.ts`), because the order writer seeds the
block into notes and writers must not depend on a view.

`culi-` rather than any inherited prefix, because this block has never
existed in anyone's vault and there is no legacy string to protect. A
Person note in a vault that also has APERtrail carries this block alongside
`travel-related-trips`; that is two plugins each answering their own
question about the same note, and neither breaks when the other is absent.

## Internationalization

`I18nManager` (`src/lang/I18nManager.ts`) is initialized before anything
else in `onload()`, so every synchronous UI-building call to `t()` already
has a catalogue. Tables live in `src/lang/translations/`, with `en.ts` and
`de.ts` shipping today and the index file's comments noting where further
locales would be added.

Keys carry no top-level namespace: the dashboard's headings are
`dashboard.x`, the settings page's are `settings.x`, the meal area's are
`meals.x`.

`tests/translation-keys.test.ts` is the guard on the whole system: it
statically scans `src/` for literal `t('...')` calls, checks every key
against both tables, and asserts the two tables are structurally identical.
That guard exists because a missing key is otherwise silent: `t()` falls
back to returning the key itself and the typechecker only ever sees an
untyped string. Keys built by interpolation at their call sites are
enumerated by hand in that test, which is the price of building a key name
at runtime.

Every user-facing string, every default folder name, every default body
heading and every default `type:` value is routed through this system or
through a settings field with a translated default. The two exceptions are
named where they live: the weekday and meal-slot keys written into a plan
note, and the appliance ids, are stable English strings on disk with a
translated label at render, because translating what is written into a note
would orphan every note already carrying it.

## CSS

One stylesheet, `styles.css`, and one class prefix: **`culi-`**. Every class
the plugin adds carries it, so a rule in a user's own snippet can target the
plugin's markup without guessing and the plugin's rules cannot collide with
a theme's.

The conventions that come with it, from `CLAUDE.md`:

- No direct `element.style.x = ...`. CSS classes toggled with
  `addClass`/`removeClass`/`toggleClass` for binary states, Obsidian's
  `setCssProps()` only for genuinely dynamic runtime values such as drag
  positions and computed popover coordinates.
- No `innerHTML`/`outerHTML`. DOM is built with
  `createEl`/`createDiv`/`createSpan`/`empty()`, or `.textContent` for
  plain text.
- Modals extend the shared `BaseModal` (`src/ui/base-modal.ts`),
  which owns the sticky header, scrollable body and sticky footer; concrete
  modals implement `getTitle()`, `renderBody()` and `renderFooter()` and
  never touch `contentEl`. Footer buttons are right-aligned, one row,
  horizontal-scroll on overflow rather than wrap, Cancel before the primary
  action, and the primary action gets Obsidian's `mod-cta` (`mod-warning`
  if destructive) rather than custom colour CSS.
- No em dashes in any string a reader sees. `tests/no-em-dash.test.ts` is the
  guard, and the same rule is followed in these docs.

## Deliberate platform divergences

Mobile and desktop differ in a few places on purpose, not by oversight: the
tabbed mobile layout against the desktop stack, and the header strip, which
desktop renders as one row of columns and mobile as two boxed strips. These
are documented divergences. Do not "fix" one platform to match the other
without checking whether it is deliberate first.
