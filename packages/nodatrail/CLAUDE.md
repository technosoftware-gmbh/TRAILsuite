# NODAtrail - working notes for Claude Code

Obsidian plugin (TypeScript, esbuild). "Map your mind": a life OS built on PARA,
plus the money that belongs to neither a trip nor a meal.

Four areas, mirrored in the vault and in `src/`:

- **Plan** - the day, week, month, quarter and year notes, and the day-note
  dialog that captures tasks, meetings, notes and ideas into them. The
  navigation block those notes used to open with is retired; the plan view is
  what moves between periods now.
- **PARA** - areas, goals, projects, resources, the archive, and the tasks
  written inside all of them. **Goals are an addition to PARA rather than part
  of it**, as is the planning root the periodic notes sit under, so a vault here
  carries more top-level folders than the method names. A goal sits between an
  area and the projects that serve it, which is what lets a project's area be
  derived instead of typed.
- **Finance** - purchases, bills, recurring costs and budgets.
- **Ledger** - accounts, postings, the monthly journal notes they live in, the
  statement import and the matching around it. Its notes file under the Finance
  root in the vault, and it has its own directory, view and commands in `src/`.

This is a clean-room implementation. It carries no Recipe Box code and no
CULItrail code: CULItrail is GPL and this package is PolyForm, so a mechanism
may be followed and a file may not be copied. See `NOTICE.md`.

License: PolyForm Noncommercial License 1.0.0.

## Build

- `npm run dev` - watch build
- `npm run build` - typecheck + production build
- `npm run lint` / `npm run lint:fix`
- `npm run test` - unit tests

`npm run lint` is expected to pass with zero errors. Keep it that way.

**`npm test` and `npm run build` need the Linux platform bindings** when run
anywhere other than the Mac they were installed on. This is APERtrail's note,
and it applies identically here:

```
npm i --no-save --force @rolldown/binding-linux-arm64-gnu@<rolldown version>
npm i --no-save --force @esbuild/linux-arm64@<esbuild version>
```

**The smoke suite runs against a real vault** and skips without one:

```
NODATRAIL_VAULT=/path/to/Vault npm test
```

It reads and asserts and writes nothing. It is what catches a reader that works
against invented frontmatter and not against the shapes a vault actually holds.

## Naming conventions

- **Settings keys carry no prefix.** `areasFolder`, not `paraAreasFolder`. The
  module a setting belongs to is expressed by the settings page's grouping. The
  `purchase*`, `bill*`, `recurring*` and `budget*` prefixes that do appear are
  note-type qualifiers rather than module ones: four notes each carry a
  `company` and an `amount`, and one key cannot name all four.
- **CSS classes all use one `nod-` prefix**, including anything a module
  contributes. `tests/stylesheet.test.ts` fails on a class with no rule and on a
  rule nothing sets.
- **The suite's UI conventions are one document, `docs/ui-conventions.md`**, and
  its section 7 is written for the Life Dashboard specifically. This is the least
  built of the three dashboards and therefore the one with the least to unlearn:
  the card grid and a card's fixed height are cheaper to decide now than to
  retrofit.
- **Translation keys have no top-level namespace.** `dashboard.x`, not
  `para.dashboard.x`.
- **Every fence language takes `nod-`, with one stated exception.** The
  argument that protected `travel-itinerary` in APERtrail only ever applied to
  strings already in somebody's vault, and none of the six named here was. The
  seventh is **`noda-journal`**, and it keeps that spelling because the name is
  not this plugin's to choose: the parser is `trail-core`'s and the fence is
  written into notes this plugin creates. It is spelled once, as
  `JOURNAL_LANGUAGE`, and renaming it would orphan every journal block already
  on disk.
- **The plugin's settings are reached via `plugin.getSettings()`**, not a
  `settings` getter: Obsidian's own `Plugin` declares a `settings` member, and
  overriding a property with an accessor is a type error.

## Code conventions

Identical to APERtrail's, and worth keeping identical so code can move between
them without reformatting:

- **Comment generously, but for reasoning, not mechanics.** Why this approach
  over a simpler one, what edge case a check guards, what a bug fix was fixing.
  Never restate what the next line obviously does.
