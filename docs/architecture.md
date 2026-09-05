# The trail suite: design and implementation

**Status: as built on 26 August 2026, re-verified against the source and a full
test run the same day.** This describes what the code does today, not
what any older design document proposed. Where a package's own docs disagree
with its source, the source is what is written here and the disagreement is
called out.

One repository, three packages: a shared library and the two Obsidian plugins
built on it. **CULItrail moved to
[its own repository](https://github.com/technosoftware-gmbh/CULItrail) in
September 2026**; where this document says a thing is shared by three plugins,
that is still true and one of the three now reads the shared pieces off npm and
out of the vault rather than from a sibling directory.

| Package | Plugin id | What it covers | Licence | Version |
|---|---|---|---|---|
| `packages/core` (`@technosoftware/trail-core`) | not a plugin | The shared, Obsidian-free library | MIT | 1.1.0 |
| `packages/apertrail` | `apertrail` | Trips, places, photo spots | PolyForm Noncommercial 1.0.0 | 0.1.0 |
| `packages/nodatrail` | `nodatrail` | PARA, periodic notes, budgets, bills, ledger | PolyForm Noncommercial 1.0.0 | 0.1.0 |

Both plugins declare `minAppVersion: 1.12.0` and neither is desktop-only.

**NODAtrail is documented in its own tree** rather than repeated here:
[`packages/nodatrail/docs/design/architecture.md`](../packages/nodatrail/docs/design/architecture.md)
for the design and
[`packages/nodatrail/docs/design/data-model.md`](../packages/nodatrail/docs/design/data-model.md)
for every property of every note type it reads or writes. What this document
carries about it is what the suite as a whole has to know: which modules it put
into the core, and where it sits in the licence picture.

---

## 1. One repository, three licences

The packages carry three licences, and the reason is history rather than
preference. CULItrail carries code inherited from
[Recipe Box](https://github.com/AdamArcane/obsidian-recipebox) and is
GPL-3.0-or-later as a whole. APERtrail and NODAtrail were written independently
and ship under PolyForm Noncommercial. The core is MIT so that it can flow into
all three, which is also why a shared module could never simply live in one of
the plugins.

NODAtrail follows CULItrail's settings-adoption mechanism and shares none of its
code: the approach was read and the file was written fresh. That distinction is
what lets the two be licensed differently, and it is why
`packages/nodatrail/NOTICE.md` states it rather than leaving it to be assumed.

They were separate repositories until August 2026. Keeping them apart cost more
than it returned: every change touching the core and a plugin was two commits in
two histories with a manual build step between them, because npm does not run a
`file:` dependency's `prepare` script. One repository with npm workspaces makes
that one commit and one install.

**What a monorepo makes easy is exactly what this suite must not do.** In
separate repositories the licence boundary was enforced by the filesystem. Here
it is one relative path away, so `tests/package-boundary.test.ts` enforces it
instead: no file may resolve an import outside its own package, no package may
name another as a dependency, in either direction, and each package's stated
licence must match a `LICENSE` file that exists. The core is the one exception,
which is the whole point of it. **What the plugins do instead of importing each
other is section 11.**

---

## 2. trail-core

### 2.1 The one rule

**Nothing in `trail-core` may import `obsidian`, touch the DOM, read the
filesystem, or call `new Date()` without an injectable override.** That is what
lets the same code run inside a plugin, inside vitest under Node, and inside a
standalone application that has never heard of Obsidian.

The rule is enforced twice on purpose. ESLint has a `no-restricted-imports` rule
over `src/**` and `tests/**`, and `tests/obsidian-free.test.ts` greps the source
files directly, because a lint rule is only run when somebody runs lint and can
be silenced by the same edit that breaks it.

The single exemption is `src/obsidian/`, reachable only through the
`@technosoftware/trail-core/obsidian` subpath export. It is the only place in the package that
imports Obsidian, and it is deliberately thin: there is no logic in it to get
wrong.

### 2.2 Ports, and the host seam

A module that needs the vault takes a **port** rather than an `App`.

```
VaultPort       read, create, modify, append, createFolder, getFile, exists, markdownFiles
MetadataPort    frontmatterOf(file)
FrontmatterPort process(file, edit)
VaultHost       { vault, metadata, frontmatter }
```

`VaultHost<F>` is generic over the host's own file type, so Obsidian's `TFile`
flows through structurally without a cast at the boundary. Each plugin binds an
`App` to a host exactly once, in its own `src/shared/vault-host.ts`, memoised in
a `WeakMap`, and every App-taking call site delegates to that.

The same generic trick carries the note records: `OrderRecord<F>` and
`DeliveryRecord<F>` pair a parsed note with the file it came from, and each
plugin binds `F` to `TFile` in one small file of its own.

### 2.3 What lives in the core

| Module | Responsibility |
|---|---|
| `crm` | Person and Company notes: the property names, the field reading, and frontmatter tag reading and matching |
| `dates` | Local-calendar arithmetic: day titles, ISO weeks, months, quarters, years, minute-precision stamps, locale display, day distance |
| `delivery` | The delivery note format, and the adapter that turns orders into what is still owed |
| `fulfilment` | Ordered minus delivered, as one kernel: the arithmetic behind both meal deliveries and part-shipped purchases |
| `document` | The format-agnostic invoice model an order and a delivery note are both rendered through |
| `expense` | The purchase, bill, recurring-cost and budget note formats, and the arithmetic over them, including the consignments a purchase that ships in parts arrives in |
| `frontmatter` | Defensive readers for hand-edited YAML, block splitting, created/modified stamps, single-property writes |
| `geo` | Coordinate parsing, haversine distance, bearing, compass point |
| `ledger` | Accounts, postings, the journal format, balances and reports, the statement import and the bill and order matching around it |
| `links` | Wikilink reading and writing, strict and lenient flavours |
| `markdown` | Clean-room heading and list parser for a note body |
| `money` | Rounding to the cent, locale-aware formatting with a currency, and summing per currency without ever summing across them |
| `period` | The five periodic-note levels: titles, parents, ranges, and the `{YYYY}`/`{GGGG}`/`{WW}`/`{Q}` path templates |
| `tasks` | The Obsidian Tasks checkbox line: parsing one, scanning a note for them, and editing one in place |
| `meal` | The editable shape of a meal note, the nutrient vocabulary and the per-100 g model behind it, nutrition conversion, supplier rules |
| `obsidian` | The one Obsidian adapter, behind its own subpath |
| `order` | The order note format, its filename, and what an order comes to |
| `paths` | Vault path strings, with its own `normalizePath` rather than Obsidian's |
| `plan` | The meal-plan note format: the line, the weekday sections, and what a week's note is called |
| `reheating` | Per-appliance reheating instructions and the dish-versus-supplier merge |
| `settings` | `CRM_CONTRACT` and `DISPLAY_CONTRACT`, the cross-plugin agreements expressed as constants |
| `solar` | NOAA solar position and rise/set times, iterated rather than approximated |
| `vault` | The ports, note creation and stamping, and `readNotesOfType` |

### 2.4 The promotion rule

A module gets in one of three ways, and which question applies depends on what
kind of thing it is.

**Behaviour: two consumers before it moves. One consumer is a module that
belongs in its plugin; two is a contract.** This is the rule that keeps the
package from becoming a junk drawer, and it is what `crm`, `dates`,
`frontmatter`, `links`, `paths`, `settings` and `vault` are here on: both
plugins import from every one of them.

**A note format: on its own merits, whatever the number of readers.** A note
format is not one plugin's logic. It is an agreement about a file, which the
notes in a vault go on holding to long after any particular reader of them, and
a format defined inside the code that renders it is redefined every time the
rendering changes. Written twice it drifts, and the CRM tag reading proved that
by drifting: one side stripped a leading `#` from a tag and the other did not,
so `#Familie` was one tag to one plugin and a different tag to the other.
Written inside one view it drifts against itself, one release at a time. `meal`,
`plan`, `order`, `delivery` and `reheating` are here on this test, and only
CULItrail reads them. `order/total.ts` was once named in the core's own
documentation as an example of product logic that stays out; it is in now under
this test, because what an order's lines add up to is fixed by the note rather
than by whichever view is adding them.

**This test is about a format module, and not every note has one.** A note whose
every property is a flat scalar or a link has no format code to share: the
core's generic readers already read it, and the names come from settings a
sibling adopts. APERtrail's booking note is the worked example, and section 11.3
is where that is settled.

**Arithmetic that describes the world: on its own merits too.** `geo` and
`solar` are imported by APERtrail alone. Where the sun is at a place on a date
is a fact rather than a product's opinion, and the core is where it is checked
against published tables. The vocabulary a product lays over the fact stays with
the product, which is why `lightWindowRange` is still APERtrail's.

What never moves: views, user-facing strings, settings objects, and the schemas
that belong to one product, such as the trip and photo-spot shapes.

**A view cannot be shared, so the agreement between the three interfaces is a
document instead.** [`docs/ui-conventions.md`](ui-conventions.md) is the
specification the three implement separately, and it exists because of this rule
and the licence boundary together rather than in spite of them.

A second rule follows from the first: **the core ships no user-facing strings.**
It throws typed errors, such as `NoteExistsError`, and lets the caller
translate. A module that wants to call `t()` is a module that belongs in a
plugin.

### 2.5 Consumption

`trail-core` is ESM, built with `tsc` into `dist/`, which is not committed. In
the workspace, `npm install` builds it through the package's own `prepare`
script, and every other command relies on that having happened. The plugins
bundle it into `main.js` with esbuild, externalising only `obsidian`,
`electron`, the CodeMirror and Lezer packages and node builtins.

**The root `npm run build` does not order the packages.** `npm run build
--workspaces` visits them in workspace order, which puts `culitrail` before
`core`, so a tree whose `dist/` is missing or stale fails the plugin typecheck
with `Cannot find module '@technosoftware/trail-core'` rather than rebuilding the core first.
After a change to the core, run `npm run build --workspace packages/core` first,
or `npm install` again. This is a rough edge in the root script rather than a
design decision, and it is listed in section 12.

---

## 3. How a note is recognised

All three plugins ask the same question of every note, through the same
function,
`readNotesOfType(host, { folders, typePropertyName, typeValue })`.

**A note counts as a given kind only if it is under one of the configured
folders AND its type property carries the configured value.** There is no
folder-only fallback for a note missing its type, and no vault-wide search for a
type outside its folder. A note that is moved, or whose type is mistyped, drops
out silently, which is by design: the alternative is a plugin quietly claiming
notes it was never pointed at.

Two guards make an unconfigured setting fail safe rather than fail wide:

- **A blank folder list matches nothing**, rather than being read as the vault
  root. A folder setting left empty hides its own folder; read as the root it
  would claim every note in the vault.
- **A blank type value matches nothing**, rather than matching every note in the
  folder. This is the same reasoning one level down.

The value comparison is **exact after trimming, and case-sensitive**, so a vault
that deliberately distinguishes `person` from `Person` keeps that distinction.
The value's *shape* is read leniently, because Obsidian's property editor turns a
field into a list the moment somebody adds a second value: `type: city`,
`type: [city]`, `type: [city, draft]` and `type: "[[city]]"` all match `city`.

Nothing is cached. Every view re-reads on render, so what a view shows can never
drift from what is on disk. The data is never stale; only the pixels can be.

---

## 4. The settings model

The rules below in the context of the design.
[`docs/settings.md`](settings.md) is the same model on its own terms, with the
measured coverage per plugin and pointers to the three full key lists.

### 4.1 Every vault-facing name is a setting

The convention is that **every frontmatter property name, every field name
inside a nested structure, and every type value is a setting with a sensible
default, never a bare literal in logic**, so a vault whose notes already use
other names never has to rename anything on disk.

CULItrail honours it fully: seventy-seven settings name something inside a note.
APERtrail honours it with three documented exceptions, all subtype specific:
`accommodationType`, `accommodationStatus` and `fnbType` are read at literal
names. NODAtrail honours it with none.

### 4.2 Localised defaults

Folder names are seeded per locale at first load, not baked in. A German vault
gets `Essen/Mahlzeiten` where an English one gets `Eating/Meals`. Only the
**name** is localised; the shape is not, which is what lets two plugins in one
German vault resolve the same German folder from the same key.

Sub-folders derive from a module root, so moving a root moves everything under
it, while any single sub-folder can still be repointed on its own. A newly added
sub-folder falls under the vault's **saved** root rather than the pristine
default.

### 4.3 Validation

Each plugin turns raw `data.json` into a typed settings object through a
`mergeSettings()` function that validates each field individually and fills in
defaults for anything missing or of the wrong type, so no corrupt value from a
hand-edited file ever reaches the UI. An empty string is kept rather than
replaced where empty is meaningful, which is how a blank stamp property means
"do not write that stamp" and a blank tag filter means "everyone".

### 4.4 The property-name lock

All three plugins ship `unlockPropertyNames`, default `false`. **Every settings row
that names a property, a field or a type value is read-only until that switch is
turned on.**

The reasoning is that a folder row and a property row look identical on a
settings page and are nothing alike to get wrong. Repointing a folder moves
where the plugin looks, and every note is found again the moment it points
somewhere real. Renaming a property changes what the plugin asks each note for,
and every note carrying the old name stops answering, with no error anywhere,
because a property no note has is not an error. **Nothing is migrated**, because
a settings row cannot tell a corrected typo from a vault it is being aimed at.

The switch is one setting shown at the top of each tab that carries such rows.
Each package has a `property-name-lock` test that goes by the shape of the
setting's name rather than by a list, so the next property setting somebody adds
is caught without anybody having to remember it.

---

## 5. The shared CRM

### 5.1 The contract

Person and Company notes are shared by all three plugins and owned by none of
them. The seven defaults they must agree on live in the core as a frozen
constant:

| Key | Value |
|---|---|
| `typePropertyName` | `type` |
| `personsFolder` | `CRM/People` |
| `companiesFolder` | `CRM/Companies` |
| `personTypeValue` | `person` |
| `companyTypeValue` | `company` |
| `personTagProperty` | `tags` |
| `companyTagProperty` | `tags` |

This is **not configuration**. It is the set of defaults each fresh install must
ship so that any two of them installed into one empty vault find each other
without anything being configured twice. Each vault may still rename any of
them.

It exists because the agreement had already drifted in shipped code while the
documentation on every side asserted it held: capitalised defaults such as
`Person` and `Organisation` on one side, `person` and `company` on the other,
and a mismatched type value does not raise an error, it silently returns an
empty list. `crmContractMismatches()` backs a test in each plugin that fails on
drift.

### 5.2 One format, three readers

The note format itself is now the core's too. `crm/note.ts` holds the property
names, the field reading and the type-value and tag-property lookups;
`crm/tags.ts` holds frontmatter tag reading and matching. Each plugin maps its
own settings to `CrmPropertyNames` once and keeps nothing else.

**A property name the caller does not give is not read.** That is what lets one
module serve three plugins that show different fields: APERtrail names the
description, address, website, email, phone and mobile because it displays them,
CULItrail names none of them, because it shows a person's title and tags and
nothing else, and NODAtrail names only what its own two properties need. Reading
fields nothing displays would mean settings somebody has to understand for no
visible effect.

| Plugin | Person and Company notes |
|---|---|
| APERtrail | Creates them, writes them, reads them |
| CULItrail | Reads only: title and tags, plus a company's purchasing terms |
| NODAtrail | Creates and reads them, and writes two properties of its own onto a Company note |

**NODAtrail writes two properties onto a Company note that nothing else
reads**, under `companyAccountProperty` and `companyCategoryProperty`: the
ledger account and the category that company's paperwork usually uses. They are
additive and touch no field the contract names, which is what makes a third
writer safe on a note nobody owns. The mapping lives in the note rather than in
NODAtrail's settings so that it survives a reinstall, is visible in a note
somebody already has open, and can be corrected in Obsidian's own property
editor by anybody who never opens a NODAtrail dialog.

Each plugin renders its own fenced code block inside the shared note without
owning it: APERtrail's `travel-related-trips` answers "which trips did this
person come on", CULItrail's `culi-related-orders` answers "what did this person
order", and NODAtrail's `nod-spending` answers what was actually spent with this
company. **An unclaimed fence renders as a plain code block rather than an
error**, so a Person note stays readable with any of them disabled.

CULItrail additionally reads seven company terms, which are not part of the
contract and not in the core, because they describe what one company charges
rather than what a CRM note is, and they have one reader.

### 5.3 Adoption on first install

Adoption runs one way, into the plugin installed later. On a genuinely fresh
install CULItrail reads `<configDir>/plugins/apertrail/data.json`, and NODAtrail
reads both siblings' files, each adopting folders, type values, property names
and the tag filter. **APERtrail adopts from nobody**, which is deliberate rather
than missing: it defined these defaults first, so in the common case it has
nothing to adopt from.

Two boundaries make it safe. **It reads a file, not a plugin**, so there is no
`app.plugins.getPlugin()` call, no imported types and no runtime coupling, and
the sibling need not be installed. And it adopts only names and locations, never
behaviour toggles. Adoption only ever touches a setting still sitting at its
shipped default, so a value somebody chose is never overwritten.

Because adoption runs on a fresh install only, **a value configured in one
plugin after another was already installed does not propagate.** That is the
usual reason two plugins disagree about the tag filter in a working vault.

### 5.4 The eligible-person tag filter

CULItrail and APERtrail narrow which people they offer by a comma-separated tag
filter, and **an empty filter admits everyone, never nobody**, so a vault that
never configures it sees every person rather than an empty dropdown that reads
as a broken plugin. NODAtrail honours it too, on the account note's owner: `crm/read-persons.ts`
reads Person notes and narrows them, and the New account dialog offers the
result. The filter is **per plugin on purpose** rather than part of the CRM
contract, because `CRM/People` holds everyone the vault has a note for and the
people who own a household's accounts are not the people who belong on a trip,
nor the authors of the books somebody is reading.

The comparison is the core's, once: case-insensitively, with a leading `#`
ignored on both sides, and with a parent tag admitting its nested children, so
`Familie` matches `familie`, `#Familie` and `Familie/Eltern` but never
`FamilienFirma`.

### 5.5 The company role filters

Companies are narrowed the same way and by a different mechanism: a `roles` list
on the Company note, compared by the core's `companyHasRole`. Three settings
read it, each naming **one** role and each shipping blank:
`mealSupplierRole` in CULItrail, `billVendorRole` and `billCustomerRole` in
NODAtrail.

**Blank admits everyone, never nobody**, which is the same rule as the tag
filter and carries the same weight: a vault that has classified nothing must see
every company rather than an empty dropdown. Unlike the tag filter the match is
exact rather than nested, because a role is a word somebody picks from a short
list rather than a tag hierarchy.

One flat list carries two independent axes -- what a company supplies (`meals`)
and which way its invoices travel (`vendor`, `customer`) -- and a company that
is several of those carries several roles. That is what makes a company that
both bills the household and is billed by it appear in both invoice pickers
without any of the three settings knowing about the others.

**A form that narrows by a role seeds it into any company created from that
form.** Otherwise the filter rejects the note it just invited somebody to
create, and the company disappears the next time the form opens.

NODAtrail's money forms offer **companies and persons in one list**, narrowed by
the same role settings, because a household is billed by a person often enough
and the bill note has never cared which kind its `company` link resolves into.
Where the two folders hold the same title the company wins, and the picker and
the account-and-category lookup fix that order in the same direction. The
statement importer's payment-provider list stays companies-only: it decides what
a statement row may match, and a match there ends in a posting.

---

## 6. Frontmatter reference

Every name below is the **default**; each is a setting whose key is given so it
can be found in `data.json`. Shapes: *link* means a wikilink such as
`"[[Stefan Muster]]"`, *list* a YAML list, *stamp* the quoted
`YYYY-MM-DDTHH:mm` form, *date* a `YYYY-MM-DD` day.

Where a note's **format** lives in the core, it is marked. The feature is still
the plugin's; what is shared is the shape of the note.

**NODAtrail's note types are not repeated here.** Areas, goals, projects,
resources, the five periodic notes, purchases, bills, recurring costs, budgets,
accounts and the journal are documented property by property in
[`packages/nodatrail/docs/design/data-model.md`](../packages/nodatrail/docs/design/data-model.md),
which is the reference this section would otherwise duplicate and drift from.

### 6.1 Shared by all three plugins

| Property | Setting key | On | Meaning | Shape |
|---|---|---|---|---|
| `type` | `typePropertyName` | every note | Which kind of note this is | string |
| `created` | `createdProperty` | every note a plugin creates | Written once at creation, never backfilled | stamp |
| `modified` | `modifiedProperty` | notes a plugin edits | Rewritten on every edit of an existing note | stamp |

The two stamps deliberately carry no plugin prefix, so a vault running both
configures one convention rather than two.

### 6.2 CULItrail: meal note (`type: meal`)

| Property | Setting key | Meaning | Shape | Read/write |
|---|---|---|---|---|
| `image` | `imageProperty` | Hero image | string, link or embed | read |
| `servings` | `servingsProperty` | Portions the dish holds | number | read |
| `prepTime` | `prepTimeProperty` | Minutes of preparation | number | read |
| `reheatTime` | `reheatTimeProperty` | Minutes of reheating | number | read |
| `totalTime` | `totalTimeProperty` | Stated total; derived from the two above when absent, never written back | number | read |
| `diet` | `dietProperty` | Diet tags, and the gallery's diet filter | list | read |
| `allergens` | `allergensProperty` | Allergens | list | read |
| `calories` | `caloriesProperty` | Energy in one serving, on the basis set by `nutritionSource`. Typed on a meal that states no per-100 g breakdown; computed on save from the breakdown and the serving weight on a meal that does | number | read and write |
| `protein`, `fat`, `carbs` | `proteinProperty`, `fatProperty`, `carbsProperty` | The three macronutrients per serving, on the same terms | number | read and write |
| `kj` | `kjProperty` | Energy in kilojoules per serving | number | write only |
| `caloriesPer100g` | `caloriesPer100gProperty` | Energy in 100 g, as the packet declares it. Never the same claim as `calories` | number | read and write |
| `kjPer100g` | `kjPer100gProperty` | The same in kilojoules | number | read and write |
| `macronutrients` | `macronutrientsProperty` | The declared macronutrients per 100 g, one entry per nutrient, in Regulation (EU) 1169/2011's order | list of `{name, unit, value}` | read and write |
| `micronutrients` | `micronutrientsProperty` | The declared micronutrients per 100 g, salt first | list of `{name, unit, value}` | read and write |
| `price` | `priceProperty` | Price of one portion ready-made; `cost` accepted as an alias | number | read |
| `priceCurrency` | `mealPriceCurrencyProperty` | Currency, when it differs from the supplier's | string | read |
| `line` | `mealLineProperty` | Which of a supplier's ranges the dish belongs to | string | read |
| `supplier` | `supplierProperty` | Which Company sells it; overrides inference from the most recent order | link, read leniently | read |
| `favorite` | `favoriteProperty` | Marks a favourite | boolean | read |
| `lastEaten` | `lastEatenProperty` | Date of the most recent helping, derived from plan entries | date | read and write |
| `eatenCount` | `eatenCountProperty` | Number of helpings, derived from plan entries | number | read and write |
| `eatingHistory` | `eatingHistoryFrontmatterProperty` | The old log. Still read, no longer written | list of records | read only |
| `serving_size` | `servingSizeProperty` | The weight of one serving, as `440g`, `440 g` or `440`. Written by the editor whenever a meal states a per-100 g breakdown, and read back by the editor as the figure the per-serving values are derived with | string or number | read and write |

`default_serving_size` used to sit under `serving_size` and is gone. The editor
wrote both from the same weight, so it could never state anything the row above
it did not, and nothing ever read it back: a second name for one number is a
second place for a reader to look and a second thing for a hand edit to
contradict. CULItrail's `scripts/strip-default-serving-size.ts` takes it
off a vault that still carries it.

`lastEaten` and `eatenCount` are **the one deliberate write-back across notes**:
the gallery and the dashboard read frontmatter and never open plan notes, so
those two are recomputed from the plans whenever a helping is recorded.

**A meal states its nutrition on two bases.** The per-serving five are one
portion as sold; the per-100 g four are what the packet declares. A note can
carry both, and where it does, the per-serving five are derived on save from the
breakdown and the serving weight, so the two cannot disagree after an edit to
either. A breakdown with no serving weight derives nothing and writes the five
empty, rather than multiplying a whole label by zero grams.

A nutrient list entry names the nutrient, the unit it was stated in and the
figure, under three sub-key settings of their own (`nutrientNameField`,
`nutrientUnitField`, `nutrientValueField`, defaulting to `name`, `unit` and
`value`). The name is a **language-free id** such as `saturatedFat`, which is
what lets each plugin show a translated label for it; the vocabulary and the
declaration order are `trail-core`'s, in `meal/nutrients.ts`, and a name that
vocabulary does not know is kept and shown exactly as written. The unit is
stored per entry rather than derived from the name, because a label states it.
`salt` and `sodium` are separate ids and nothing converts between them.

A meal written before the breakdown moved into frontmatter keeps it in two body
sections instead, under the read-only headings `nutritionHeading` and
`micronutrientHeading`. **The vault migration has not run**, so CULItrail falls
back to reading those sections whenever the four properties state nothing, and
converts a note the first time its editor saves it.

**There is no `rating` on a meal note.** Rating lives on the individual helping,
because the same dish is not the same experience twice, and an average across
helpings answers a question nobody asked.

Inside the body, under the reheating heading, one sub-heading per appliance
carries two inline fields, `[temp:: 95 °C]` and `[time:: 25 min]`, whose names
are the settings `reheatTempField` and `reheatTimeField`. The appliance list is
itself a setting, defaulting to microwave, oven, steamer and skillet, and a
sub-heading is matched against the configured label, then the id, then the
shipped defaults in either language.

### 6.3 CULItrail: meal plan note (`type: mealPlan`) *(format in the core)*

One note per person per ISO week, at `mealPlanPath`, default
`Eating/Meal Plans/{GGGG}/{GGGG}-W{WW}-{person}-MealPlan.md`. `{GGGG}` and
`{WW}` are the ISO week-year and week number, deliberately not `{YYYY}` and
`{ww}`, which are calendar-year based and disagree with the ISO week near a year
boundary. `{person}` is the person's full note title with spaces removed,
because an earlier scheme used the first name and two people sharing one wrote
into the same file.

| Property | Setting key | Meaning | Shape |
|---|---|---|---|
| `week` | `mealPlanWeekProperty` | The ISO week, for example `2026-W34` | string |
| `person` | `mealPlanPersonProperty` | Whose plan this is | link |
| `entries` | `mealPlanEntriesProperty` | Every planned or eaten helping | list of maps |

Each entry carries these fields, whose names are settings in their own right:

| Field | Setting key | Meaning |
|---|---|---|
| `meal` | `planEntryMealField` | A wikilink to a meal note, or plain text for a non-meal entry such as leftovers |
| `day` | `planEntryDayField` | `monday` through `sunday`; an entry with no day sits in the week's queue |
| `slot` | `planEntrySlotField` | `breakfast`, `lunch`, `dinner` or `snack` |
| `eaten` | `planEntryEatenField` | Written only when true |
| `rating` | `planEntryRatingField` | One to five; absent means eaten and unrated |
| `time` | `planEntryTimeField` | Clock time, quoted, `HH:mm` |
| `note` | `planEntryNoteField` | Free text about that helping |
| `leftovers` | `planEntryLeftoversField` | Written only when true |
| `id` | `planEntryIdField` | Stable identity an edit finds the entry by |

`entries` is **written even when empty**, the only property in the plugin with
that rule, because an empty list is how the note says "this week is planned and
holds nothing" rather than "this note has not been converted".

**The plan note is the eating history.** An entry with `eaten: true` is the
record, which is why nothing writes the old `eatingHistory` property any more.

### 6.4 CULItrail: order note (`type: order`) *(format in the core)*

Filename `yyyy-mm-dd-ordernumber.md`. The order number lives in the filename
only: it is not a property and has no setting.

| Property | Setting key | Meaning | Shape |
|---|---|---|---|
| `company` | `orderCompanyProperty` | Who it was ordered from | link |
| `orderDate` | `orderDateProperty` | Order date; wins over the filename | date |
| `deliveryDate` | `orderDeliveryDateProperty` | Expected delivery | date |
| `price` | `orderPriceProperty` | The stated total, never overwritten by a computed one | number |
| `priceCurrency` | `orderPriceCurrencyProperty` | Currency | string |
| `discount` | `orderDiscountProperty` | Discount off the whole order | number |
| `shipping` | `orderShippingProperty` | Shipping added to the whole order | number |
| `vatRate`, `vatAmount` | `orderVatRateProperty`, `orderVatAmountProperty` | Stated only; nothing is computed from them | number |
| `selections` | `orderSelectionsProperty` | One entry per person | list of maps |

A selection carries `person` (`orderSelectionPersonField`) and then either
`meals` (`orderSelectionMealsField`), a bare list of links, or `items`
(`orderSelectionItemsField`), a list of maps of `meal`, `price`, `quantity` and
`discount`. **The priced shape is chosen per note, not per person**: as soon as
any line anywhere in the order carries a price, a quantity or a line discount,
the whole note is written in the priced shape.

**Every price in an order is gross**, which is what a meal company's invoice
says. `vatRate` and `vatAmount` are what a note may additionally claim about how
much of that gross was tax.

### 6.5 CULItrail: delivery note (`type: delivery`) *(format in the core)*

Filename `yyyy-mm-dd.md`, with a numeric suffix for a second box the same day.

| Property | Setting key | Meaning | Shape |
|---|---|---|---|
| `deliveryDate` | `deliveryDatePropertyName` | Delivery date; wins over the filename | date |
| `orders` | `deliveryOrdersProperty` | Which orders this box settles; may be empty | list of links |
| `items` | `deliveryItemsProperty` | What was in it | list of maps |

An item carries `meal` (`deliveryItemMealField`) and `quantity`
(`deliveryItemQuantityField`), the quantity omitted when it is one. A bare
wikilink is accepted in place of a map.

A delivery is its own note rather than a section on an order because **one order
can arrive in two boxes a week apart and one box can settle two orders**, and
neither fits inside an order note without lying about the other.

### 6.6 CULItrail: company terms

Read from the shared Company note, and read by CULItrail alone:
`currency` (`companyCurrencyProperty`), `paymentMethod`, `invoiceTiming`,
`shippingFee`, `freeShippingFrom`, `discountTable` (a list of `from` and
`percent` pairs, counted in meals) and `lines`, the ranges the company sells the
same dish under.

### 6.7 APERtrail: trip note (`type: trip`)

| Property | Setting key | Meaning | Shape |
|---|---|---|---|
| `country` | `countryProperty` | Country the trip is in | link |
| `cities` | `tripCitiesProperty` | Cities it touches | list of links |
| `departure`, `return` | `departureProperty`, `returnProperty` | When it starts and ends | quoted datetime |
| `travelType` | `travelTypeProperty` | Free text | string |
| `travelStatus` | `travelStatusProperty` | `Planned`, `Booked`, `Over` or `Cancelled` | string |
| `reviewStatus` | `reviewStatusProperty` | Free text | string |
| `rating` | `ratingProperty` | One to five | number |
| `persons` | `personsProperty` | Who came along | list of links |
| `stops` | `stopsProperty` | The itinerary | list of maps |
| `nights` | `nightsProperty` | Where the nights were spent | list of maps |
| `transport` | `transportProperty` | How it was reached | list of maps |
| `currency` | `tripCurrencyProperty` | The trip's own currency, which a line carrying none inherits | string |
| `budget` | `budgetProperty` | Planned spending per category | list of `{category, amount}` |
| `rates` | `ratesProperty` | Stated conversion rates, one per currency | list of `{currency, rate}` |

A stop carries `place`, `from`, `to`, `note`, `motif` and `rating`; a night
carries `accommodation`, `checkIn` and `checkOut`; a leg carries `direction`
(`outbound` or `inbound`), `mode`, `from`, `to`, `origin`, `destination` and
`reference`. **All three additionally carry `cost`, `currency`, `costUnit` and
`persons`**, which is how a trip's own spending is recorded without a booking
note of its own. Every field name is a setting.

`costUnit` is one of `total`, `person`, `night` or `personNight`, and **an
absent one reads as `total`**, never as the unit that kind of line is usually
quoted in: a bare number somebody typed by hand must not silently multiply
itself into something larger than they meant. The editors write the unit
explicitly instead, and the multiplication is redone on every render and stored
nowhere, so adding a person to a trip corrects every line that named none.

**An empty `persons` on a line means everybody, and is written as nothing.**
That is what keeps a person added to a trip later from being quietly missing off
its flights.

**Every datetime with a clock component is written as a quoted string**, because
an unquoted YAML datetime is coerced to a native date and the time is lost.

### 6.8 APERtrail: places

Ten travel type values are fixed literals rather than settings: `trip`,
`booking`, `country`, `state`, `city`, `accommodation`, `fnb`, `landmark`,
`location` and `photospot`. The last five share one place shape. A booking is a
fact about a trip rather than a place -- no coordinates, never an itinerary stop
-- and is deliberately not one of those five.

| Property | Setting key | On | Meaning |
|---|---|---|---|
| `country` | `countryProperty` | State, City, all place types | Link upwards |
| `state` | `stateProperty` | City | Link upwards |
| `city` | `cityProperty` | All place types | Link upwards |
| `capital` | `capitalProperty` | Country, State | Link to a City |
| `states`, `cities` | `statesProperty`, `citiesProperty` | Country, State | Links downwards |
| `geoLocation` | `geoLocationProperty` | City, all place types | `[lat, lon]`, written as quoted strings |
| `address`, `website` | `addressProperty`, `websiteProperty` | All place types | Free text, read only |
| `rating` | `ratingProperty` | All place types | One to five, read only |
| `visited`, `lastVisit` | `visitedProperty`, `lastVisitProperty` | City, all place types | See below |

**`visited` and `lastVisit` are derived at read time and never written back.**
They are computed from the stops of trips whose status is `Over`. An explicit
`visited: true` in the note always wins, and an explicit `lastVisit` is folded
in beside the derived dates with the most recent winning. A Country has no
`visited` of its own; it is computed from the cities and places that point at
it.

`accommodationType`, `accommodationStatus` and `fnbType` are the three property
names in APERtrail that are literals rather than settings.

### 6.9 APERtrail: photo spot (`type: photospot`)

Five flat access fields, deliberately not nested because Obsidian's property
editor cannot edit nested maps: `timezone`, `openingHours`, `entryFee`,
`accessibility` (`full`, `partial`, `none` or `unknown`) and `parking`.

`transit` is a list of `mode` and `detail`. `motifs` is the heart of the note: a
list of maps carrying `name`, `role` (`main` or `secondary`, at most one main),
`geoLocation`, `direction` in degrees, `light` as a list of light windows,
`season` as months, `lens`, `gear`, `technique`, `note`, `captured` and
`capturedOn`. `samples` is a list of `image`, `motif`, `light`, `exposure` and
`credit`.

The photo spot and trip structures carry a great many settings between them,
and the line APERtrail draws is by shape rather than by count. **A top-level
property of a note gets a row on the Property keys page; a `*Field` naming a
sub-key inside a list entry does not.** A sub-key is the shape of a value rather
than a property of a note, and a row each would cost the page its readability
without answering a question anybody asks, so they are edited in `data.json` on
the rare occasion they need editing at all. Every one of them is fully honoured
by the reader, the writer and the validator. The current count is in
[`docs/settings.md`](settings.md) section 8, measured rather than stated here,
because this is the number that moves every time a note type is added.

### 6.10 APERtrail: booking note (`type: booking`)

One purchase that belongs to one trip: a flight, a hotel stay, a museum ticket.
Filed under `bookingsFolder`, default `Trips/Bookings`, which is nested inside
the trips folder and matched by the longest folder rather than by nesting, so a
booking is judged as a booking rather than as a mistyped trip.

| Property | Setting key | Meaning | Shape |
|---|---|---|---|
| `trip` | `bookingTripProperty` | Which trip it belongs to | link |
| `category` | `bookingCategoryProperty` | One of six fixed values, section 7 | string |
| `status` | `bookingStatusProperty` | One of five fixed values, below | string |
| `supplier` | `bookingSupplierProperty` | The Company it was bought from, where there is one | link |
| `place` | `bookingPlaceProperty` | The place or city the cost is for, and what puts it on the right itinerary row | link |
| `date` | `bookingDateProperty` | The day the cost belongs to, not the day it was paid | date |
| `amount` | `bookingAmountProperty` | What it costs | number |
| `currency` | `bookingCurrencyProperty` | ISO code; empty inherits the trip's, then the home currency | string |
| `reference` | `bookingReferenceProperty` | The booking reference, and what matches a booking to a transport leg carrying the same one | string |
| `payer` | `bookingPayerProperty` | Which participant actually paid | link |
| `for` | `bookingForProperty` | Who the cost is for; empty means every participant | list of links |
| `document` | `bookingDocumentProperty` | The confirmation or invoice file in the vault | link |

**A booking note carries no fenced block and needs none.** Every field on it is
a flat scalar or a list of links, so Obsidian's own property editor is already
the right editor. That is also why the format stays in APERtrail rather than
moving into the core, and what would reopen that: see section 11.3.

**The status decides which total the booking counts in**, and the five are not
interchangeable:

| Status | What it does to a total |
|---|---|
| `estimate` | Counts as committed. A budget that counted only what was already booked would read as nothing at the moment it is most useful |
| `booked` | Owed |
| `paid` | Has left the account |
| `cancelled` | Counts nowhere |
| `refunded` | **Counts as zero and stays visible**, because a refunded booking is evidence and deleting the note would lose the reference the money came back under |

**An empty `amount` is not zero.** Null is a line nobody has priced yet; zero is
a line that was genuinely free. Same rule as an order's lines, and the same
consequence: a total over unpriced lines is null rather than zero.

**A booking is a record of what was charged**, which is why nothing recomputes
its figure from anywhere else, and why a price that changes later is a different
booking rather than an edit to this one's meaning.

---

## 7. Values that are not settings

Some values are fixed vocabulary, because the code keys off the exact strings.
Renaming a property is a vault's business; renaming these would be renaming the
code's own words.

| Vocabulary | Values |
|---|---|
| Weekdays in a plan entry | `monday` through `sunday`, always English |
| Meal slots | `breakfast`, `lunch`, `dinner`, `snack` |
| Leftovers tag | `leftovers` |
| Travel status | `Planned`, `Booked`, `Over`, `Cancelled` |
| Motif role | `main`, `secondary` |
| Accessibility | `full`, `partial`, `none`, `unknown` |
| Transit modes (offered, but read as free text) | `rail`, `bus`, `tram`, `boat`, `cablecar`, `foot`, `car` |
| Light windows | `blue-hour-morning`, `sunrise`, `golden-hour-morning`, `day`, `overcast`, `golden-hour-evening`, `sunset`, `blue-hour-evening`, `night` |
| Leg direction | `outbound`, `inbound` |
| Travel entity types | `trip`, `booking`, `country`, `state`, `city`, `accommodation`, `fnb`, `landmark`, `location`, `photospot` |
| Booking category | `transport`, `accommodation`, `activity`, `food`, `fees`, `other` |
| Booking status | `estimate`, `booked`, `paid`, `cancelled`, `refunded` |
| Cost unit, on a stop, a night or a leg | `total`, `person`, `night`, `personNight`; absent reads as `total` |

Light windows are English identifiers whatever the vault's language; only their
labels are translated. `overcast` deliberately has no clock window, because it
is the answer "any time, flat sky".

---

## 8. Formats still read but no longer written

CULItrail carries the most history, because it inherited a note format and then
changed it.

- **The plan checklist body.** Plans used to be `## Tuesday` headings over
  `- [x] [[Meal]] #meal/lunch [rating:: 5]` lines. Those are still read, and a
  note converts the first time anything writes to it. `[rating:: 0]` reads as
  eaten and unrated, which is what the magic zero meant before there was an
  `eaten` field. A slot on such a line is recognised in three notations: a tag,
  a Dataview field, or a trailing parenthetical.
- **Order selections version 1**, one flat property per person such as
  `selectionStefan`, collision-prone by construction, replaced by the
  `selections` list. Every save upgrades the note.
- **The `eatingHistory` frontmatter list**, read behind the plans so an
  unmigrated vault still shows its log, never written.
- **Three eating-history id markers**: `rb-id` from Recipe Box, `cul-id` from
  CULInode and `culi-id` today. All three are read; only the last is written.

The eating-history body section is merged rather than regenerated: a line whose
id matches a current record is rewritten in place, a line whose id is gone is
dropped, and **a hand-typed line with no id is left alone**.

---

## 9. Testing

The suites are small where the code is App-bound and thorough where it is pure,
which is the direct consequence of splitting every module into a pure half and a
vault-bound wrapper.

| Package | Test files | Tests, 3 September 2026 |
|---|---|---|
| core | 67 | 1542 |
| culitrail | 64 | 949 |
| apertrail | 55 | 706 |
| nodatrail | 77, of which 1 is skipped without a real vault | 780, of which 7 are skipped |
| the suite itself | 4 | 26 |

These are counted from a `npm test` run rather than estimated, and they go stale
the moment somebody adds a test. Re-read them off the run rather than trusting
the table.

Beyond ordinary unit tests, several tests exist to enforce rules that no single
file could enforce for itself:

| Test | What it refuses to allow |
|---|---|
| `package-boundary` (suite) | A package importing another package, in either direction |
| `obsidian-free` (core) | A core file importing Obsidian or touching the DOM |
| `crm-contract` (both plugins, and the core) | A plugin's CRM defaults drifting from the shared contract |
| `translation-keys` (both plugins) | A key present in one language table and not the other, or an orphan |
| `settings-coverage` (both plugins) | A setting with no control on the settings page, or without a stated reason for having none |
| `property-name-lock` (both plugins) | A property-name row that skips the lock |
| `stylesheet` (both plugins) | A class in two rules, a dead rule, a class the source sets and the sheet does not style, a physical inline offset |
| `vault-smoke` (nodatrail) | A reader that works against invented frontmatter and not against a real vault |
| `ui-conventions` (all three plugins) | A view querying the document for DOM it built itself, `innerHTML`, console logging, inline style assignment, a bare async event listener |
| `icon-slot` (all three plugins) | `setIcon()` aimed at a button element rather than at a slot inside one |
| `no-em-dash` (suite) | An em dash in a TypeScript comment, a translation string, a stylesheet comment or document prose, in any package |
| `settings-reference` (suite) | A setting with no row in its package's settings reference, or a row for a setting that no longer exists |
| `display-locale` (suite) | A plugin drawing a number or a date in the machine's convention: a core formatter called with no locale, `Intl` left to its own default, or a plugin not shipping the shared default |

Views, modals and settings pages are not unit-tested anywhere in the suite. They
are exercised by hand against a sample vault, and that is a deliberate trade
rather than an omission.

---

## 10. Build and delivery

```
npm install          # installs everything, and builds the core via its prepare
npm run check        # typecheck, lint and test every package
npm run build        # every package, but see the ordering caveat in 2.5
./scripts/install-into-vault.sh /path/to/Vault
```

Each plugin builds with esbuild into a single `main.js` beside its own
`package.json`, and the install script copies that `main.js`, `styles.css` and
`manifest.json` into `<vault>/.obsidian/plugins/<id>/`. It deliberately does not
build first, so what lands in a vault is whatever was last verified rather than
whatever compiles right now.

Two environment notes that have cost real time:

- A `node_modules` installed on macOS and then used in a Linux sandbox is
  missing the platform-specific native bindings for esbuild and rolldown. They
  have to be force-installed without saving, and again after any `npm ci`,
  because a platform-restricted optional dependency cannot be declared for both
  platforms in `package.json`.
- On a sandbox mount that forbids `unlink`, any git command that refreshes the
  index strands `.git/index.lock`, and the next command fails with "unable to
  write index file". Move the lock aside rather than deleting it, and do not run
  `git status` between clearing it and the command that needs the index.

---

## 11. How the plugins cooperate

```
                        packages/core (MIT)
              /                   |                   \
  packages/apertrail    packages/nodatrail
        (GPL)                (PolyForm)            (PolyForm)
              \                   |                   /
                     the shared CRM notes
                  CRM/People, CRM/Companies
```

**There is no runtime dependency between the plugins, in either direction.** No
plugin calls `app.plugins.getPlugin()`, imports a type from another, or decides
what to do by asking whether a sibling is enabled. The only occurrences of
`getPlugin` anywhere in `src/` are three comments saying there is no such call.

Section 1 says why that is not a matter of taste:
`tests/package-boundary.test.ts` fails the build on an import across a package
boundary, because CULItrail is GPL and the other two are not. What the plugins
do instead is the same three things every time, and the three together are the
suite's cooperation model.

### 11.1 The mechanism, in three parts

**One. The note format lives in the core, where the format needs code at all.**
`trail-core`'s `order/` holds an order note's shape, its filename parsing and
the arithmetic over its lines. A second plugin reads against that, and it is
MIT, so reading it carries no licence with it.

**Two. Each plugin writes its own reader over that format.** NODAtrail's
`finance/read-orders.ts` imports `parseOrderFilenameStem`, `OrderForMatching`
and the frontmatter readers from `trail-core`, walks the folder itself, and
imports nothing from CULItrail. Two readers of one format, never one shared
reader.

**Three. Names are adopted by reading the sibling's `data.json` off disk.** A
folder or a property somebody renamed is still found, because the reader asks
the plugin that owns the note what it calls things, and asks a file rather than
a running plugin. Section 5.3 has the boundaries that keep that safe.

That is the whole of it, and it is why a note written by one plugin stays
readable by another whether or not the plugin that wrote it is installed,
enabled, or present at all. The vault is the interface.

### 11.2 A cross-plugin read takes only what it needs

`read-orders.ts` takes four facts off an order note: company, date, price and
number. That is enough to match a card charge arriving weeks later to the order
that caused it, so a figure the vault already holds is not read off a statement
and typed in a second time. It does not read the selections, and the file says
why: what was actually eaten is CULItrail's business, and a ledger that read the
selections would be a ledger with an opinion about meals.

**A cross-plugin read is a contract about a few fields, not a licence to
understand the whole note.** The narrower it is, the less there is to break when
the note's owner changes something, and the easier it is to see that no licence
has been crossed.

### 11.3 When a format has to move into the core, and when it does not

Section 2.4 says a note format belongs in the core whatever the number of
readers. That test is about a **format module**, and not every note has one.

| | Order note | Booking note |
|---|---|---|
| Shape | nested `selections` and `items`, a number that exists only in the filename, a total two readers must agree on | flat scalars and lists of links |
| Has format code to share | yes, `packages/core/src/order/` | no |
| A second plugin reads it with | that module | the core's generic `readString`, `readNumberLike`, `wikilinkTarget` |

So APERtrail's booking note **stays in APERtrail**, and that is this rule
applied rather than an exception to it. A note whose every field is a scalar or
a link has nothing to promote: the generic readers already read it, and part
three of the mechanism supplies the names. Moving the file would change nothing
about what either plugin could do.

**The condition that reopens the question is already written down**, in
`packages/apertrail/CLAUDE.md`, where it was recorded for a different reason: a
booking note carries no fenced block and needs none, because every field on it
is flat, and if a field ever needs a list of maps that decision is being
reopened. The same sentence settles this one. A booking note with a nested field
is a booking note with a format, and a format a second plugin reads belongs in
the core.

### 11.4 What was considered and left out

**A single total-spending figure across all three plugins.** It would couple
three plugins through the vault to answer a question each already answers about
its own domain. Reading a sibling's notes for four fields is not the same thing
and does not lead there.

---

## 12. Known divergences and leftovers

Stated here rather than left to be discovered:

1. *(Closed 30 August 2026.)* **Many of APERtrail's vault-facing settings have
   no settings-page row, and it was the one package with no `settings-coverage`
   test.** Every one of them is a `*Field` sub-key inside a list entry, never a
   top-level property of a note, which is the line described in section 6.9:
   they are real settings, honoured by the reader, the writer and the validator,
   and editable only in `data.json`. What made it a divergence was that the line
   was held by hand there and by a test in the other two. APERtrail now carries
   `settings-coverage` as well, and draws the line **by rule rather than by
   list**: a sub-key is exempt from a row, and the second test checks that every
   exempt sub-key is genuinely honoured, so a dead one is deleted rather than
   excused.

   What none of the three checked was the **settings reference**, which is a
   different claim: not "can this be reached" but "is it written down". It had
   silently lost eight APERtrail settings and never gained two more.
   `tests/settings-reference.test.ts` in the suite now requires a row for every
   setting and a setting for every row.
2. **Adoption is one-directional and once-only.** APERtrail adopts from nobody;
   CULItrail and NODAtrail adopt on a fresh install only. Two plugins in a
   long-lived vault can therefore disagree about a setting that was changed
   later in one of them.
3. **The company terms have one reader.** They stay in CULItrail until APERtrail
   grows a purchasing side, at which point the two-consumer test applies to
   them. The order format is not the precedent to follow here: that is in the
   core as a note format, and a discount ladder is not one.
4. **The root `npm run build` builds the packages in the wrong order.**
   `npm run build --workspaces` visits them in the order npm resolves the
   workspace graph, which on 29 August 2026 was **apertrail, trail-core,
   culitrail, nodatrail**: one plugin ahead of the core. The order is npm's to
   choose and is not stable, so naming a particular plugin here is a mistake the
   documents have already made once.
   The script only works because `npm install` has already built
   `packages/core/dist/` through the core's `prepare`. On a tree whose `dist/` is
   missing or stale, whichever plugin comes first fails its typecheck with
   `Cannot find module '@technosoftware/trail-core'`. The workaround is
   `npm run build --workspace packages/core` first; the fix is to order the root
   script, and it has not been made.
5. **`packages/apertrail` ships `sync-version.js` but no `version` script to
   run it.** CULItrail's `package.json` wires the two together as
   `"version": "node sync-version.js && git add manifest.json"`, so `npm version`
   there keeps `manifest.json` in step with `package.json`. APERtrail carries the
   same script file and no such wiring, so its `manifest.json` version has to be
   bumped by hand.
6. **NODAtrail's folder seeding prefers a folder the vault already has**, and
   the other two do not. Where a localised default is absent and the English one
   is present, NODAtrail seeds the English one. That rule exists because a
   German-language install into an English-foldered vault would otherwise find
   nothing while looking perfectly configured, and it belongs in the other two
   plugins as well. It has not been added to them.
7. **Two of the four `CHANGELOG.md` files are now load bearing.** NODAtrail and
   CULItrail were frozen at 0.1.0 on 29 August 2026 and tagged
   `nodatrail-v0.1.0` and `culitrail-v0.1.0`, so from here their entries are
   history rather than a draft and the vault promise at the top of each file is
   a promise to somebody. `trail-core` and APERtrail still record only an
   unreleased 0.1.0, which is correct: the core is not distributed on its own
   and APERtrail is where the feature work moves next.
8. *(Closed 31 August 2026.)* **The no-em-dash rule was enforced in two
   packages of four.** `core` and `apertrail` had no copy and were kept clean by
   hand, which held until an em dash reached a German editor description and a
   `styles.css` comment. Two packages enforcing a house rule is not a house
   rule, so the check moved to `tests/no-em-dash.test.ts` in the suite, beside
   the licence boundary, and the two package copies are gone. Packages are read
   from disk, so a fifth is covered the day it exists. It gained two sweeps the
   package versions never had: **every string in a translation table**, which is
   the one place a string literal is prose somebody reads and is what the
   carrier description slipped through; and **stylesheet comments**, which no
   package copy looked at.
9. *(Closed 26 August 2026.)* **Fourteen APERtrail classes were set by the
   source and styled nowhere.** Twelve were structural hooks -- modal roots,
   wrapper divs, a cancel button -- and were **deleted rather than styled**,
   which is the convention the other two packages keep by having nothing to
   exempt: a class goes on an element in the same edit that gives it a rule. The
   other two were never classes, but the `id` of a `<datalist>` an input points
   at, and are now named as such in the test. `UNSTYLED` is empty and the
   package styles every class it sets.
10. *(Closed 3 September 2026.)* **Three vault-reading suites, three mechanisms,
    and no vault in the repository.** All three plugins now ship a seeder
    instead: a `sampleNotes()` function in the package, planned by
    `trail-core`'s `planSampleVault` and written by a **Create the sample
    notes** command, and a `tests/sample-vault.test.ts` that seeds a fake vault
    and reads it back through the real parsers. Sixteen notes for APERtrail,
    fifteen for CULItrail, twenty-three for NODAtrail. **None of the three
    suites skips**: there is no folder to have, so `CULITRAIL_SAMPLE` is gone
    and a change that breaks a sample note goes red on every run rather than on
    one machine. Only `vault-smoke` still reads a real vault behind
    `NODATRAIL_VAULT`, which is what it is for -- it checks the shapes a
    long-lived vault actually holds, which is a different question from the one
    the seeders answer.

    It is worse than three mechanisms, because a vault has a language. The only
    vault any of this has ever been run against is German, and `vault-smoke`
    read the shipped English defaults until 26 August 2026 -- so it resolved
    every folder to a path that does not exist and six of its seven tests passed
    over nothing. It now reads that vault's `data.json` through
    `mergeSettings()`, which is the same path the plugin loads.

    **The intended fix is a generator, not a checked-in vault**: a function per
    plugin that builds a sample vault in either language, from that plugin's own
    defaults and localised folder names. A vault built from the defaults cannot
    drift from them, it can be built in both languages so the German-only blind
    spot cannot come back, and it makes the suites run on a clone rather than
    skip. It also removes the sample-vault pages' standing problem, which is
    that they describe a folder tree nothing verifies. **Built**, with one
    departure: the folders and property names are localised, and the note
    content is English in every vault, because it is product material rather
    than an interface.

11. **`Belege ohne Notiz suchen` was scaffolding with an end date, and it
    reached it.** It scanned the vault for documents no note pointed at, which
    was the right tool while a backlog of PDFs was being filed by hand and the
    wrong shape once every document entered through the invoice form. It also
    could not answer the question a person actually has in front of an unfiled
    PDF, which is *which* invoice it belongs to. Removed on 29 August 2026, on
    the terms this entry set out: the vault's backlog is filed, documents now
    arrive through the form, and nothing is stored by hand any more. Gone with
    it: the filename guesser and its `billDocumentFolders` setting. The reverse
    question, which invoices have no document, is still answered on the cards by
    the absence of the button and still has no list of its own.

    The gap this entry used to sit beside is closed as well. `document` was a
    single path, so an invoice that arrived as a covering letter plus a
    statement had nowhere to put the second file, and the scan finding the
    orphan was the workaround. The property is list-valued now, which is why the
    workaround could go.

12. **NODAtrail has no mobile stylesheet rules.** Zero `is-mobile` rules against
    CULItrail's sixteen and APERtrail's three, and one media query. Measured 26
    August 2026, and deliberately **not** acted on: screenshots from a real iPad
    showed the dashboard, the finance list and the ledger toolbars all behaving,
    because they are grid and flex with `overflow-x` rather than the fixed
    widths and hover affordances CULItrail's rules exist for. The count is a
    place to look, not a defect. What the screenshots did not cover is a modal
    footer under a narrow width.
