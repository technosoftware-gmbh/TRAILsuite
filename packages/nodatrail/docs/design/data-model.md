# Data model

Every name below is the **default**, and every one of them is a setting whose
key is given so it can be found in `data.json`. Shapes: *link* means a wikilink
such as `"[[Gesundheit]]"`, *list* a YAML list, *date* a `YYYY-MM-DD` day,
*stamp* the `YYYY-MM-DDTHH:mm` form.

Where a note's **format** lives in `trail-core` rather than here, it is marked.
The feature is still NODAtrail's; what is shared is the shape of the note.

## Shared by every note NODAtrail writes

| Property | Setting key | Meaning | Shape |
|---|---|---|---|
| `type` | `typePropertyName` | Which kind of note this is | string |
| `created` | `createdProperty` | Written once at creation, never backfilled | stamp |
| `modified` | `modifiedProperty` | Rewritten on every edit of an existing note | stamp |

**Four stamp shapes are read and one is written.** `2026-08-04T14:05` is what
NODAtrail writes. `'[[2026-07-14]]'`, `2026-07-25 - 04:50 pm` and a bare
`2026-07-14` are read as well, because a vault written before this suite existed
holds all three. A note converts to the suite shape the first time NODAtrail
writes to it and never before.

## Area (`type: area`)

| Property | Setting key | Meaning | Shape |
|---|---|---|---|
| `image` | `imageProperty` | Hero image | string |
| `icon` | `iconProperty` | Icon id, as the icon-folder plugin writes it | string |
| `priority` | `priorityProperty` | Ordering, low number first | number |
| `archived` | `archivedProperty` | The day it was archived | date |

**No status on an area.** An area is a standard to be maintained rather than an
outcome to be reached, and an area with a status is a project wearing the wrong
hat.

## Goal (`type: goal`)

| Property | Setting key | Meaning | Shape |
|---|---|---|---|
| `area` | `goalAreaProperty` | Which area it serves | link |
| `status` | `goalStatusProperty` | See the status vocabulary below | string |
| `priority` | `priorityProperty` | | number |
| `deadline` | `deadlineProperty` | The day it must be reached by | date |
| `achieved` | `achievedProperty` | The day it was reached | date |
| `closed` | `closedProperty` | The day it was accepted and closed | date |
| `archived` | `archivedProperty` | The day it was archived | date |

## Project (`type: project`)

| Property | Setting key | Meaning | Shape |
|---|---|---|---|
| `goals` | `projectGoalsProperty` | The goals it advances | list of links |
| `area` | `projectAreaProperty` | Optional. Overrides the derived area | link |
| `status` | `projectStatusProperty` | See the status vocabulary below | string |
| `priority` | `priorityProperty` | | number |
| `deadline` | `deadlineProperty` | The day it must be finished by | date |
| `completed` | `completedProperty` | The day the work was finished | date |
| `closed` | `closedProperty` | The day it was accepted and closed | date |
| `archived` | `archivedProperty` | The day it was archived | date |

**A project's area is derived through its goals and never written back.** The
project points at a goal and the goal points at an area, so moving a goal to
another area re-files every project under it without touching a project note.
The optional `area:` exists for a project that serves no goal, and an explicit
value always wins.

**A project is a folder.** The note lives in a folder named after it, and
anything belonging to the project -- its `_resources/` image, its `_documents/`
-- lives beside it. Archiving moves the folder whole. A grouping folder
somebody made by hand (`3 Projekte/Fotografie/`) keeps working, because
`isUnderFolder` recurses.

### The picture, and the one a project inherits

`image` holds a vault path or a wikilink and is written only when somebody
chooses one. A project that carries none falls back to a picture in the projects
folder's image subfolder named by the `projectDefaultImageName` convention:
`Default` claims every project, `CN-Default` claims those whose title starts with
`CN-`, and the longest matching prefix wins.

**The fallback is never written into the note.** It is resolved on every draw,
which is what keeps one file the single answer for a whole family; writing it
back would make fifteen copies of it. It is the same rule as the derived area
one line above.