- **History belongs in git, not in comments.**
- **Small, single-purpose files.**
- **File headers.** Every `.ts` file opens with a short JSDoc: what it is
  responsible for and any non-obvious constraint. No revision history.
- **No em dashes** anywhere shipped. `tests/no-em-dash.test.ts` enforces it;
  this file is exempt because it is not shipped.
- **Frontmatter access goes through typed helpers, never raw casts.**
  `frontmatterOf()` in `shared/vault-host.ts`, then `trail-core`'s readers.
- **Frontmatter property names are always settings**, never a literal in logic.
  There are no exceptions here, unlike APERtrail's three.
- **Promise handling:** never a bare `async () => {}` as a DOM or Obsidian
  callback. Make the callback sync and `void` the call inside it.
- **Styling:** no `element.style.x = ...`. Classes toggled with
  `addClass`/`toggleClass`.
- **No `console.log`, no `innerHTML`.**
- **Every new user-facing string goes in both `en.ts` and `de.ts`.**
  `tests/translation-keys.test.ts` fails otherwise. A key built at runtime goes
  in that test's `DYNAMIC_KEYS` list, which is the point rather than a
  workaround: a dynamic key is the one that fails silently in the other
  language.

## Architecture notes

```
src/main.ts       the one Plugin subclass: settings, six views, the commands,
                  seven code-block processors, the ribbon icon
src/lang/         I18nManager, the locale registry, plural forms, en and de
src/settings/     types, defaults, validate, store, links, the settings page,
                  and the one-time adoption from a sibling plugin
src/shared/       clock, categories, note-creation, note-stamps, open-leaf,
                  rates, vault-host
src/vault/        cross-module reading and writing: entity-types, read-notes,
                  create-note, health/
src/plan/         paths, detect, nav-block, labels, write-period, rollup,
                  read-day, read-schedule, day-body, defer-menu, and add-to-day
                  with its dialog
src/para/         types, parse, write, properties, board, read-para, create,
                  edit-para, archive, project-folder, project-tasks,
                  status-dates, status-groups, summary and summary-file,
                  image-file
src/finance/      properties, read-finance, write-finance, edit-finance,
                  edit-money, spend, paths, finance-title, settle-bill,
                  default-chart, document-file, file-document, read-orders
src/ledger/       the double-entry half: properties, read-ledger, write-ledger,
                  journal-text, account-field, budget-month, seed-chart, the
                  statement import (import-modal, import-write) and the posting,
                  split and opening-balance dialogs
src/crm/          company-defaults, read-persons, read-crm-board, and the
                  new/edit Person and Company modals
src/tasks/        read-tasks, write-tasks
src/types/        ambient declarations only (markdown.d.ts)
src/ui/           kit/, views/, modals/, blocks/, settings/, components/
```

- **A module owns what only it needs.** Anything two modules read or write
  belongs in `src/vault/`; anything needing no `App` at all belongs in
  `src/shared/` or, if it is a statement about a file rather than about this
  plugin, in `trail-core`.
- **Notes are identified by folder AND type together**, through
  `trail-core`'s `readNotesOfType()`. A blank folder matches nothing and a blank
  type value matches nothing, which is what makes an unconfigured setting fail
  safe rather than fail wide.
- **Archiving is a move, not a flag.** `6 Archive/<Category>/` plus an
  `archived:` stamp, with the `type` unchanged. The active readers stop seeing
  the note because they read a different folder, so no view needs a special
  case and none can forget to apply one. `readAllNotes` exists and is a separate
  function from `readNotes` precisely so no caller includes the archive by
  accident.
- **Nothing is cached.** Every view re-reads on render. The views hold no
  `metadataCache` subscription: they redraw on open, on an explicit refresh, and
  after a modal writes a note. The data is never stale; the pixels can be.
- **A project's area is derived through its goals and never written back.** An
  explicit `area:` wins where a project serves no goal. Moving a goal to another
  area therefore re-files every project under it without touching a project
  note.
- **A bill's status is derived and only `cancelled` is stored**, because that is
  the one state no date can express.
