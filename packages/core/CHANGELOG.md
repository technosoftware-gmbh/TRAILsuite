# Changelog

All notable changes to `@technosoftware/trail-core` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

Two conventions specific to this package are worth stating, because they decide
what counts as a breaking change:

- **A note format is part of the public surface.** Changing what
  `plan`, `order`, `delivery`, `meal` or `reheating` will read out of a note
  already in a vault is a breaking change even when no exported signature moves,
  because the notes go on existing after the release that stopped reading them.
- **The settings contracts are the strictest of the lot.** Changing one of
  `CRM_CONTRACT`'s nine values breaks all three plugins at once and silently:
  the failure mode of a type value that no longer matches is an empty list
  rather than an error. `ORDER_CONTRACT` is the same promise for the six
  settings NODAtrail uses to read an order note CULItrail wrote, where the
  failure mode is quieter still: an order read without its price.

## [Unreleased]

## [1.1.0] - 2026-09-05

The first version published to npm, and the first under the scoped name.

### Changed

- **The package is now `@technosoftware/trail-core`.** Breaking for anybody
  depending on it by name, which today is the three plugins in this repository
  and nothing else. Scoped rather than unscoped so that ownership is stated in
  the name: this is published from an organization account, and a short generic
  name on a public registry says nothing about who stands behind it.

### Added

- **`settings/order-contract.ts`**: the six settings NODAtrail uses to find and
  read the order notes CULItrail writes -- the folder, the type value, and the
  company, date, price and currency property names. They were spelled out in
  both plugins' defaults with nothing comparing them, so renaming one on either
  side left both suites green and reached a person as a ledger reading every
  order as unpriced. Modelled on `CRM_CONTRACT`, and asymmetric where that one
  is not: orders have one author, so these are CULItrail's answers and the
  other side copies them.

## [1.0.0] - 2026-09-04

The first public release. The library is unchanged in substance from what
the three plugins have been building against; what changed is that it is now
readable by anybody, and that the version number says so.

### Added

- **`tasks/comment.ts`**: a note under a task, for why it was closed the way it
  was. The checkbox line is never touched -- the comment is indented lines
  beneath it, ordinary Markdown that the Tasks plugin, Dataview and every other
  reader of the same vault ignore. That shape is the point: the line is not a
  format this codebase owns, and a field of our own invention appended to it
  would show as part of the task's description everywhere else in the vault. A
  nested task ends the block rather than joining it, so a sub-task can never be
  read as its parent's comment and written back as prose.

- **`fulfilment/outstanding.ts`**: ordered minus delivered, as one kernel.
  Two features ask the identical question -- a meal order settled by boxes, and a
  purchase that ships in parts -- and `delivery/from-orders.ts` is an adapter
  over it now rather than a second copy. Nothing about either note format
  changed; the older file's own suite is what proves the move safe, and it
  caught a behaviour dropped in the extraction on the first run.
- **`expense/purchase-delivery.ts`**: the `deliveries:` list a purchase note
  carries when it arrived in more than one box, and the derived delivered /
  partly / ordered status over it. `returned` and `cancelled` are decisions and
  are never derived.

- `markdown/summary-block.ts`: the summary block a note opens with, a `---`
  rule and a `> [!SUMMARY]+` callout treated as one span. It was written down
  twice, in NODAtrail's PARA notes and APERtrail's trips, and one vault holds
  both -- a summary that looked different depending on which plugin wrote the
  note would have been two conventions for one idea. **A note format belongs
  here whatever the number of readers**, so this was settled by the promotion
  rule and held up only by the relicensing, which the copyright holder granted.
  `NOTICE.md` records the check.

  It is a note format, so it is part of this package's public surface in the
  strict sense above: changing what it will read out of a note already in a
  vault is breaking.
- `document`, a format-agnostic invoice model: a counterparty, a row of facts,
  an optional-column table, a totals block and a grouped footer. It was
  CULItrail's order view, and it moved here when the delivery note turned out to
  be the same document without the money. `obsidian/renderInvoice` builds the
  DOM for one and knows nothing else -- no app, no settings, no idea what the
  document is about.

### Changed

- **`tsconfig.json` loads the DOM lib.** `src/obsidian/` builds elements now, and
  Obsidian's own typings augment `HTMLElement` rather than declaring it. The lib
  is per-package, so the pure half gets a `no-restricted-globals` rule to keep
  the compiler's old objection: `document`, `window`, `navigator` and
  `localStorage` are lint errors outside `src/obsidian/`, alongside the check
  `tests/obsidian-free.test.ts` already made.