**A note whose own `image:` does not resolve does not fall back.** It shows the
missing panel with the value it carries, because a path that resolves to nothing
is usually an attachment that moved, and a family default shown in its place
would hide that behind something that looks deliberate.

### The five dates, and why they are fields

`created` is stamped at creation, the four below are typed. Setting a status
**fills** the date that status is the record of and shows it on the form to be
corrected; it does not write it silently. The day of the action and the day of
the record routinely differ -- a project finished on Friday has its status moved
on Monday -- and a plugin that assumed otherwise would file the week wrong.
`archived` is the exception: archiving is an act with a day of its own and
nothing else records it.

### Status vocabulary

`backlog`, `planned`, `ongoing`, `blocked`, `done`, `review`, `closed`,
`removed` -- one vocabulary for goals and projects alike. Everything new is
written as `backlog`: written down, not yet decided on.

**Older words are read and never written.** `paused` reads as `blocked`,
`completed` and `achieved` as `done`, `dropped` as `removed`. The map is
read-only on purpose: no note was rewritten to introduce the new vocabulary, so
a vault written before it still opens, and a note only converts when somebody
saves it.

**The status is what decides whether a project is finished**, not the presence
of a date. The two used to be able to disagree.

## Resource (`type: resource`)

| Property | Setting key | Meaning | Shape |
|---|---|---|---|
| `area` | `resourceAreaProperty` | Optional | link |
| `topic` | `resourceTopicProperty` | Free-text grouping | string |
| `source` | `resourceSourceProperty` | Where it came from | string or URL |
| `tags` | `resourceTagProperty` | | list |

Thin on purpose. A reference note that demands eight properties before it can be
filed is a reference note nobody files.

## The summary block

The one part of a PARA note that is **body text rather than a property**. It is
what the note is about, in a sentence or two, and it sits at the top:

```
---
type: project
status: ongoing
---

---

> [!SUMMARY]+
> Automatic Reconstitution of PT Rec not triggered after upgrade to SW 2.5.0
> even though the liquid volume was below the minima defined.
```

A `---` rule under the frontmatter, a blank line, then a `SUMMARY` callout. The
shape was not designed: it is what was already being written by hand in the
vault, and the plugin reproduces it so that a note the dialog makes and a note
somebody made are the same file.

**Not a property, deliberately.** A summary is prose that runs to several lines
and wants to be read where the note is read, not squeezed into a YAML value
where a colon or a line break would have to be escaped.

**`SUMMARY` is not a setting and not translated.** It is one of Obsidian's own
callout keywords; a German note carrying `[!ZUSAMMENFASSUNG]` renders as an
unknown callout. The label on the form is what gets translated.

The whole block is `trail-core`'s now (`markdown/summary-block.ts`, built on
`markdown/callout.ts` beside it), on the note-format test: APERtrail's trips
carry the same block, and one vault holds both. `para/summary-file.ts` keeps
the half that needs an `App`.

**This is the only place a PARA dialog writes a note's body**, and what that
write may touch is narrow: the block's own lines and nothing else, with the
frontmatter split off first so a property whose value opens with `>` is not read
as a callout. A summary that has not changed is not written at all. A form whose
read of the note failed does not open, because a box that came up empty for a
body nobody had read would erase the summary on save.

## The archive

**Archiving is a move, not a property.** A note goes into
`6 Archive/<Category>/<Year>/` and gains an `archived:` stamp; its `type` is
unchanged. The active readers stop seeing it because they read a different
folder, which is why no view needs a special case. The year comes from
`archiveYearFolders` and is on by default, because a category folder that only
ever grows is one nobody opens twice; it costs the readers nothing, since
folder matching recurses and the archive read still names one folder.

The stamp is written, unlike every other derived value here. It is not derived:
the folder says *that* the note was archived and the stamp says *when*, and the
when is not recoverable from anywhere else.

