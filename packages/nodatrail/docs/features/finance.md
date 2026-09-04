# Finance

The money that belongs to neither a trip nor a meal.

Four kinds of note here, plus the accounts and journals the
[ledger](ledger.md) keeps under the same `Finance/` roof.

## Four kinds of note

**A purchase** is something you bought: a vendor, a date, a total, optionally a
list of what was in it, and a link to the invoice wherever it already sits.
The filename is derived as `20260604_baloise_1040269824.md`: the date, the
company, the reference. The reference is a property as well, because once the
name carries a company too, reading a reference back out of it means guessing
where a company name ends.

**A bill** is money owed -- or, with `direction: outgoing`, money owed to you.
One note type carries invoices in both directions, and every difference between
them is a value rather than a shape: an issuer or a customer, an expense account
or an income account, the day the household paid or the day the customer did.
`direction` is written only when it is `outgoing`, so every bill written before
this existed keeps meaning what it always meant.

A bill has an issuer, an amount, an issue date, a due date and,
once it is paid, a paid date. It is a note of its own rather than a
property on a purchase, because one purchase can be settled by two instalments
and one bill can cover two purchases, and neither fits inside the other without
lying about the other.

**A recurring cost** is a standing charge: an insurance premium, a leasing
instalment, a subscription. An amount on a cadence, counted from a start date.

**A budget** is one note per **year**, and a line is a ledger account, an amount
and a rhythm. See [the ledger](ledger.md); it is measured against what actually
moved rather than against the purchase and bill notes.

## What is derived, and what is written

**A bill's status is worked out, not stored.** Paid when it has a paid date,
overdue past its due date, due inside the window you set, open otherwise. The
one status you can write is `cancelled`, because no date can say that. A status
written into a note would be stale by morning.

**A recurring cost projects; it never writes a bill.** The occurrences are
recomputed on every render, so correcting the amount corrects every projected
month at once. Turning one occurrence into a real bill note is a command you
run, on one occurrence, having looked at it. A plugin that wrote twelve notes a
year into your vault while you were not looking would be a plugin you stop
trusting the folder of.

**A purchase's stated total wins over the computed one, always.** The note is a
record of what was charged. What the lines add up to is compared against it by
the vault check and reported when the two disagree, and it is not what a budget
spends.

## Where the money lands

A purchase belongs to the day it was ordered. A bill belongs to the day it was
**due**, not the day it was paid: a bill paid late still belongs to the month you
budgeted it in. A projected occurrence belongs to the day it falls.

An occurrence a bill already accounts for drops out of the projection, matched on
the exact day rather than on the month, so one bill cannot cancel four weekly
occurrences.

## Budgets

A line names an **account**, an amount and a **rhythm**: monthly, quarterly,
semiannual, annual, weekly, or once. The twelve months are derived from the
rhythm, so a cost falling once in March shows up in March rather than as a
twelfth of itself every month. A single month can be overridden without
disturbing the rhythm.

The period is a bare year. `2026-08` is refused rather than quietly read as 2026,
because a budget note that claimed to be about August while being measured across
a year is the kind of wrong nobody catches.

**It is measured against the journal**, not against the purchase and bill notes.
That is the point of keying it to accounts: the question a budget answers is what
actually moved, and only the ledger knows that.

An expense account with movement that no line claims appears as **unbudgeted**
rather than being hidden. A budget that concealed what it did not predict would
be worse than no budget. A line naming no account is dropped, because there is
nothing for it to measure.

## Where the notes live

```
Finance/Bills/2026/08/        by the date on the invoice
Finance/Purchases/2026/08/    by the order date
Finance/Budgets/2026/         by the year the budget is for
Finance/Recurring/2026/       by the start date
Finance/Accounts/             the chart of accounts, one note each
Finance/Journal/2026/         one note per month, holding its postings
```

Bills and purchases get a month folder because a year of them is hundreds of
notes and a month is a handful, which is the size a folder is still worth
opening. Budgets and standing charges are already a handful per year, so a month
folder there would hold one note and cost a click.

Each of the four is a template setting, so `{YYYY}`, `{YYYY}/{MM}` or blank are
all valid answers. **Only new notes are affected.** Every reader looks through
the whole module folder whatever the template says, so changing it breaks
nothing and notes filed the old way keep working. `scripts/refile-notes.py`
tidies the existing ones when you want them moved, and prints what it would do
before it does anything.

A note with no date to file by lands in the module folder itself, which is where
somebody looking for the undated ones would think to look.

## Marking a bill paid

The **Paid** button on any bill row. It asks which day rather than assuming
today: the day a bill was paid and the day you recorded it are routinely
different, and the difference decides which month's budget it lands in. The
prompt starts at the due date, which is when a standing order pays and roughly
when a person does.

Clearing it removes the property rather than writing it empty, so a bill marked
paid by mistake goes back to being exactly what it was.

**It writes a posting as well as a date.** This is where the finance notes and
the [ledger](ledger.md) meet, and it needs both accounts known: the account the
invoice books to, and the account it was paid from. A bill missing either is not
posted, and says so, rather than being recorded as paid with the money going
nowhere.

## The two editors

A purchase's `items` and a budget's `lines` are lists of maps, and Obsidian's
property editor renders one as nested fields with no way to add a row, remove
one or move it. Those two therefore have a dialog: **Items** on a purchase row,
**Edit** on the budget.

Both work on a copy and write on save, so cancelling means what it says, and
both write one property and leave every other property and the whole body
untouched. The purchase editor shows the subtotal, the computed total and the
stated total together and flags a disagreement without resolving it. The budget
editor offers each line an account -- expense and income accounts only -- an
amount and a rhythm.

They are the only two properties NODAtrail reopens a note for.

## Categories

Ids rather than words, so each shows in your language. The shipped list is a
default rather than a boundary: **an id the list does not know is read and shown
exactly as written**, so adding `pets` to a note works without touching the
plugin, and adding it to the setting makes the forms offer it.

## The blocks

````
```nod-bills
area: Finanzen
```
````
what is owed, optionally narrowed to one area.

````
```nod-budget
period: 2026-08
```
````
one month of the year's budget against what the journal says actually moved,
defaulting to this month.

````
```nod-spending
```
````
in a **Company** note: what you bought there and what you still owe them. It
renders as a plain code block when NODAtrail is disabled, so the note stays
readable either way.
