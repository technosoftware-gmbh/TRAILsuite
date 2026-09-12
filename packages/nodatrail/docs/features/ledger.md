# The ledger

Double-entry bookkeeping for a household, over notes the vault already holds.

The finance notes answer *what is owed and to whom*. The ledger answers a
different question: *what actually moved, and what is left*. A bill says an
invoice exists; a posting says it was paid, out of which account and into which
one. Keeping the two apart is what lets an unpaid invoice sit in the finance
list for six weeks without ever pretending to be money that has left the house.

## What it is made of

**A chart of accounts**, one note each under `Finance/Accounts`. An account has
a number, a kind, a currency, and optionally the opening balance it started
from. Four kinds, and equity is not one: `asset`, `liability`, `income`,
`expense`. Assets and liabilities are the balance sheet, income and expenses the
income statement, and there is nothing else a household account can be. Equity
is what is left over, and computing it is cheaper than asking somebody to
maintain it.

*Create the chart of accounts* seeds a chart for a two-person household, which
is a starting point rather than a boundary. *New account* adds the one you
decide you need in March.

**A journal**, one note per month under `Finance/Journal/{YYYY}`, holding its
postings as lines inside a `noda-journal` block rather than as a note each. A
household writes a couple of thousand postings a year, and a note apiece would
make every folder listing and the metadata cache useless for the sake of a file
holding one line.

```
2026-08-04 | 4000 | 1005 | CHF 105.84 | TomTasty | 33698
```

Date, the account debited, the account credited, the amount with its currency,
free text, and an optional reference to the bill or purchase it settles. A split
is a header line with one side left blank and the legs indented under it, which
is what a card invoice looks like: one amount owed, a dozen purchases behind it.

**Balances are computed, never stored.** Every figure in every tab is
recalculated from the postings on each draw, so correcting a line corrects
everything derived from it at once.

## The five tabs

| Tab | What it answers |
|---|---|
| **Accounts** | The chart as a tree, with a live balance against each account |
| **Statement** | One account's postings with a running balance, to hold against a bank statement |
| **Income** | What the period cost and what it earned, over a month, quarter or year |
| **Balance** | What is owned and what is owed, on a day |
| **Budget** | The year's plan against what actually moved |

Anything wrong with a journal is shown above whichever tab is open. A figure
computed from a journal with an unreadable line in it is a figure quietly
missing that line, and the worst version of that is the one nobody is told
about.

The Income and Balance tabs fold their groups away. A folded group still states
its total, which is the whole point of folding one: reading a report at group
level is exactly the case a fold exists for.

## Getting money in

**Three routes, and they are deliberately different jobs.**

*New posting* is for everything a bank statement never sees: a card invoice, a
cash payment, a tax assessment, an opening debt. A split is one button away.

*Import a bank statement* is for the rest. Choose a file and an account, and
every row is shown with what it would post and why before anything is written.
Nothing reaches a note until the button at the bottom is pressed. Assigning an
account to an unmatched row writes a rule, so the second month asks a fraction
of what the first did.

Two things make the import trustworthy rather than merely convenient. The
running balance in the file is used as proof that nothing was dropped. And
before writing anything, the **handover check** compares the balance the file
starts from against what the ledger already says that account held the day
before. That is the only check that can notice a month never imported at all,
which no amount of arithmetic inside one file can see.

Transfers between two of the household's own accounts are resolved through the
IBAN or account number on the account note, so one movement is booked once
rather than twice, once from each end.

*Set up accounts* asks the opening date once and writes an opening balance to
every balance account in one pass.

## Marking a bill paid

The **Paid** button asks which day, and writes the posting as well as the date.
It asks rather than assuming today, because the day a bill was paid and the day
you got round to recording it are routinely not the same.

**This is where the finance notes and the ledger meet**, and it needs both
accounts known: the account the invoice books to, and the account it was paid
from. A bill missing either is not posted, and says so, rather than being
recorded as paid with the money going nowhere.

## The budget

One note per **year**, and a line is an account, an amount and a rhythm. The
twelve months are derived from the rhythm, so a cost that falls once in March
shows up in March rather than as a twelfth of itself every month.

It is keyed to accounts rather than to areas and categories, and it replaced the
area budget rather than sitting beside it. Two budget systems would be two
answers to the same question, and only one of them counts what actually moved.

An expense account with movement that no line claims is shown as **unbudgeted**
rather than hidden. A budget that quietly ignored spending it had not planned
for would be a budget that always balances.

## What there is not

**No bank connection.** Nothing in this plugin talks to a bank, and nothing
fetches an exchange rate. A rate is written on the posting that used it, in the
form `EUR 200.00 = CHF 189.60`, or it is not known. Inventing a rate later is
inventing history.

## Where the reasoning is

`docs/design/ledger.md` carries the model and the arguments behind it: why four
account kinds, why a journal block rather than a note per posting, what the
import does with a row it cannot place, and which checks are built against which
are still only designed.