A project moves as a folder, and its `image:` is rewritten when it pointed
inside the folder that moved.

## Period notes (`type: day` / `week` / `month` / `quarter` / `year`)

Paths are templates, one setting each. Tokens: `{YYYY}` `{MM}` `{DD}` `{GGGG}`
`{WW}` `{Q}`.

| Level | Setting key | Default |
|---|---|---|
| Day | `dailyPath` | `0 Plan/1 Daily/{YYYY}/{YYYY}-{MM}-{DD}.md` |
| Week | `weeklyPath` | `0 Plan/2 Weekly/{GGGG}/{GGGG}-W{WW}.md` |
| Month | `monthlyPath` | `0 Plan/3 Monthly/{YYYY}/{YYYY}-{MM}.md` |
| Quarter | `quarterlyPath` | `0 Plan/4 Quarterly/{YYYY}/{YYYY}-Q{Q}.md` |
| Year | `yearlyPath` | `0 Plan/5 Yearly/{YYYY}.md` |

`{GGGG}` and `{WW}` are the ISO week-year and week number, deliberately not
`{YYYY}` and a week number: the calendar year and the ISO week-year disagree at
a year boundary, so a week note filed under `{YYYY}` is filed under the wrong
year for one week in most years.

**There is no navigation block.** Period notes used to open with two generated
lines, the chain upwards and the siblings either side. The Plan view navigates
between periods itself, so the block was obsolete; it was stripped from the 87
notes that carried it, content untouched, and is no longer written.

The body is the headings a day note is captured into -- Focus, Schedule,
Thoughts -- plus whatever somebody types. Each is a setting, `dayFocusHeading`,
`dayScheduleHeading` and `dayNotesHeading`, and each is blank as shipped: blank
is not "no heading", it is "the heading this vault's language calls it". A
heading is recognised in either language and written in the current one, so
changing Obsidian's language under a note does not orphan what is already in
it, and does not write a second heading beside the first.

## Purchase (`type: purchase`) *(format in the core)*

Filename `20260604_baloise_1040269824.md`: the day, the company and the vendor's
own reference. Derived rather than asked for, because all three are already
known by the time the note is made and asking somebody to invent a title on top
of them sorts the folder by whatever mood each title was typed in. A typed title
still wins, and emptying the field hands the derivation back.

**The reference is a property, with the filename as a fallback.** It used to
live in the name alone, on the argument that one place cannot disagree with
itself. That held while the name was `yyyy-mm-dd-reference` and stopped holding
once the name carried the company as well: reading a reference back out would
mean guessing where a company name ends, and a company with a hyphen in it would
quietly acquire the wrong order number.

| Property | Setting key | Meaning | Shape |
|---|---|---|---|
| `company` | `purchaseCompanyProperty` | The vendor, in `CRM/Companies` | link |
| `area` | `purchaseAreaProperty` | Which area the money came out of | link |
| `project` | `purchaseProjectProperty` | Optional | link |
| `category` | `purchaseCategoryProperty` | See below | string |
| `status` | `purchaseStatusProperty` | `ordered`, `delivered`, `returned`, `cancelled` | string |
| `orderDate` | `purchaseDateProperty` | Wins over the filename | date |
| `deliveryDate` | `purchaseDeliveryDateProperty` | | date |
| `amount` | `purchaseAmountProperty` | The stated total, gross | number |
| `currency` | `purchaseCurrencyProperty` | | string |
| `discount`, `shipping` | | Off and onto the whole purchase | number |
| `vatRate`, `vatAmount` | | Stated only; nothing is computed from them | number |
| `items` | `purchaseItemsProperty` | The lines | list of maps |
| `document` | `purchaseDocumentProperty` | The invoice, wherever it lives | string or list |
| `reference` | `purchaseReferenceProperty` | The vendor's own order number | string |
| `bill` | `purchaseBillProperty` | The bill note that settles it | link |

