# Usage

## The seven views

| View | What it answers |
|---|---|
| **Life** | Today: what is due, what is overdue, which projects are running, what is owed, and where the month's budget stands |
| **PARA** | Areas, the goals under each, and the projects under those, grouped by status. An archive toggle in the toolbar |
| **Projects** | Every project as a card, filtered by area, goal and status, searched by name, grouped by status |
| **Plan** | One period at a time at any of the five levels, with everything that falls inside it |
| **Finance** | Purchases, bills and recurring costs, as three tabs |
| **Ledger** | The chart of accounts, one account's statement, the income statement, the balance sheet and the budget |
| **People and companies** | The contacts shared with the sibling plugins, and what each is owed or owes |

Every view re-reads your vault each time it draws. None of them subscribes to
changes, so a note you edit in another tab shows up on the next refresh rather
than immediately. The refresh button is in every toolbar.

## The everyday workflows

**Opening a period note.** *Open today*, *Open this week*, *Open this month*,
*Open this quarter* and *Open this year* each open the note and create it if it
is not there. A new note gets its frontmatter and nothing else: what goes in a
period note is your business.

**Writing into a day.** *Add to day*, also the second ribbon icon, captures one
task, meeting, note or idea into a day note under the right heading, links it to
a project or area, and turns a meeting's follow-ups into task lines. It writes
the heading only when the first entry needs it. See
[Plan](features/plan.md).

**Clearing an old navigation block.** Period notes no longer carry one and
nothing writes one. *Remove navigation block* takes an old one off the note you
are looking at, and touches nothing below it.

**Archiving.** *Archive this note* moves an area, goal, project or resource into
`6 Archive/<Category>/<Year>/` and stamps the day. A project moves as a folder,
with its image and its documents. Its `type` does not change, so it is
still the same note; the active lists simply stop looking in that folder.
*Move this note out of the archive* puts it back and removes the stamp.

**Recording a bill.** *New bill* asks which direction it goes, who the other
party is, the amount, the dates, the account it books to and the document. An
outgoing one is an invoice you sent. It offers to remember a company's account
and category, so the second invoice from the same vendor fills itself in. Leave the status alone: it is worked out from the
dates, and a value written into the note would be stale by morning. A bill reads
as **due** inside the window you set in the settings, **overdue** past its due
date, and **paid** the moment it carries a paid date.

**Marking one paid.** The **Paid** button on a bill row, in the Finance view or
on the dashboard, asks which day and writes it, together with the ledger posting
that records the money moving. It asks rather than assuming
today, because the day a bill was paid and the day you got round to recording it
are routinely not the same, and a bill dated wrong lands in the wrong month's
budget. The field starts at the due date. On a bill that is already paid the same
button reopens the date, and offers to clear it.

**Budgeting.** *New budget* creates a note for a **year** with an empty list of
lines, and the Ledger view's Budget tab measures it. A line names a ledger
account, an amount and a rhythm, and the twelve months follow from the rhythm.
*Edit this note's lines* opens the same editor with the budget note open, which
is the route that does not depend on a view finding the note first.

The Budget tab shows the year against what the journal says actually moved, and
puts any expense account no line claimed under **Unbudgeted** rather than hiding
it.

**Keeping the ledger.** *New posting* for anything a bank statement never sees,
*Import a bank statement* for the rest, *New account* and *Create the chart of
accounts* for the chart itself, and *Set up accounts* to write every opening
balance in one pass. See [the ledger](features/ledger.md).

**Editing a purchase's lines.** The **Items** button on a purchase row, or
*Edit this note's lines* with the purchase open, opens the same editor for what
was in the order. It shows the subtotal, the computed total
and the total the note states side by side as you type, and says so when the
last two disagree. It does not correct either: the stated figure is what was
charged, and which of the two is wrong is not something a dialog can know.

Those two are the only properties NODAtrail reopens a note for. Everything else
is a flat scalar or a list of links, and Obsidian's property editor handles
those better than a dialog would.

**Tasks.** NODAtrail reads the checkbox lines in the folders you configured, in
the Obsidian Tasks format. Ticking one in a NODAtrail view rewrites that one
line and changes nothing else on it, not the spacing and not a field NODAtrail
does not recognise.

## The blocks

Seven fenced blocks. Six put a piece of a view inside a note; the seventh is the
journal, which is a format rather than a view.

````
```nod-projects
```
````
in an area or goal note: the projects beneath it. It reads the note's own title,
so it takes no argument.

````
```nod-tasks
within: 7
tag: finanzen
```
````
open tasks, optionally narrowed to a horizon in days, to a tag, or to
`overdue: true`. In a period note with no arguments it shows that period's.

````
```nod-period
```
````
in a period note: everything that falls in it.

````
```nod-budget
period: 2026-08
```
````
one month of the year's budget against what the journal says moved. Without a
period it uses the current month.

````
```nod-bills
area: Finanzen
```
````
what is owed, optionally narrowed to one area.

````
```noda-journal
2026-08-04 | 4000 | 1005 | CHF 105.84 | TomTasty | 33698
```
````
in a journal note: the month's postings, rendered as a table with the source left
as one line each. A line that cannot be read appears in place, marked, rather
than being skipped. Its language is `noda-` rather than `nod-` because the name
is not NODAtrail's to choose: the parser is `trail-core`'s.

````
```nod-spending
```
````
in a **Company** note: what you bought there, and what you still owe them. This
is NODAtrail's counterpart to APERtrail's `travel-related-trips` and CULItrail's
`culi-related-orders`, and like them it renders as a plain code block when the
plugin is disabled rather than as an error.

## When something does not show up

A note counts as a given kind only if it sits under the configured folder **and**
its type property carries the configured value. There is no folder-only
fallback and no vault-wide search for a type outside its folder. So a note that
gets moved, or whose type gets mistyped, drops out silently, by design.

That is what **Check the vault** is for. It asks the inverse question: which
notes in these folders are not what the folder says they should be.
