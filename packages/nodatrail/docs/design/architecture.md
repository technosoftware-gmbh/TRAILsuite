# NODAtrail: design and implementation

**Status: as built, 29 August 2026.** This describes what the code does today.
The full frontmatter reference is [`data-model.md`](data-model.md); this is the
reasoning behind it.

NODAtrail is the third TRAILsuite plugin, and the one the brand folder carried
artwork for from the beginning. It covers two things that have nothing to do
with a trip or a meal:

1. **PARA.** Projects, Areas, Resources and Archive, plus the Goals layer this
   suite's reference vault puts between an Area and a Project, plus the periodic
   Plan notes, plus the tasks written inside all of them.
2. **The money that belongs to neither sibling.** A meal order is CULItrail's
   and a flight is APERtrail's booking. The insurance premium, the online order
   and the tax bill were nobody's.

| | |
|---|---|
| Package | `packages/nodatrail` |
| Plugin id | `nodatrail` |
| Licence | PolyForm Noncommercial License 1.0.0, the same as APERtrail |
| Lineage | Clean room. No Recipe Box code, and no CULItrail code, which is GPL and cannot flow into a PolyForm package |
| CSS prefix | `nod-` |
| Fence languages | `nod-*`, all six, plus `noda-journal` |

---

## 1. Five modules

Mirrored in the vault and in `src/`, the way APERtrail's three are.

```
src/plan/       the periodic notes and the day note written into them
src/para/       areas, goals, projects, resources, the archive
src/tasks/      the checkbox lines in all of the above, which are PARA's
src/finance/    purchases, bills, recurring costs, budgets
src/ledger/     accounts, postings, the monthly journals, the statement import
src/crm/        the Person and Company notes all three plugins share
```

Six directories and five modules: `src/tasks/` is PARA's, and is a directory of
its own only because the format it parses is not this suite's.

Anything two of them need is `src/vault/`; anything needing no `App` is
`src/shared/`; anything that is a statement about a file rather than about this
plugin went further out still, into `trail-core`. Section 5 is that argument.

### 1.1 Folder defaults, and the seeding rule

The defaults are a transcription rather than a product opinion: the vault this
was designed against already ran a numbered PARA tree, and every name is still a
setting.

```
0 Plan/       1 Daily  2 Weekly  3 Monthly  4 Quarterly  5 Yearly
1 Areas/      2 Goals/  3 Projects/  4 Resources/  6 Archive/
Finance/      Purchases  Bills  Recurring  Budgets
CRM/          People  Companies
```

`Finance/` is top level beside `Trips/`, `Places/` and `Eating/` rather than
inside an area, because a bill is not a project and because writing notes into
somebody's `Finanzen` area would be writing into their filing rather than beside
it. A bill note **links** to its document wherever the document lives.

`5 Notes` is deliberately absent: a free note store is not a PARA category.

The sibling plugins seed folder names per locale, and applied here that would
put `1 Bereiche` into a German-language install whose vault calls the folder
`1 Areas`. The plugin would then find nothing while looking perfectly
configured, and nothing about that failure is visible on the settings page. So
NODAtrail adds one rule, which the other two would benefit from later:

> **A folder default prefers a folder that already exists.** The localised name
> is the first candidate and the English one the second; the English one wins
> when it is present in the vault and the localised one is not.

It runs once, on a fresh install, never renames anything and never overrides a
saved value. A vault with neither folder gets the localised name, which is the
existing behaviour.

### 1.2 Adoption from a sibling

On a fresh install NODAtrail reads `<configDir>/plugins/apertrail/data.json` and
then `culitrail/data.json`, first hit wins, and adopts the seven CRM contract
fields plus the two stamp property names.

Two boundaries, the same two CULItrail's version has. **It reads a file, not a
plugin**, so there is no `getPlugin()` call and neither sibling need be
installed. And it adopts **names and locations only**, never a behaviour toggle.

The mechanism is CULItrail's; the code is not. CULItrail is GPL and this package
is PolyForm, so `settings/foreign-settings-import.ts` was written fresh.

---

## 2. PARA

The four note formats are in [`data-model.md`](data-model.md). Three decisions
are worth the reasoning here.