A line carries `name`, `price`, `quantity`, `discount` and `note`, under five
`*Field` settings. `name` is free text rather than a link, which is the one real
difference from a meal order: the thing bought is usually not a note and must
never have to become one first.

**Every price is gross**, the same claim CULItrail's order notes make. And **the
stated total wins over the computed one, always**: the note is a record of what
was charged, and the figure derived from the lines is what the health check
compares against rather than what a budget spends.

## Bill (`type: bill`) *(format in the core)*

| Property | Setting key | Meaning | Shape |
|---|---|---|---|
| `company` | `billCompanyProperty` | The other party: a Company **or a Person** note | link |
| `direction` | `billDirectionProperty` | `incoming` or `outgoing`. Absent means incoming | string |
| `area` | `billAreaProperty` | | link |
| `category` | `billCategoryProperty` | | string |
| `amount`, `currency` | | | number, string |
| `issueDate` | `billIssueDateProperty` | | date |
| `dueDate` | `billDueDateProperty` | | date |
| `paidDate` | `billPaidDateProperty` | Presence is what "paid" means | date |
| `reference` | `billReferenceProperty` | Invoice or QR reference | string |
| `document` | `billDocumentProperty` | The paperwork, where it already is | string or list |
| `recurring` | `billRecurringProperty` | The standing charge it came from | link |
| `purchase` | `billPurchaseProperty` | The purchase it settles | link |
| `status` | `billStatusProperty` | Optional override | string |
| `account` | `ledgerAccountProperty` | The expense or income account it belongs to | number |
| `paidFrom` | `paidFromProperty` | The asset account the money left, or landed in | number |
| `lines` | `billLinesProperty` | An invoice divided across several accounts | list of maps |

`account`, `paidFrom` and `lines` are what a bill hands the ledger when it is
settled. A split line carries `account`, `amount` and `note`, under
`billLineAccountField`, `billLineAmountField` and `billLineNoteField`; the lines
are the more specific claim about where the money went, so where they exist they
win over the single `account`.

**`company` may name a person.** It holds a wikilink and nothing checks which
folder it resolves into, so a tradesman or a tutor who invoices the household is
named the same way a company is. The property keeps the name `company` because
the name is a setting -- `billCompanyProperty` -- and a vault that would rather
call it `counterparty` renames it in the settings page without any code
changing. A person note learns `account` and `category` on exactly the terms a
company note does. Where a Company and a Person note share a title the company
wins, in the picker and in the defaults lookup alike, and those two orders are
pinned by a test because a disagreement would read the defaults off one note and
write the corrected ones back to the other.

**One note type carries invoices in both directions**, and every difference
between them is a value rather than a shape. An incoming bill is a
Kreditorenrechnung, an outgoing one a Debitorenrechnung; `company` is the vendor
or the customer, `account` is an expense or an income account, and `paidDate` is
the day the household paid or the day the customer did.

**`direction` is written only when it is `outgoing`.** Every bill written before
this property existed is an incoming one, so the absent value has to mean the
common case or the day it shipped is the day a vault's invoices changed meaning.
It also keeps the diff on existing notes empty. `packages/nodatrail/docs/design/sales-invoices.md`
is the design and records what was decided against, including why there is no
Debitoren control account.

**An invoice reaches the ledger only when it is settled**, as one posting
between the bank account and the expense or income account. Nothing is posted
when it arrives or is sent, in either direction. What is owed and what is owing
live in the bill notes, and the finance tab totals them.

**`document` holds one path or a list of them.** A single document is written as
a plain string, several as a list, and both read back as a list: an invoice with
a reminder and a receipt behind it is common enough that forcing one path per
note would mean losing two of the three. The path is not parsed, so a comma in a
filename is a comma in a filename.

**The status is derived and only `cancelled` is stored.** `paid` follows from a
paid date, `overdue` and `due` from the due date and today, with the window set
by `billDueSoonDays`. Cancellation is the one state no date can express, which
is the whole reason the property exists.

