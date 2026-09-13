# Changelog

All notable changes to NODAtrail are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**What counts as a breaking change here is what happens to a vault**, not what
happens to a signature. Renaming a default property name, changing a `type:`
value, or changing what a reader will accept out of a note somebody already has
is breaking, because nothing migrates a vault automatically and a property no
note carries is not an error. See
[Data model](docs/design/data-model.md) for the note formats this promise covers.

`npm version` runs `sync-version.js`, which copies `package.json`'s version into
`manifest.json`, so the two cannot drift.

## [Unreleased]

### Changed

- **A kept import file now lives in `_imports`, not in `_documents`.** Both the
  calendar's `.ics` and the ledger's statement `.csv` are filed under the new
  `importSubfolder` setting, beside the notes they fed. An invoice is a document
  somebody filed and looks at; an export is the source a run worked from and a
  file the plugin recognises by name and reads back. One folder should not be
  both.
- **And it is named for the run rather than for the range:**
  `20260913-142530_business_20260907-20260913.ics`, and
  `20260913-142530_1013_20260401-20260626.csv`. An imports folder is a history
  of runs and now sorts as one. The source and the range stay in the name
  because the calendar's "gone from the export" list and the ledger's unposted
  count are replayed from them and from nothing else.
- The calendar import reads its history in the order the runs happened rather
  than in the order of the ranges chosen. A week backfilled today is the later
  word about those days than a range imported a fortnight ago, which is what
  "later runs win" always meant and what nothing in the vault could say until
  the name carried a stamp.

### Added

- `importSubfolder`, default `_imports`. Blank keeps nothing, the same reading
  `documentSubfolder` has, and costs both replays.
- Command **Move imported files into the imports folder**, for a vault that
  imported under the old scheme. It previews every move, renames rather than
  copies so links follow, touches no note, and is safe to run twice. It also
  picks up the numbered second exports (`... 2.ics`) that the old reader's own
  pattern never matched and that have been sitting unread since they were
  written.

### Migration

Existing archived imports are **not** moved on load. Until the command is run
they stay in `_documents` and are no longer read, which means the calendar
import offers no missing-meeting list and the ledger shows no kept statements.
Both come back as soon as the files are moved.