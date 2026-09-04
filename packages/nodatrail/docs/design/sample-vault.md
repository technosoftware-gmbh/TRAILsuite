# The sample vault

> **Status: built, and it was never anything else.** NODAtrail is the one plugin
> of the three that never described a sample vault as a folder sitting beside the
> repository, so this page has nothing to correct. It documents the command as
> shipped: `Create the sample notes` writes twenty-three notes into whatever
> vault is open. The content is `sampleNotes()` in `src/sample/notes.ts`, the
> planning is `trail-core`'s (`planSampleVault`), the vault read is
> `src/sample/read-folders.ts`, the write is `src/sample/write.ts`, and the
> preview dialog is `src/sample/ui/sample-vault-modal.ts`.

The fastest way to see the Plan view, the PARA board, the Finanzen list, the
budget page and the ledger with something real in them, without typing anything.
It is also the layout the folder defaults are named for: if a default path in
[Settings reference](settings-reference.md) looks arbitrary, this is why it is
what it is.

Everything in the notes is English. **The note content is never translated**,
only the command name, the modal's labels and its notices. The one thing that
does follow the vault's language is the day-note headings, for the reason under
[Keeping it honest](#keeping-it-honest).

`tests/sample-vault.test.ts` asserts every claim on this page by seeding a fake
vault and reading it back through the parsers that will read it in production --
`readParaBoard`, `readSchedule`, `readTasks`, `readFinanceBoard`, `readLedger`,
`readBudgets`, `measureMonth`, `readCrmBoard`, and the core's own `readSummary`
and `readSplit`. It runs unconditionally: there is nothing to skip, because the
notes are a function in this package rather than a folder somebody has to have.

## What gets written

```
0 Plan/
  1 Daily/{YYYY}/           5   Monday to Friday of the week the seed date falls in
  3 Monthly/{YYYY}/         1   the month the seed date falls in
1 Areas/                    1   Household
2 Goals/                    1   Close the books every month
3 Projects/
  Move the household to double entry/
                            1   Move the household to double entry.md
4 Resources/                1   Double entry in one page
Finance/
  Purchases/{YYYY}/{MM}/    1
  Bills/{YYYY}/{MM}/        1
  Recurring/{YYYY}/         1
  Budgets/{YYYY}/           1
  Accounts/                 6   1011, 2010, 3010, 4001, 4005, 4007
  Journal/{YYYY}/           1   one note for the month, holding five entries
CRM/
  People/                   2   Stefan, Erika
```

That is `DEFAULT_SETTINGS` with an empty `rootFolder`. Every folder, every path
template and every property name is resolved through settings, so a vault that
has moved its tree or renamed a property gets the notes in its own spelling. A
vault that has turned `projectFolderPerNote` off gets the project note flat in
`3 Projects/` instead, because the seeder asks `newProjectFolder()` rather than
assuming.

Thirteen target folders, and `3 Projects/` itself is not one of them: the project
owns a folder named after it, which is where `newProjectFolder()` puts every
project this plugin creates. The consequence is worth naming rather than
discovering, and it is the same one APERtrail's trips have. A vault that already
keeps projects flat in `3 Projects/` is not refused on their account; a folder
named after this sample project that holds somebody else's note is.

## What each folder demonstrates

| Folder | What it is there to show |
|---|---|
| `1 Areas` | An area is a standard to be maintained rather than an outcome to be reached: a priority, no status, and a `nod-projects` block that answers "what is running under this" from the moment the note exists |
| `2 Goals` | The middle of the PARA chain, pointing up at its area and carrying a status out of the shared vocabulary. It states no `deadline:`, because a deadline is a day somebody chose and a seeded one is a date the first thing anybody does is delete |
| `3 Projects/<title>` | A project as a folder of its own, and the derivation that makes the tree work: it names its goal and states **no `area:` at all**, so its area is derived through the goal. Moving the goal to another area re-files the project without touching the project note. It also carries the `nod-tasks` block, which is what collects the day notes' tasks that name it |
| `4 Resources` | The thin end of PARA on purpose: an area, a topic, a source and tags, and a body that is prose. A reference note that demanded eight properties before it could be filed is a reference note nobody files |
| `0 Plan/1 Daily` | A working week as the capture dialog writes one. Meetings with times and spans, `📝` notes and follow-up checkboxes captured under the meeting they came out of, tasks with priorities and dates, and an idea. **All four attendance markers appear across the week**, one per meeting; see [The four markers](#the-four-markers). Headings arrive with the entries that need them, exactly as `add-to-day.ts` produces them, because a line the composer would not have written is a line the reader silently skips |
| `0 Plan/3 Monthly` | Capture at month level, which is a different thing from capture on a day: one task, dated the **last day of the month**, which is what happens when somebody names no day and the entry goes into the note of the period the view was showing |
| `Finance/Purchases` | A purchase whose lines add up to the total it states, with a category, a status, an order date and a delivery date, filed under the year and month it was ordered in |
| `Finance/Bills` | An invoice that is **still open**: issued, due nine days out, unpaid. That is what puts it in the outstanding list and in the `nod-bills` block, and it is why it has no posting behind it; see [Keeping it honest](#keeping-it-honest) |
| `Finance/Recurring` | A standing charge with a cadence, an interval, a start date and the account every occurrence books to. It projects occurrences and writes no bill note, which is the whole difference between a recurring cost and a bill |
| `Finance/Budgets` | One note for the year, keyed to accounts and planned by rhythm: a monthly line, and two annual lines anchored on the month the vault was seeded in, so the budget page has a planned figure against the month somebody is actually looking at |
| `Finance/Accounts` | Six accounts out of the shipped chart, covering all four kinds an account can be: an asset, a liability, an income account and three expense accounts. One of them carries `person: [[Stefan]]`, which is how the ledger reaches the CRM. See [The chart of accounts](#the-chart-of-accounts) for why there are six and not eighty-seven |
| `Finance/Journal` | One note for the month, and everything in the `noda-journal` block: a plain expense, income, a debt raised on a card and paid off again, and a split whose two indented legs supply the debits the header leaves blank. Every posting names an account this run also writes, and the whole month balances |
| `CRM/People` | The `personsFolder` lookup on the shared contract: the configured type value, the `Family` tag, the `roles` list the other two plugins read, an `example.invalid` address, and a `nod-spending` fence and nothing else in the body. The only folder in this set marked `shared: true`, which is what lets a vault with an address book already in it be seeded beside rather than refused |

## Everything is relative to `now`

`sampleNotes()` takes a clock, and unlike its two siblings it uses it for
everything.

That difference is the whole of the reasoning. A named trip has real dates:
`Rovos Rail 2026` left Pretoria on a particular morning, and a sample vault whose
trips slid forward every time somebody ran the command would demonstrate a
different trip each week. A working week has no such dates. A plan view opened on
a freshly seeded vault has to show *this* week, *this* month and *this* month's
ledger, or it shows an empty grid and the plugin looks broken on first sight --
which is the one thing a sample vault exists to prevent.

So, derived from the seed date:

- **The five day notes** are Monday to Friday of the **ISO week** `now` falls in,
  from `startOfPeriod('week', now)`. ISO, so a vault seeded on a Sunday gets the
  week that has just run rather than the one starting tomorrow.
- **The month note** is `now`'s month, and its one task is dated the last day of
  it.
- **The budget** is for `now`'s year, with its two annual lines anchored on
  `now`'s month.
- **Every financial date** -- the purchase, the bill, the recurring start, and
  all five journal entries -- comes from one helper, `inMonth(now, daysBack)`,
  which counts back from today and **floors at the first of the month**.

That floor is the part worth stating. Counting back keeps the ledger out of the
future: **no posting is ever dated after the day the vault was seeded.** The
floor keeps every posting inside the month the budget measures and the month the
journal note is named for, so the budget page has actuals to hold its plan
against on the day of the seed. A vault seeded on the second of the month
therefore gets a ledger whose postings crowd onto two days, which is honest and
is a state a real ledger reaches; a vault seeded with postings spread over a
month it is three days into would be a ledger holding the future, which is not.
On the first of a month all five entries land on the first. The suite runs the
whole set against four clocks, including the first of a month and a Sunday, and
asserts both halves of that rule.

The one date the vault does hold that is not `inMonth`'s is the bill's due date,
which is nine days out from the seed. It is deliberately ahead of whoever ran the
command, so the bill always reads as due rather than as overdue on the first
render.

## The four markers

Each of the five meetings carries a different answer, and between them they use
every attendance marker the plugin has:

| Marker | Setting | Where it appears |
|---|---|---|
| `👥` | `dayMeetingMarker` | Monday's kickoff and Friday's review: accepted, or a meeting somebody wrote down themselves |
| `❓` | `dayMeetingTentativeMarker` | Tuesday's call with the accountant |
| `✉️` | `dayMeetingUnansweredMarker` | Wednesday's building committee |
| `🚫` | `dayMeetingDeclinedMarker` | Thursday's supplier webinar |

**This is the only place a new user sees what those four look like before running
a calendar import.** All four are settings, the import is the thing that writes
them in bulk, and the decision that produced them -- import everything and let
the marker say what you answered, rather than filtering, because a meeting you
declined is still the reason nothing else is in that slot -- is only visible once
you have a day note with a declined meeting in it. See
[The calendar import](calendar-import.md), section J. Somebody who wants a
different vocabulary can change all four in the settings and re-seed, and the
seeder writes whatever they chose: the markers come from `markerFor()`, not from
literals.

The lines themselves are composed by `entryLines()`, the same function the
capture dialog uses. That matters more than it looks: an entry the composer would
not have written is an entry `read-schedule.ts` skips, and a marker off by a
variation selector renders as an ordinary bullet and disappears from the day view
with no error anywhere. The suite reads every day note back through
`readSchedule` and asserts the set of four.

## The chart of accounts

**Six accounts, taken out of `seedChart('en', ...)` by number, and
`seedChartOfAccounts()` is deliberately not called.** This is the most surprising
decision on the page, so it is written out.

The shipped chart is eighty-seven accounts, and there is already a command that
writes it: **Seed chart of accounts**, which asks who lives here and what they
drive and then creates the notes, skipping any account whose number is already in
the vault. Calling that from inside the sample vault looks like the tidy answer.
It is the wrong one, for three separate reasons:

- **Eighty-seven notes would bury the twenty-three.** The sample vault's whole
  promise is a preview of what it is about to write into somebody's own vault,
  grouped by folder and counted. A preview whose Accounts section runs to
  eighty-seven titles is a preview nobody reads, and a command somebody has to
  trust rather than check.
- **It would put two idempotency rules inside one command.** The chart seed skips
  an account whose **number** is taken. The sample planner skips a note whose
  **title** is taken, and refuses a folder holding anything it did not name. Two
  rules answering "is this already here" differently, in one run, is how a
  duplicate gets written that neither of them can see.
- **It writes outside the plan.** `writeSampleVault()` refuses before it writes a
  single note, precisely so that a refusal leaves the vault exactly as it was. A
  call into another seeder from inside that function would be a write the plan
  never described and the refusal never covered.

The alternative -- listing six accounts by hand in `notes.ts` -- would be a
second copy of six rows of the chart, drifting the first time one of them was
renamed. So neither: `accounts()` calls `seedChart('en', { homeCurrency,
personOne: 'Stefan', personTwo: 'Erika' })`, indexes the result by number, and
takes six of them. Their kinds, groups, titles and currencies are the real
chart's, and the note titles come from `accountNoteTitle()`, which is the same
function `createAccount()` uses.

The six:

| Number | Kind | What it is for here |
|---|---|---|
| 1011 | asset | `Personal account Stefan`. The bank account everything settles through, and the only one of the six the chart marks as somebody's, so its note carries `person: [[Stefan]]` |
| 2010 | liability | `Credit card`. A debt raised by a purchase and cleared later in the month, which is the shape a card has and a bank account does not |
| 3010 | income | `Net income Stefan`. The salary posting's credit side |
| 4001 | expense | `Electricity and gas`. What the open bill is booked to, and a monthly budget line |
| 4005 | expense | `Insurance (contents, legal, travel)`. The recurring cost's account, and one leg of the split |
| 4007 | expense | `Travel and holidays`. The purchase, and the other leg of the split |

**And the adoption path stays open.** Because the six carry the chart's own
numbers, running **Seed chart of accounts** afterwards skips exactly these six
and writes the other eighty-one. Somebody who seeds the sample to see the ledger
work and then wants the full household chart runs one command and gets it, with
nothing renumbered and nothing duplicated. That is the property that made
"neither call it nor copy it" worth the trouble.

## Why there is no Company note

Both siblings seed a company: APERtrail writes `Rovos Rail Charters` and
CULItrail writes `TomTasty AG`, each into `CRM/Companies`. NODAtrail writes none,
and its purchase, bill and recurring notes therefore carry no `company:` at all.

The reason was originally the refusal rule, and it is worth recording that it was
the reasoning at the time. **A target folder is any folder the plan would write
into**, and a plan was refused outright by one note in such a folder that it did
not name. Writing a single company would have made `CRM/Companies` a target
folder of this plan -- which would have refused the whole NODAtrail run in any
vault where a sibling had already seeded its own company there, and would have
made that sibling refuse in a vault seeded by this one. That is not hypothetical:
running the three seeders against one vault is exactly how it was found, because
APERtrail seeds `Rovos Rail Charters` and CULItrail seeds `TomTasty AG` and
whichever ran second called the other's company a stranger.

**The rule has since changed rather than the content**, and `CRM/Companies` is
now a shared folder like `CRM/People` (see [The refusal rule](#the-refusal-rule)
below), so NODAtrail could seed a company today without refusing anything. It
still does not, and the reason is now the plain one: **there is nothing to seed.**
NODAtrail's money notes name no counterparty, so a Company note here would be a
note nothing points at, written into a folder this plugin has no business filling.

`CRM/People` is claimed on purpose, and is the only folder in this set marked
`shared: true`: `Stefan` and `Erika` are byte-compatible across all three sets,
so the second plugin to run recognises them, skips them and appends only its own
fence, and a person note nobody named is a colleague rather than a stranger.

The cost of naming no vendor is small and worth stating. A vendor that is not a
note in the vault is the ordinary case rather than a gap -- most of them never
become one -- and the readers hold a null counterparty without complaint. The
`nod-spending` block on `Stefan` and `Erika` renders its empty state until
somebody in that vault invoices the household, which is exactly what it should
say about a person who never has.

## The refusal rule

**A target folder may hold nothing except notes the plan would itself write.**
Anything else in it is a stranger, and one stranger refuses the whole run: the
notes reference each other, and half a sample vault is a screen of unresolved
wikilinks that reads as a broken plugin rather than as a skipped folder. A note
that is already there is skipped and **never overwritten**, because it may have
been edited and a sample vault is not worth losing an edit over. The one edit
made to a note that already exists is appending NODAtrail's own `nod-spending`
fence when it is absent, and that is counted and shown separately in the preview
because it is the only thing here that touches a file this plugin did not write.

**A shared folder is the exception, and `CRM/People` is the only one here.** The
two Person notes set `shared: true` and nothing else in the set does. A shared
folder never refuses: notes in it the plan does not name are reported rather than
treated as strangers, so a vault with an address book in `CRM/People` is seeded
beside it instead of being turned away for having one. That is the right trade
exactly there and nowhere else -- `CRM/People` is filled by all three plugins and
by whoever keeps contacts in this vault, whereas a real project in `3 Projects/`
or a real month in `Finance/Journal/` is precisely the evidence the refusal rule
exists to act on. The rule arrived after `CRM/Companies` broke the combined vault
outright; the history is under [Why there is no Company
note](#why-there-is-no-company-note).

The preview says all of it before anything happens -- what it would create,
grouped by folder; what it would skip; what would gain a block; what it would be
written beside in a shared folder, with the count and the titles; and, when the
plan refuses, which folders are occupied and by what. The shared list is not
styled as a warning and sits below the plan rather than above it, because nothing
about it is wrong: the run is going ahead and the existing notes are untouched.
The action button greys out rather than disappearing.

## The two wikilinks that are meant to dangle

Two titles in this set name notes NODAtrail does not write and will never read:

- **`[[Tom Yum Gai]]`**, in Wednesday's evening schedule entry. It is a meal note
  CULItrail seeds.
- **`[[Rovos Rail 2026]]`**, in the text of two journal postings -- the split
  header for the travel agent and the card purchase. It is a trip note APERtrail
  seeds.

**Seeded alone they dangle, and that is expected.** Seeded into a vault that also
holds the sibling's sample they resolve, and an evening's meal turns up in a day
note while a trip's money turns up in the double-entry ledger -- with no plugin
having called another, no shared type, and nothing but a wikilink in a line of
text on disk. That is the whole demonstration.

Every other wikilink in the set names a note the same run writes. The suite
asserts the exception **by name** rather than exempting whatever fails to
resolve, because a rule written the loose way passes just as happily for a link
that dangles by mistake.

For the install order in a vault that is getting more than one of the three, see
the suite-wide [sample vault page](../../../../docs/sample-vault.md).

## Keeping it honest

**The amounts are invented and real-shaped.** Contact details are on
`example.invalid`, a reserved domain that cannot be delivered to, so the notes can
be shared without leaking anything or reaching anybody. No vendor, policy number
or order reference names a real company.

**The bill is open, and it has no posting.** An invoice reaches the ledger only
when it is settled, as one posting between the bank account and the expense
account; nothing is posted when it arrives. So a bill that is unpaid and a
journal that says nothing about it are not an omission, they are the rule. The
journal's electricity posting is deliberately *last* month's electricity, paid
this month, so that the two are about different money and neither claims the
same franc twice. The sixth column -- the reference -- is demonstrated on the
purchase posting instead, which names the purchase note it settles.

**Nothing derived is seeded.** The project states no `area:` and derives one
through its goal. The bill states no `status:`, because a bill's status follows
from its dates and only `cancelled` is ever stored. Balances are computed on
every render and appear in no note.

**`notes.ts` is not quite pure, and the exception is `headingsFor()`.** Every
other value in it comes from `settings` or from `now`. The day-note headings
cannot: a blank heading setting means "the heading this vault's language calls
it", so `## 🎯 Focus` and `## 🎯 Fokus` are both ours and a note has to be
written under whichever one this vault would look for. A sample note that spelled
its own heading would be a note `read-schedule.ts` cannot find in a German vault
-- an empty day view with the entries sitting in the file, which is precisely the
failure this whole seeder is careful about. So the heading follows the vault's
language and every word of content below it is English. It is the one place the
sample vault is not a function of its two arguments alone, and it is worth the
exception.