**A bill's money belongs to the month it was due in**, not the month it was
paid. A bill paid late still belongs to the month somebody budgeted it in.

## Recurring cost (`type: recurring`) *(format in the core)*

| Property | Setting key | Meaning | Shape |
|---|---|---|---|
| `company`, `area`, `category` | | | link, link, string |
| `amount`, `currency` | | What one occurrence costs | number, string |
| `cadence` | `recurringCadenceProperty` | `weekly`, `monthly`, `quarterly`, `semiannual`, `annual`, `once` | string |
| `interval` | `recurringIntervalProperty` | Every N cadences, omitted when 1 | number |
| `startDate` | `recurringStartProperty` | What the cadence counts from | date |
| `endDate` | `recurringEndProperty` | Empty means open ended | date |
| `status` | `recurringStatusProperty` | `active`, `paused`, `ended` | string |
| `document` | `recurringDocumentProperty` | The contract | string or list |
| `reference` | `recurringReferenceProperty` | The policy or contract number, which every occurrence shares | string |
| `account` | `recurringAccountProperty` | The account every occurrence is booked to | number |

**It projects occurrences and never writes a bill note.** The projection is
redone on every render, so correcting the amount corrects every projected month
at once. Turning one occurrence into a bill is a command somebody runs.

A monthly charge anchored on the 31st falls on the 28th in February and back on
the 31st in March: the step is always computed from the original day.

## Budget (`type: budget`) *(format in the core)*

| Property | Setting key | Meaning | Shape |
|---|---|---|---|
| `period` | `budgetPeriodProperty` | `2026`, a bare year and nothing else | string |
| `currency` | `budgetCurrencyProperty` | | string |
| `lines` | `budgetLinesProperty` | The plan, one line per account | list of maps |

A line carries `account` (a number), `amount`, `rhythm`, `month`, `note` and
`months`, under six `*Field` settings.

**A budget is keyed to accounts and planned by rhythm.** A budget that is yearly
only cannot be checked, because nobody lives a year at a time; a budget asking
for twelve figures against each of fifty accounts is six hundred numbers a year,
which is a different way of going unused. Almost every household cost has a
rhythm instead -- electricity monthly, the water bill quarterly, the car
insurance once in March -- so a line states one amount and its `rhythm`, and the
twelve monthly figures are derived from it. Fifty numbers a year, and a month
that can still be held up against what was spent.

`rhythm` is `weekly`, `monthly`, `quarterly`, `semiannual`, `annual` or `once`.
A weekly amount is **spread rather than counted**: four weeks fall in some
months and five in others, and a budget that swung by a fifth depending on how
the weekdays landed would be noise, so a weekly line contributes
`amount * 52 / 12`
every month and the year still comes out exactly right. `month` is which month a
rhythm that skips months first falls in, and `months` maps a month number to the
figure that replaces whatever the rhythm implies, for where reality departs from
it: the premium that rises in July, the month the holiday falls in. Nobody has
to use them, and a line with none behaves exactly as its rhythm says.

**One note a year**, because the rhythm is what makes the months. `2026-08` is
refused as a period rather than read as 2026: a note whose period names a month
was written under the older shape, and accepting it would let a note with no
readable lines present itself as the year's budget and report a plan of nothing,
which reads exactly like a year nobody has budgeted yet.

`lines` is **written even when empty**, the only property here with that rule,
because an empty list is how the note says "this year is budgeted and holds
nothing" rather than "this note has not been filled in".

**A line naming no account is dropped**, rather than kept as a catch-all. The
whole point of keying a budget to accounts is that every figure has somewhere to
be measured; a line naming nothing can never be measured at all.

**What no line claimed is shown, not hidden.** An expense account with spending
on it and no budget line is the most interesting row on the page, so it appears
as unbudgeted. A report that quietly left it out would be a report that
flatters.

**This replaced a budget keyed to an area and a category**, which measured
itself against the bill, purchase and recurring notes. Two budget systems in one
plugin would be two answers to "am I over budget", and once every payment
produces a posting the account version is strictly the better of the two: it
measures what actually moved rather than what the paperwork implies.