**An area has no status.** It is a standard to be maintained rather than an
outcome to be reached. The moment there is a status somebody will want a
deadline, and then it is a project.

**A project's area is derived through its goals.** The vault has no `area:` on a
project: the project points at a goal, the goal points at an area. Deriving it
means moving a goal to another area re-files every project under it without
touching a single project note. The optional explicit `area:` is for a project
that serves no goal, and an explicit value always wins, which is the rule the
whole suite follows for a value that can be both stated and derived.

**Archiving is a move, not a flag.** A note goes into
`6 Archive/<Category>/<Year>/` and gains an `archived:` stamp; its `type` does
not change. The year comes from `archiveYearFolders`, which is on by default
because a category folder that only ever grows is one nobody opens twice, and
it costs the readers nothing: folder matching recurses, so the active read and
the archive read are still one folder name each. That works because
`readNotesOfType()` takes a list of folders: the active read passes
`["3 Projects"]` and the archive read passes `["6 Archive/Projects"]`, with the
same type value in both. Nothing special-cases an archived note, and no view can
forget to. `readNotes` and `readAllNotes` are separate functions for exactly
that reason: including the archive is something a caller has to write on
purpose.

The archive stamp is written, unlike every other derived value here. It is not
derived: the folder says *that*, the stamp says *when*, and the when is not
recoverable from anywhere else.

---

## 3. Plan

Five levels, each with a path **template** rather than a folder, because a
period note's name is part of where it goes. `{GGGG}` and `{WW}` rather than
`{YYYY}` and a week number, for the reason CULItrail's meal-plan path already
documents.

**The navigation block is no longer written.** A period note used to open with
two generated lines, the chain upwards and the siblings either side, because
moving between periods was a thing you did by clicking links in a note. The
plan view does that now, with the five levels, previous and next, Today and a
date picker, so what was left in the note was 365 pairs of links a year that
all had to be right and that nobody read. `scripts/strip-nav-blocks.mjs` swept
the 87 notes that carried one: 423 deletions and no insertions, every deleted
line a nav line or a blank one.

What survives is the finder, in `plan/nav-block.ts`, and the writer now strips
instead of rebuilding. Recognising a block by its shape at the top of the body
was the hard part and is the part the tests pin. It is still idempotent and
still **touches nothing below the block**: the scan stops at the first line
that is neither a nav line nor blank, so a rule, a heading or a paragraph ends
it. The vault's week notes carry a `---` on the line after the block, and that
rule is the migrated content's own rather than the block's, so it stays.

**`quarter` is a new type value.** The vault's one existing quarter note says
`type: month`, which is a note that is wrong rather than a default that should
be. The health check reports it and a click fixes it.

---

## 4. Finance

The four formats are in [`data-model.md`](data-model.md). Four decisions carry
the module.

**Which date places an item.** A purchase belongs to the day it was ordered. A
bill belongs to the day it was **due**, not the day it was paid, because that is
the month somebody budgeted it in. A projected occurrence belongs to the day it
falls. This is the part of a household budget that is wrong most often, and it
is asserted in `tests/spend.test.ts` rather than left to be discovered.

**The stated total wins over the computed one.** A purchase note is a record of
what was charged. What the lines add up to is an opinion about that record; it
is what the health check compares against, not what a budget spends.

**A recurring cost projects; it never writes.** Correcting an amount corrects
every projected month at once, because nothing was written down. Turning one
occurrence into a bill note is a command somebody runs, on one occurrence,
having looked at it. An occurrence a bill already accounts for drops out of the
projection, matched on the exact day rather than the month, so one bill cannot
cancel four weekly occurrences.

**Currencies are never summed.** A total is per currency, always, and nothing
fetches a rate. And the budget hides nothing it did not plan for: an expense
account with movement on it that no budget line claims is shown as unbudgeted
rather than left out, because it is the most interesting row on the page and a
report that quietly dropped it would be a report that flatters.

---

## 5. What moved into `trail-core`

The core has three admission rules, and each of these went in under exactly one.
Stating which matters, because the rules disagree about the answer.

