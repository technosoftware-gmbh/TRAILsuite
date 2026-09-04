# Architecture

## Entry point

APERtrail is one Obsidian plugin (`APERtrailPlugin`, `src/main.ts`, `id: apertrail`) and one real `Plugin` subclass. There is nothing else to compose:

```
APERtrailPlugin (extends Plugin)
├── I18nManager                 localization, initialized first
├── APERtrailSettingsStore      the one settings object + persistence
├── four registered views       Trips, Places and CRM dashboards, gallery
├── eighteen commands           three dashboards, gallery, twelve creation
│                            commands, health check, field sheet export
├── four code-block processors  travel-itinerary, travel-related-trips,
│                            apt-photo-spot, apt-trip-costs
├── one ribbon icon             map
└── one settings page           Vault setup, switches, About, plus two
                             sub-pages: Folders and Property keys
```

`onload()` runs in a fixed order that matters: `I18nManager` first, because every command name and view label below resolves through `t()` synchronously; then the settings store, because everything else takes a `getSettings()` callback; then views, commands, blocks, ribbon and settings tab.

Being a real `Plugin` rather than something a host plugin composes buys two things worth naming. The Plugin-only APIs (`addCommand`, `registerView`, `addRibbonIcon`, `addSettingTab`) are called directly instead of being forwarded, and Obsidian awaits an async `onload()`, so the localization-then-settings-then-everything-else ordering above is expressed by plain `await` rather than by a readiness promise other code has to remember to wait on.

One small consequence to know when reading the source: the live settings object is reached through **`plugin.getSettings()`**, a method rather than a `settings` getter. Obsidian's own `Plugin` already declares a `settings` property, and overriding a property with an accessor is an error.

Everything downstream of `main.ts` takes settings as a `getSettings: () => APERtrailSettings` callback rather than a snapshot, so a settings change is picked up on the next render without anything having to be rewired.

## Source layout: three modules

`src/` is laid out in the same three modules the vault is, so a file's folder answers "which part of the product owns this" before you open it:

```
src/main.ts        the one Plugin subclass
src/lang/          I18nManager, the locale registry, plural forms, and
                   the en/de translation tables
src/settings/      types, defaults, validation, store, the settings tab shell
src/shared/        helpers with no module of their own: note creation, leaf
                   opening, the trail-core vault host, URL shortening,
                   sun-band.ts (a day's light as bands, drawn by two
                   surfaces), clock.ts and units.ts (the reader's own
                   conventions rather than the note's)
src/vault/         cross-module note reading and writing: entity-types.ts,
                   types.ts, read-entities.ts, create-entities.ts,
                   visit-derivation.ts, health/
src/trips/         the Trip half: trip-note.ts, itinerary-days.ts,
                   write-trip.ts, related-trips.ts, trip-light.ts,
                   trip-stats.ts, costs/ (booking notes, totals, the
                   split, the invoice adapter, line-cost, estimates,
                   booking-match, currency-options, the cost sheet), ui/
src/places/        everything a trip points at: photo-spot-note.ts,
                   photo-spot-view.ts, write-photo-spot.ts, solar.ts,
                   country-visited.ts, place-stats.ts, ui/
src/crm/           the CRM module: entity-types.ts, types.ts,
                   crm-note.ts, read-crm.ts, create-crm.ts,
                   crm-stats.ts, persons.ts, ui/
src/ui/            shared UI: components/, dashboard/, gallery/, settings/
```

The dependency direction is one-way and worth keeping that way: `shared/` knows about nothing, `vault/` knows about `shared/` and the two block-language constants it seeds into new notes, `trips/` and `places/` know about `vault/`, and `ui/` knows about all of them. Nothing under `vault/`, `trips/` or `places/` imports a view.

## Settings and validation

`APERtrailSettingsStore` (`src/settings/store.ts`) owns one `APERtrailSettings` object (`src/settings/types.ts`), a single flat interface persisted as one `data.json`. The store is deliberately thin: it calls `loadData()`, records whether anything came back, and hands the raw value to `mergeSettings()`.

`mergeSettings()` (`src/settings/validate.ts`) validates every field individually and falls back to the default for anything missing or of the wrong type, so a hand-edited or corrupt `data.json` can never put a non-string into a folder path. It is the only way a settings object is ever built, which is what lets the rest of the codebase treat every field as present and correctly typed.

Folder defaults come from `getLocalizedFolderDefaults()` (`src/settings/defaults.ts`) rather than the static table, so a first load in a German vault seeds German folder names instead of English ones that would then have to be renamed by hand. Every sub-folder is derived from its module root rather than being its own literal, which is what keeps each module relocatable as a unit; the resolver falls back to the static English literals when `I18nManager` is not initialized yet, which is the case in unit tests and in the first moments of load.