## Account (`type: account`) *(format in the core)*

The chart of accounts, one note each, under `accountsFolder`, default
`Finance/Accounts`.

| Property | Setting key | Meaning | Shape |
|---|---|---|---|
| `number` | `accountNumberProperty` | Unique, and the sort order wherever accounts are listed | number |
| `kind` | `accountKindProperty` | `asset`, `liability`, `income` or `expense` | string |
| `group` | `accountGroupProperty` | Where it sits under its section, `Gemeinsame Kosten/Renault Twingo`, or empty for directly under it | string |
| `currency` | `accountCurrencyProperty` | | string |
| `opening` | `accountOpeningProperty` | What the account held before the first posting this vault knows about | number |
| `openingDate` | `accountOpeningDateProperty` | The day that opening balance is true as of | date |
| `closed` | `accountClosedProperty` | The day it stopped being used. Reported on, never refused | date |
| `iban` | `accountIbanProperty` | | string |
| `bankAccount` | `accountBankNumberProperty` | Whatever number a statement prints when it prints no IBAN | string |
| `person` | `accountPersonProperty` | Whose account it is; empty for a shared one | link |

**Four kinds, and equity is not one.** Assets and liabilities are the balance
sheet, income and expenses the income statement, and there is no fifth thing a
household account can be. Equity is what is left over, and computing it is
cheaper than asking somebody to maintain it.

The whole of double entry that the rest of the code has to know is which kinds
increase on the debit side: `asset` and `expense` do, the other two do not.

**`iban` and `bankAccount` are not decoration.** They are the one thing that
lets an imported statement line naming an account resolve to an account note. A
transfer between two of the household's own accounts prints the other account's
number, and without these it is only text -- which is how one movement gets
booked twice, once from each end.

**A posting dated before the opening date is still counted.** The opening
balance is a statement about a day, not a floor under the ledger.

**Balances are computed, never stored**, like everything else derived here.

## Journal (`type: journal`) *(format in the core)*

Postings do not get a note each. A household writes a couple of thousand a year,
and one note apiece would make every folder listing and the metadata cache
useless for the sake of a note holding one line. They live in a fenced block
inside **one note per month**, titled `YYYY-MM`, under `journalFolder` plus
`journalSubfolder`, default `Finance/Journal/{YYYY}`.

The note carries nothing beyond the shared header. Everything is in the block:

````
---
type: journal
created: 2026-08-25T11:17
---

# 2026-08

```noda-journal
2026-08-04 | 4000 | 1005 | CHF 105.84 | TomTasty | 33698
2026-08-11 |  | 2010 | CHF 881.25 | Cornercard | 2112644264
    4008 | 101.79 | Sollzinsen aus der vorhergehenden Rechnung
    4000 | 105.84 | TomTasty #32940
```
````

**The fence language is `noda-journal`, not `nod-`.** It is the one exception to
this plugin's prefix rule, because the name is not NODAtrail's to choose: the
parser is `trail-core`'s and `JOURNAL_LANGUAGE` is where it is spelled.

A line is pipe separated: **date, debit account number, credit account number,
amount with its currency, free text, and an optional reference** to the bill or
purchase it settles. The amount is read tolerantly, because people write numbers
differently: `1'234.50`, `1,234.50` and `1234,50` all read the same. What it
will not do is guess beyond those, because a ledger that guessed at a decimal
point would be off by a hundred.

**A split is a header line plus indented legs, and the side the legs fill is
left blank on the header.** Above, the credit is 2010 and each leg supplies its
own debit. The parser expands the continuations rather than inventing a nested
shape, so everything downstream sees one flat list; `readSplit()` recovers the
written shape by finding which side is constant and which varies. A split whose
legs do not sum to its header is reported and dropped rather than posted.

**Debit and credit name account numbers, not accounts.** A journal is parsed
before the chart is necessarily known, and a posting naming an account that does
not exist has to survive long enough to be reported.