### Added

- **`calendar/`: an iCalendar reader, a recurrence expander and an import
  plan.** ICS is RFC 5545, a public interchange format rather than one
  product's model of one, which is the same argument this package makes for a
  note format and for a solar solve.

  **It rests on the format argument alone, and that is worth pinning down.**
  The two-consumer test was *not* met: APERtrail could plausibly want a trip's
  dates out of an ICS one day, CULItrail has no use for it, and today there is
  exactly one consumer. The promotion was granted because a format is a
  statement about a file rather than a product's model of it. If a second
  consumer never appears, the decision still stands on that.

  `ics.ts` reads a file and stops: folded lines, escaped values, parameters
  whose quoted values may contain a colon, `VALUE=DATE` all-day moments that
  get no time rather than midnight, and the attendees with their `PARTSTAT`.
  `lastDayOf` answers what a stated end really means -- an all-day `DTEND` is
  exclusive, and a timed end at exactly midnight belongs to the day before.

  `recurrence.ts` turns an `RRULE` into the days it lands on. **Tested rather
  than generated**: it walks the days from `DTSTART` and asks the rule about
  each one, which is slower and obviously correct, and it is where an engine of
  this kind otherwise grows its long tail. A rule part it does not implement
  comes back in `unsupported` and is never approximated -- dropping a
  `BYSETPOS` and expanding the rest yields four plausible wrong dates in place
  of one right one, and wrong is the failure nobody notices. `truncated` says a
  walk gave up, which is a different thing from a series with nothing in range.

  `import-plan.ts` decides six statuses per line and writes nothing, the way
  `ledger/import-plan.ts` does not. `meetingKey` derives a line's identity from
  the day, the time and the text -- the three things a person reading the note
  can see -- so nothing is written into a vault that was not going to be
  written anyway.

  All of it is app-free and clock-free. The dates are calendar arithmetic
  rather than millisecond arithmetic throughout, and the package's own suite is
  now pinned to `Europe/Zurich` for the reason NODAtrail's already was: in UTC
  the whole class of day-stepping bug cannot happen, so a green suite would
  prove nothing about the machines this ships to.

### Fixed

- **`IcsParameters` said its keys were lower-cased and `parseLine` upper-cases
  them.** Written down here because the comment is what caused the bug rather
  than what described it: reading `parameters['partstat']` returned empty, every
  attendee parsed as having given no answer, and the RFC-correct fallback then
  turned that into `NEEDS-ACTION` -- so the first test agreed with the bug and
  only a `DECLINED` case caught it. The comment now says what the code does and
  says why it matters.

## [0.1.0] - unreleased

The first version, extracted from the two plugins that preceded it rather than
written new. Not tagged and not published: the whole suite sits at 0.1.0 and no
release has been cut.

### Added

- `crm`, the Person and Company note format, its property names, field reading
  and frontmatter tag matching.
- `dates`, local-calendar arithmetic: day titles, ISO weeks, months, quarters,
  years, minute-precision stamps, locale display and day distance.
- `delivery`, the delivery note format and the outstanding-items arithmetic that
  turns orders into what is still owed.
- `frontmatter`, defensive readers for hand-edited YAML, block splitting,
  created and modified stamps, and single-property writes.
- `geo`, coordinate parsing, haversine distance, bearing and compass point.
- `links`, wikilink reading and writing in strict and lenient flavours.
- `markdown`, a clean-room heading and list parser for a note body.
- `meal`, the editable shape of a meal note, the nutrient vocabulary and the
  per-100 g model behind it, nutrition conversion and supplier rules.
- `obsidian`, the one Obsidian adapter, behind the `trail-core/obsidian` subpath
  export and reachable no other way.
- `order`, the order note format, its filename, and what an order comes to.
- `paths`, vault path strings with their own `normalizePath` rather than
  Obsidian's.
- `plan`, the meal-plan note format: the line, the weekday sections, and what a
  week's note is called.
- `reheating`, per-appliance reheating instructions and the dish-versus-supplier
  merge.
- `settings`, holding `CRM_CONTRACT` and `crmContractMismatches()`.
- `solar`, NOAA solar position and rise and set times, iterated rather than
  approximated.
- `vault`, the ports, note creation and stamping, and `readNotesOfType()`.
- `tests/obsidian-free.test.ts`, which reads the source rather than trusting the
  lint run, so the one rule this package exists on cannot be silenced by the
  same edit that breaks it.