- **A recurring cost projects occurrences and never writes a bill note.**
  Turning one occurrence into a bill is a command somebody runs, having looked
  at it. A plugin that wrote twelve notes a year while nobody was watching is a
  plugin whose owner stops trusting the folder.
- **Money has three rules here, and they are `trail-core`'s.** A total over
  unpriced lines is null, never zero. Currencies are never summed together. And
  nothing derived is written back: variances and projections are recomputed on
  every render.
- **The stated total wins over the computed one, always.** A purchase note is a
  record of what was charged. The computed figure is what the health check
  compares against; it is not what a budget spends.
- **`created` is written once, `modified` on every edit**, and both property
  names are settings whose blank value means "do not write that stamp". Reading
  is lenient across four shapes (`trail-core`'s `readStamp`), writing is only
  ever the suite's. A note converts the first time NODAtrail writes to it and
  never before: that is the only way this vault becomes consistent without a day
  on which every note in it acquires a new modification date.
- **The folder seeding prefers a folder the vault already has.** A localised
  default that is absent, beside an English one that is present, resolves to the
  English one. Without that rule a German-locale install into this vault would
  seed `1 Bereiche` beside a folder called `1 Areas` and find nothing while
  looking perfectly configured.
- **Adoption from a sibling runs once, on a fresh install, and reads a file
  rather than a plugin.** It adopts names and locations only, never a behaviour
  toggle. A value changed in APERtrail later does not propagate here, and that is
  the usual reason two of these plugins disagree in a long-lived vault.
- **The health check reports, and offers a fix only where it already holds the
  whole answer.** That is true of a note's type, because the folder states it,
  and of a stamp in an older shape, because the moment is already written and
  converting it re-spells what is there rather than moving it. Both can be
  applied in bulk. The reasoning that once ruled bulk out was that a mass
  rewrite would give every note a new modification date, and that turned out to
  be false for exactly these two cases. Nothing else is fixable at all, and no
  fix ever guesses.

## What NODAtrail deliberately does not do

Stated so it does not get built by accident:

- It does not offer a single total-spending figure across all three plugins.
  That was considered and left out: it would couple three plugins through the
  vault to answer a question each already answers about its own domain. **What
  it does do is narrower and is not the same thing.** It reads CULItrail's
  *order notes* for four facts, company, date, price and number, so an imported
  card charge can be matched to the order that caused it instead of being typed
  in twice. The note format is `trail-core`'s, the reader is this plugin's
  (`finance/read-orders.ts`), and nothing is imported from CULItrail, which is
  what keeps a PolyForm package clear of a GPL one. APERtrail's booking notes
  are not read yet.
- It does not manage tasks. It reads the Obsidian Tasks line format and can tick
  one box. Recurrence, dependencies and the query language stay there.
- It does not touch `5 Notes`, which is a free note store rather than a PARA
  category.
- It migrates nothing on its own. Nothing is rewritten because a plugin loaded
  or a version changed: the wrong quarter type, the older stamp spellings and
  the broken German image paths are reported first, and only ever fixed by
  somebody who ran the check and looked at what it found.
- It fetches nothing from the network. No exchange rates, no bank feeds.

**People are read, never owned**, the same arrangement the other two keep.
`crm/read-persons.ts` reads Person notes out of `personsFolder` by
`personTypeValue` and narrows them with `eligiblePersonTags`, and the New
account dialog offers the result as the account's owner. The list is read when
the form opens rather than held, so a person added a minute ago is offered.

**An empty filter admits everyone, never nobody.** `filterByTags` answers that
case itself, which is why the reader has no early return for it.

**`seed-chart.ts` deliberately keeps free text.** Its two fields are
`{person1}`/`{person2}` tokens that name accounts and groups as well as deciding
which entries get a `person:` link, so seeding with a generic name, or with a
name that has no Person note behind it, has to stay possible. Two jobs that
share a string; only the second is a CRM link.

## When unsure

Ask before guessing on anything touching: settings shape and naming, how two
features should relate, whether something is a bug or deliberate, and above all
anything that changes what gets written into a user's notes.