**`money/` (behaviour, two-consumer test).** `roundCents`, `formatMoney`,
`formatMoneyOrNull`, `normalizeCurrency` and `sumByCurrency`. APERtrail's
`shared/money.ts` said in its own header that if a third consumer appeared it
would move; NODAtrail was the third. APERtrail now imports it, and
`order/total.ts`'s private `toCents` is gone.

**`frontmatter/stamp-read.ts` (behaviour, two consumers).** The lenient reading
of four stamp shapes. All three plugins read the same vault's notes and all
three were blind to the wikilink shape.

**`tasks/` (a note format, on its own merits).** The clearest case in the whole
package: the format is not even this suite's. It is written by a third-party
plugin, it is in a great many vaults, and a parser defined inside the view that
renders it is a parser that drifts against a spec it cannot change.

**`period/` (a note format).** The token expansion and the level arithmetic. The
navigation block stayed here and has since been retired altogether; it never
had a claim on the core, because the arrows and the labels were user-facing
strings and the core ships none.

**`expense/` (a note format).** Purchase, bill, recurring cost and budget, with
their arithmetic. One reader today, and that is not the test: a format is an
agreement about a file, the notes go on holding to it long after any reader, and
a bill whose meaning drifted between releases would be a bill whose paid-ness
drifted.

**What stayed here.** The PARA schemas. An area, a goal, a project and a
resource are this product's model of a life, in the same way a trip and a photo
spot are APERtrail's model of a journey, and the core's own working notes name
those as the example of a schema that does not move. A project note is a product
opinion about how work is organised; a bill note is a record of a transaction.
The line is drawn between those two.

One extra landed in the core along the way: `dates/periods.ts` gained
`addMonthsKeepingDay`, because the existing `addMonths` snaps to the 1st. That
is correct for navigating between month notes and wrong for a premium that falls
on the 15th, and the two are separate names rather than a flag so neither call
site can be misread.

---

## 6. Surfaces

Six views (`nodatrail-dashboard`, `-para`, `-plan`, `-finance`, `-ledger`,
`-crm`), seven fenced blocks (`nod-tasks`, `nod-projects`, `nod-budget`,
`nod-bills`, `nod-spending`, `nod-period` and `noda-journal`), thirty-four
commands, twelve creation forms and the vault check.
[`../usage.md`](../usage.md) covers what each does.

Five of the commands are one period level each, because "open today" and "open
this quarter" are different keystrokes somebody binds rather than one command
with an argument.

`noda-journal` is the one fence that does not take the plugin's prefix. The
name is not NODAtrail's to choose: the parser is `trail-core`'s, it is spelled
once as `JOURNAL_LANGUAGE`, and renaming it would orphan every journal block
already on disk.

`nod-spending` is NODAtrail's counterpart to `travel-related-trips` and
`culi-related-orders`: a fence rendered inside the shared Company note without
owning it. An unclaimed fence renders as a plain code block, which is what keeps
a Company note readable with any of the three plugins disabled.

**Nothing is cached.** Every view re-reads on render and holds no
`metadataCache` subscription, so it redraws on open, on an explicit refresh, and
after a modal writes a note, but not when a note is hand edited in another tab.
The data is never stale; only the pixels can be.

---

## 7. Settings

Around 180 settings, one scrolling page with three sub-pages: **Folders**, laid
out as four module sections so it reads the way the vault does, **Property
keys**, grouped by the note type that carries them, and **Import rules**, which
is a list of rows somebody adds to rather than a value somebody types.

`unlockPropertyNames` defaults to `false` and every row naming a property, a
field or a type value is read-only until it is turned on. A folder row and a
property row look identical and are nothing alike to get wrong: repointing a
folder finds every note again the moment it points somewhere real, while
renaming a property makes every note carrying the old name stop answering, with
no error anywhere. **Nothing is migrated**, because a settings row cannot tell a
corrected typo from a vault it is being aimed at.

The property-keys page is built from a table, which is not only brevity: there
is exactly one call to `renderPropertyRow` in the file, so a row that skips the
lock cannot be written. `tests/property-name-lock.test.ts` checks that by the
shape of the setting's name rather than by a list.

---

## 8. Testing