**When two accounts are kept in different currencies, both figures are written**,
because inventing a rate later is inventing history:

```
2026-07-11 | 1001 | 1005 | EUR 200.00 = CHF 189.60 | Bargeld Ferien
```

There is no rate table and nothing is fetched. A rate is written on the posting
that used it, or it is not known.

**Nothing in the parser throws.** A journal is typed by hand, and one
fat-fingered line must not take the other two hundred down with it. Every
unreadable line comes back as a problem carrying its line number, and the
postings that could be read are still returned.

A posting whose date cannot be read is refused rather than filed under the wrong
month. And where a note has lost its fence, one is appended rather than the
posting being dropped: a note that silently swallowed a posting would be the
worst failure available here.

## Values that are not settings

Fixed vocabulary, because the code keys off the exact strings.

| Vocabulary | Values |
|---|---|
| Goal and project status | `backlog`, `planned`, `ongoing`, `blocked`, `done`, `review`, `closed`, `removed` |
| Status words read but never written | `paused`, `completed`, `achieved`, `dropped` |
| Priority | `critical`, `high`, `medium`, `low`, stored as 1 to 4 |
| Purchase status | `ordered`, `delivered`, `returned`, `cancelled` |
| Bill status | `open`, `due`, `overdue`, `paid`, `cancelled` |
| Recurring cadence | `weekly`, `monthly`, `quarterly`, `semiannual`, `annual`, `once` |
| Recurring status | `active`, `paused`, `ended` |
| Account kind | `asset`, `liability`, `income`, `expense` |
| Task state | the checkbox characters ` `, `x`, `/`, `-` |
| Callout kind | `SUMMARY`, an Obsidian keyword rather than a setting |

**A PARA note's priority is stored as the number that also orders it.** A note
carrying a number outside 1 to 4 is offered as that number rather than as a
level it is not: a vault may rank a few notes by hand instead of grading them,
and choosing nothing has to leave such a note exactly as it was.

This used to say the reference vault's eight areas were numbered 1 to 8. They
are not. The **folder names** carry that sequence, `1 Gesundheit` through
`8 Beruf`, while the `priority:` values are 1, 2, 2 and 4 -- every one of them
inside the four levels. The rule is right and the evidence for it was a misread
folder listing.

**Expense categories are not among them.** They are a configurable list of ids
with translated labels, and an id the list does not know is kept and shown
exactly as written. A household's categories are genuinely personal, and nothing
in the code keys off a particular one. They group and filter what is spent; what
a budget measures against is the account, not the category.

The shipped ids: `housing`, `utilities`, `insurance`, `health`, `transport`,
`food`, `household`, `leisure`, `education`, `tax`, `fees`, `savings`, `gifts`,
`other`.

## Tasks

A task is a **checkbox line inside a note**, in the Obsidian Tasks format. That
format is not this suite's, which is exactly why the parser is in `trail-core`
rather than in a view.

```
- [ ] Steuererklärung einreichen 🔺 📅 2026-09-30 ⏳ 2026-09-01 #steuern [[Steuern 2025]]
```

Read: the checkbox state, the text, priority, due, scheduled, start, done,
created, cancelled, recurrence, the tags and the wikilinks.

Written: the state and the done date when somebody ticks a box; the priority,
the due date and the scheduled date when somebody moves or edits a task from a
NODAtrail view; and a whole line when a task is captured into a day note. The
line is rewritten in place with everything else preserved byte for byte.

**A deadline and a plan are different facts.** `📅` is when a task must be
finished, `⏳` the day somebody decided to do it. Moving a task to a day sets
the plan, moving it to a period sets the deadline and clears the plan -- which
is what lets a deadline survive being replanned twice in a week. Where both are
present the plan is what places the task.

Where it looks is `taskFolders`, defaulting to the Plan, Areas, Goals and
Projects folders. Deliberately not the whole vault: a shopping list inside a
meal note is not a life task.
