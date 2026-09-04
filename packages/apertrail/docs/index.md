# APERtrail documentation

**Open the perfect path.** APERtrail is an Obsidian plugin (TypeScript, built with esbuild) for planning and recording travel as plain Markdown notes: trips, a Country/State/City geographic hierarchy, and five kinds of reusable place note (accommodation, food & beverages, landmarks, locations, photo spots), browsed through one combined gallery and summarized on a dashboard per module.

The positioning is *the first dedicated travel planner for photography: map journeys that rotate around vantage points, light, and perspective*. As of the photo spot type that is no longer only a direction: a spot carries its motifs, the light each one wants and the shooting bearing, and the plugin resolves those to real clock times from an offline sun calculation, prefills a trip stop from the golden hour and warns when two stops cannot both happen. See [Photo spots](features/travel.md#photo-spots).

APERtrail reads and writes ordinary Markdown notes with YAML frontmatter, and **the notes in your vault are always the source of truth**. The plugin persists no travel data of its own: everything the dashboard, gallery and code blocks show is derived from the vault on every render, so hand-editing a note is always safe and there is no index that can fall out of sync. See [Data model & note conventions](design/data-model.md).

## How APERtrail is organized

Both the vault layout and the plugin's own `src/` tree are split into three modules, so the plugin can grow one module at a time rather than as one flat surface:

```
Trips/                      one note per trip
Places/                     everything a trip can point at
  Countries/ States/ Cities/
  Accommodation/ Food & Beverages/ Landmarks/ Locations/ Photo Spots/
CRM/
  People/ Companies/
```

| Module | State today |
|---|---|
| **Trips** (`src/trips/`) | Shipped. The trip note, its itinerary of stops, nights and transport legs, the `travel-itinerary` and `travel-related-trips` blocks, and the light-aware planning built on photo spots |
| **Places** (`src/places/`) | Shipped. Countries, states and cities, the four other reusable place types, photo spots with motifs, the offline sun calculation and the `apt-photo-spot` block |
| **CRM** (`src/crm/`) | Shipped. Person and Company notes read out of `CRM/People` and `CRM/Companies`, created from the plugin, browsed on their own dashboard and in the gallery, with a related-trips block answering which trips a person came along on. Both type values are settings rather than fixed words, so these stay folders your vault already owned |

Everything that is neither module-specific nor App-free sits alongside them: `src/vault/` reads and writes notes across modules, `src/shared/` holds helpers with no Obsidian `App` dependency, `src/ui/` the dashboard shell and nav, gallery, settings tab and shared components, with each module owning its own dashboard view. Order handling is a candidate for a fourth module later; nothing in the code anticipates it yet.

The three module folders sit at the vault root by default, which is the shape the [sample vault](design/sample-vault.md) ships in. An optional common parent (`rootFolder`) moves all three together if you would rather keep them under, say, `4 Resources/Travel`.

The docs are organized by question rather than by module: [Travel](features/travel.md) for what each feature does, [Data model & note conventions](design/data-model.md) for what the notes look like on disk, [Settings reference](design/settings-reference.md) for every setting in the order the settings tab presents it, and [Architecture](design/architecture.md) for how the source tree fits together.

## Where to start

| If you want to... | Read |
|---|---|
| Install the plugin, or try it on the sample vault | [Installation](installation.md) |
| Get a walkthrough from an empty vault to a planned trip | [Usage](usage.md) |
| Understand trips, countries, places, the gallery, the dashboard and the health check in full | [Travel](features/travel.md) |
| See how the plugin is put together internally | [Architecture](design/architecture.md) |
| Understand the frontmatter and note conventions APERtrail relies on | [Data model & note conventions](design/data-model.md) |
| See every setting, grouped the way the settings tab groups them | [Settings reference](design/settings-reference.md) |
| Understand the build, lint and test setup | [Testing & development](design/testing-and-development.md) |
| Read the design plan the travel features were built from | [Travel module: design & implementation plan](design/travel-module-plan.md) |
| Read the Trip model design that produced today's trip schema | [Trip model redesign](design/trip-model-redesign.md) |
| Read why there are three dashboards rather than one, and how CRM came to be a module | [Dashboard split & CRM](design/dashboard-split-and-crm.md) |
| See how the sample vault is built and what the plugin reads from it | [Sample vault](design/sample-vault.md) |
| Understand photo spots, motifs, sun times and the light-aware itinerary | [Photo spots](design/photo-spots.md) |
| Copy a starting template for a Trip, Country, State, City, place, Person or Company note | [Templates](templates/index.md) |

## At a glance

- **Version:** 0.1.0 (`manifest.json`)
- **Minimum Obsidian version:** 1.12.0
- **Platforms:** desktop and mobile (`isDesktopOnly: false`)
- **Languages:** English and German out of the box, detected from Obsidian's own language setting, with every folder name and frontmatter property name configurable in Settings
- **License:** PolyForm Noncommercial License 1.0.0

## Documentation conventions used in these docs

Folder names shown in examples (`Trips`, `Places/Countries`, `CRM/People`, ...) are the default **English** locale folder names from `src/settings/defaults.ts` and `src/lang/translations/en.ts`. A German-locale vault seeds the German defaults instead (`Reisen`, `Orte/Länder`, `CRM/Personen`, ...). Every one of these paths is a plugin setting, not a hardcoded path, so any vault can rename them freely without breaking anything.

Every page here describes what is actually in `src/` today. The three design documents, [Travel module: design & implementation plan](design/travel-module-plan.md), [Trip model redesign](design/trip-model-redesign.md) and [Dashboard split & CRM](design/dashboard-split-and-crm.md), are the reasoning behind the shape the code took rather than a walkthrough of it, and they describe a before and an after: a file named in one of them may no longer exist under that name. [Sample vault](design/sample-vault.md) describes a vault rather than the plugin, and that vault is not in this repository. Each says so in its own status header.