| Suite | What it refuses to allow |
|---|---|
| `licence-boundary` (repository) | NODAtrail importing or naming another package |
| `crm-contract` | CRM defaults drifting from `trail-core`'s `CRM_CONTRACT` |
| `translation-keys` | A key in one language table and not the other, or an orphan |
| `property-name-lock` | A property-name row that skips the lock |
| `stylesheet` | A class with no rule, a rule nothing sets, a physical inline offset |
| `no-em-dash` | An em dash in anything shipped |
| `vault-smoke` | A reader that works against invented frontmatter and not against a real vault |

The smoke suite is the one worth calling out. It runs only when
`NODATRAIL_VAULT` points at a vault and skips otherwise, reads and asserts and
writes nothing, and checks the things unit tests cannot: that every area has a
priority, that every goal names an area that exists, that every project's area
derives, that every plan title parses as a period, and that every stamp in the
vault is readable in whichever of the four shapes it is written in.

Views, modals and settings pages are not unit tested, here as elsewhere in the
suite. They are exercised by hand.

---

## 9. Known divergences and leftovers

Stated here rather than left to be discovered.

1. **There is no reference vault, and the next one should be generated.** The
   three faults this entry used to list were observations of a checked-in vault
   that no longer exists, and nothing has been able to verify them since. A
   checked-in vault is the wrong artefact anyway: it drifts from the defaults it
   was built out of, it can only be in one language, and the German-only version
   of it is what let `vault-smoke` read English defaults and pass over zero notes
   for weeks. What is wanted is a function per plugin that builds a sample vault
   from that plugin's own defaults, in either language. A vault built from the
   defaults cannot drift from them. Not built; see the suite's own architecture
   notes, which argue the same thing.
2. **A picture can need the view reopened, and Refresh is not enough.** Reported
   30 August 2026: a project image added minutes earlier drew as the placeholder,
   Refresh did not change it, and closing the view and opening it again did.

   Everything the plugin owns was checked and is sound. The vault picker offers
   every image in the vault, so a shared folder such as `3 Projekte/_resources/`
   was always choosable; the note held a valid path the plugin itself had
   written; `resolveImageFile` falls through `getFirstLinkpathDest` to
   `getFileByPath` and handles that shape; the file was an ordinary baseline
   JPEG; and the deployed build matched the source byte for byte.

   **What Refresh cannot fix is a browser that has already cached a failed
   load.** `render()` rebuilds the DOM and makes a new `<img>`, but the `src`
   from `getResourcePath()` is the same string, so a failure cached against that
   URL is served again without touching disk. A vault syncing through iCloud
   produces exactly that window: the path resolves, the bytes are not there yet,
   the first draw fails, and every redraw fails identically until something
   changes the URL.

   Not worked around. Cache-busting every image on every render would defeat the
   cache the rest of the time, for a fault that lasts as long as one sync. What
   is written down instead is the diagnosis, because the symptom reads as a
   plugin bug and is not one: **run Check the vault first.** It reports an
   `image:` that resolves to nothing, on areas, goals and projects alike. If it
   is silent, the path is good and the picture is a rendering or sync problem,
   and reopening the view is the remedy.

   **The card now distinguishes the two**, which is what made this take an
   investigation rather than a glance. A note naming a picture that will not
   resolve, or one that resolves and will not decode, draws a `image-off` panel
   carrying the value it named; a note that names none draws the plain one. Both
   used to be the same panel.

3. **Two editors, and only two.** The twelve creation forms make notes; editing
   one afterwards is Obsidian's property editor, which is the right tool for a
   note whose fields are flat scalars and lists of links. The exceptions are a
   purchase's `items` and a budget's `lines`, which are lists of maps and which
   the property editor renders as nested fields with no way to add a row, remove
   one or move it. Those two have a dialog of their own, sharing one list editor
   in `ui/kit/`, and both write a single property through the host's frontmatter
   editor so nothing else on the note is touched. Nothing else is planned: an
   editor per note type would be a second way to say what the property editor
   already says.
4. **Adoption is one-directional and once-only**, exactly like CULItrail's, with
   the same consequence: a value changed in a sibling later does not propagate.
5. **The root `npm run build` still builds the packages in workspace order**,
   which puts the plugins before the core. Unchanged by this package, and listed
   in the suite's own architecture notes.