`getLocalizedFolderDefaults()` also takes the roots a saved `data.json` already carries, so a sub-folder setting added later lands under the **saved** module root rather than under the pristine default. The saved root is the vault owner's answer to "where does this module live", and that answer has to apply to sub-folders that did not exist when they gave it. `tests/settings.test.ts` pins that behaviour.

The store exposes `isFreshInstall`, set when `loadData()` returned `null` (no file) or `{}` (an interrupted first write). Nothing acts on it today; it is there for whatever first-run experience gets built.

## Data flow: read and derive on every render

There is no index, no cache and no persisted travel data. Every view, block and stat is a **read-time projection** over the vault:

```
app.vault.getMarkdownFiles()
  -> filter by folder AND type          (trail-core's readNotesOfType)
  -> read frontmatter defensively        (trail-core's findValue and value readers)
  -> resolve wikilinks by title          (two passes for Country/State/City)
  -> derive visited/lastVisit            (vault/visit-derivation.ts)
  -> derive effective travel status      (trips/trip-note.ts)
  = TravelBoard                          (vault/types.ts)
```

`readTravelBoard()` is the single entry point, and the dashboard, the gallery, the itinerary block and the related-trips block all call it. It takes `today` as a parameter (defaulting to the real clock) so the date-derived status fallback is deterministic under test.

The pure half of the model is deliberately kept free of `obsidian` imports so it can be unit-tested without mocking `App`: `trips/trip-note.ts` (build and parse Trip frontmatter), `trips/itinerary-days.ts` (grouping stops into days), `trips/related-trips.ts`, `trips/trip-light.ts`, `vault/visit-derivation.ts`, `trips/trip-stats.ts`, `places/place-stats.ts`, `ui/dashboard/travel-dashboard-sort.ts`, `places/country-visited.ts`, `places/photo-spot-note.ts`, `places/solar.ts`, `crm/crm-note.ts` and the whole of `trips/costs/` bar its two `ui/` neighbours (`booking-note.ts`, `totals.ts`, `split.ts`, `line-cost.ts`, `estimates.ts`, `booking-match.ts`, `currency-options.ts`, `invoice-model.ts`, `export-trip-costs.ts`) all take plain data. The `App`-dependent wrappers sit beside them: `vault/read-entities.ts`, `vault/create-entities.ts`, `trips/write-trip.ts`, `places/write-photo-spot.ts`.

Writes are the mirror image. Creation of the eight non-Trip travel types goes through `vault/create-entities.ts` on top of trail-core's `ensureFolder()` and `createNote()` (which refuses to overwrite an existing path, throwing `NoteExistsError`), its Obsidian adapter's `renderFrontmatterBlock()` and its `frontmatterObject()`, which decides the key order. `shared/note-creation.ts` is the App-to-host delegation for the two vault calls; `shared/vault-host.ts` builds the ports. Editing is the part that needs its own code, and only two entities have an edit path: `trips/write-trip.ts` and `places/write-photo-spot.ts`. Both carry a requirement creation does not have, never clobber the note body, and clear only the keys that entity's schema owns, so each is one save path rather than a set of field-level writes.

## Views

Four `ItemView`s: the three dashboards (`apertrail-dashboard-view`, `apertrail-places-dashboard-view`, `apertrail-crm-dashboard-view`) and `apertrail-gallery-view`.

All four follow the **singleton-leaf** pattern via `findOrOpenLeaf()` (`src/shared/open-leaf.ts`): opening the dashboard or gallery a second time reveals the existing leaf rather than opening a duplicate. The gallery's optional type filter and search query are applied to whichever leaf comes back, which is how the dashboard's "Browse all" footers and its search box both land in one gallery.

All four are **manual-refresh only** and hold no `metadataCache` subscription. They redraw on open, on the dashboard's Refresh button, and when `refreshAllViews()` is called after a creation modal writes a note. Travel notes do not change often enough to justify a live subscription, and the cost of the choice is visible rather than subtle: the pixels can be stale, the data never is.

The ribbon icon is built **once**, at load, and shown or hidden by toggling an `apt-ribbon-hidden` class on every settings save. Obsidian has no `removeRibbonIcon()`, so the alternative would be holding the element and detaching it by hand, which is the same thing with more ways to leak.

## Code-block processors

Four fenced-code-block languages are registered in `onload()`:

| Language | Rendered in | File |
|---|---|---|
| `travel-itinerary` | A Trip note | `src/trips/ui/itinerary-block.ts` |
| `travel-related-trips` | A City or place note | `src/trips/ui/related-trips-block.ts` |
| `apt-photo-spot` | A Photo spot note | `src/places/ui/photo-spot-block.ts` |
| `apt-trip-costs` | A Trip note | `src/trips/ui/trip-costs-block.ts` |

**The first two names keep the `travel-` prefix on purpose.** They are written into the user's own trip and place notes, by the plugin and by hand, and renaming them would orphan every block that already exists, turning it back into an unrendered code fence. That argument only protects strings that are already in someone's vault, so every block added since takes the `apt-` prefix instead, starting with `apt-photo-spot`.

Each language's constant lives outside the UI module that renders it, because `vault/create-entities.ts`, `trips/write-trip.ts` and `places/write-photo-spot.ts` seed these blocks into new notes and the writers must not depend on `ui/` (`trips/related-trips-block-lang.ts`, `places/photo-spot-block-lang.ts`, and `TRAVEL_ITINERARY_BLOCK_LANG` in `trips/write-trip.ts`).

No block takes arguments. All three work out what to render from the rendering context's own file path, so a block is copy-pasteable between notes of the same kind and cannot be pointed at the wrong note.

The itinerary block is also an **editing surface**, not just a renderer, and is registered as a `MarkdownRenderChild` through `ctx.addChild()` so it can subscribe to `metadataCache.on('changed')` for its own path and clean up after itself. It has to listen for the metadata event rather than redraw when its own save resolves: `processFrontMatter()` resolves once the file is written, but `metadataCache` catches up asynchronously afterwards, so a redraw fired from the write's own continuation reads the frontmatter as it was before the edit. Every mutation it makes takes the whole trip as a `TripInput`, changes one item, and writes the whole thing back through `updateTripNote()`, so there is exactly one save path and no partial write.

## Internationalization

`I18nManager` (`src/lang/I18nManager.ts`) is initialized before anything else in `onload()`, so every synchronous UI-building call to `t()` already has a catalogue. Its one exception is the saved `language` setting, which `onload()` reads raw from `loadData()` beforehand: the settings store resolves LOCALIZED folder defaults and so cannot run first, and a vault seeded with folder names in the wrong language cannot rename them by itself afterwards.

A language exists in exactly one place, the registry in `src/lang/translations/index.ts`, which carries a locale's code, native name, direction and table together. `en.ts` and `de.ts` ship today. English is the base in both senses: at runtime every missing key falls back to it key by key, and at compile time its inferred shape IS the `Translations` type the other tables are measured against, which is why `en.ts` is the one table with no type annotation. German is typed complete; a community table is a deep-partial, so a translation covering most of the UI can ship rather than failing the build.

Counted strings carry the plural categories their language has and are selected with `Intl.PluralRules`, so a call site passes a `count` and says nothing about grammar.

Keys carry no top-level namespace: the dashboard's headings are `dashboard.x`, the settings tab's are `settings.x`. `tests/translation-keys.test.ts` is the guard on the whole system: it statically scans `src/` for literal `t('...')` calls, checks every key against both tables, and asserts the two tables are structurally identical. That guard exists because a missing key is otherwise silent, `t()` falls back to returning the key itself and the typechecker only ever sees an untyped string. Keys built by interpolation at their call sites are enumerated by hand in that test, which is the price of building a key name at runtime.

Every user-facing string and every default folder name is routed through this system or through a settings field with a translated default.

## CSS

One stylesheet, `styles.css`, and one class prefix: **`apt-`**. Every class the plugin adds carries it, so a rule in a user's own snippet can target the plugin's markup without guessing and the plugin's rules cannot collide with a theme's.

The conventions that come with it, from `CLAUDE.md`:

- No direct `element.style.x = ...`. CSS classes toggled with `addClass`/`removeClass`/`toggleClass` for binary states, Obsidian's `setCssProps()` only for genuinely dynamic runtime values.
- No `innerHTML`/`outerHTML`. DOM is built with `createEl`/`createDiv`/`createSpan`/`empty()`, or `.textContent` for plain text.
- Modals extend the shared `BaseModal` (`src/ui/components/modal-shell.ts`), which owns the sticky header, scrollable body and sticky footer; concrete modals implement `getTitle()`, `renderBody()` and `renderFooter()` and never touch `contentEl`. Footer buttons are right-aligned, Cancel before the primary action, and the primary action gets Obsidian's `mod-cta` rather than custom colour CSS. Five modal families predate that shell and still extend Obsidian's `Modal` directly (the Trip editor, the itinerary item editors, the photo spot item editors, the place picker and the health-check review modal); converting them is outstanding work, not a decision.
