# The ledger

NODAtrail's money notes started as records: a bill you owe, a purchase you made,
a charge that repeats, a budget you hoped to keep. They answer *what did this
cost*. They cannot answer *what is in the account*, because nothing in them says
where the money came from or went.

This document describes the layer that answers that: accounts, postings,
balances, and a budget keyed to accounts. It is the largest single piece of the
plugin, and it was deliberately written down before it was built.

**It is built.** What follows is that design, kept because the reasoning is
still the reasoning, with each section saying where the code ended up
somewhere other than where the design pointed.

## What it is replacing

A separate household finance application, with a chart of accounts in the Swiss
shape: a profit calculation (`Gewinnermittlung`) over income and expense
accounts, and balance accounts (`Bestandeskonten`) over cash, bank, savings,
investments and mortgages. Two people with a joint household. Every figure keyed
in by hand.

Two things make the vault a better home for it than the application was. The
invoices are already in the vault as documents, and 136 of them already have
bill notes with amounts read out of the PDFs, so half the typing is done before
the ledger exists. And the money is about areas, projects and a house that the
same vault already describes.

Two things do not improve by moving. There is still no connection to a bank, so
the bank side arrives by hand or by import. And a household ledger is only as
correct as what somebody entered.

## Accounts

**One note per account**, in `Finance/Accounts`. Around fifty notes for a
household, and that number does not grow: an account is opened once and lives
for years. A note rather than a row in a table because an account is a thing you
attach documents to. The mortgage contract belongs on the mortgage account, the
year's statements belong on the bank account, and a note is where they can hang.

| Property | Setting key | Meaning | Shape |
|---|---|---|---|
| `number` | `accountNumberProperty` | `1005`, `4001`. Unique, and the sort order | number |
| `kind` | `accountKindProperty` | `asset`, `liability`, `income`, `expense` | string |
| `group` | `accountGroupProperty` | `Gemeinsame Kosten/Renault Twingo` | string |
| `currency` | `accountCurrencyProperty` | The currency it is kept in | string |
| `opening` | `accountOpeningProperty` | Balance before the first posting | number |
| `openingDate` | `accountOpeningDateProperty` | The day that opening balance is true as of | date |
| `closed` | `accountClosedProperty` | The day it stopped being used | date |
| `iban` | `accountIbanProperty` | | string |
| `bankAccount` | `accountBankNumberProperty` | Whatever number a statement prints when it prints no IBAN | string |
| `person` | `accountPersonProperty` | Whose account it is; empty for a shared one | link |

**`iban` and `bankAccount` are not decoration.** They are the one thing that
lets an imported statement line naming an account resolve to an account note,
which is what the transfer rule further down depends on. See "Two accounts, one
transfer".

**The kind is stored, not derived from the number.** A number range says
`1xxx is an asset` only by convention, and a chart that numbers differently
would be silently misread. So a setting maps prefixes to kinds and fills the
property in when an account note is created, and the property is what every
later reader trusts. Changing the convention later never rewrites history.

**The group is a path, not a folder.** `Gemeinsame Kosten/Renault Twingo` gives
the two levels the printed chart shows without a second note type to hold the
tree, and without the account notes having to live in nested folders. The tree
is assembled by splitting on `/` and ordering by account number.

## Postings

**A posting is one movement of money**: a date, an amount, the account debited,
the account credited, a description, and optionally the bill it settles.

They do not get a note each. A household writes somewhere between 1500 and 3000
of them a year. Three thousand notes a year would make the metadata cache and
every folder listing useless, and the individual note would carry one line of
information. So postings live in a **journal note per month**,
`Finance/Journal/2026/2026-08.md`, inside a fenced `noda-journal` block that the
plugin renders as a table in reading view and parses in every reader.

Twelve notes a year, each one editable by hand in plain text, each one a
readable diff, and each one small enough to scan in microseconds.

### The simple form

One line, pipe separated, fixed order: date, debit, credit, amount, text,
reference.

```noda-journal
2026-08-04 | 4001 | 1005 | 128.45 | IBB Strom August | [[IBB 2026-08]]
2026-08-25 | 1005 | 3010 | 7412.00 | Lohn August
```

Debit before credit, which is the order the printed chart is read in: the
expense account is debited and the account that paid is credited. The reference
is optional and is a wikilink to the bill note, which is what ties a posting back
to the PDF it came from.

### The split form

A card statement or a supermarket receipt covers several expense accounts at
once, and one line cannot say so. A posting whose first line omits the debit
account is continued by indented lines that each name an account and an amount:

```noda-journal
2026-08-04 | | 1005 | 250.00 | Migros August
    4000 | 180.00 | Lebensmittel
    4004 | 70.00 | Katzenfutter
```

The continuation amounts must sum to the amount on the first line. When they do
not, the block reports the difference rather than guessing which figure is
right, and the posting is excluded from balances until somebody settles it. A
ledger that quietly rounded away a difference would be a ledger you stop
checking.

### Foreign currency

The amount is in the currency of the accounts involved. When the two accounts
are kept in different currencies, both figures and the rate are written, because
inventing a rate later is inventing history:

```noda-journal
2026-07-11 | 1001 | 1005 | EUR 200.00 = CHF 189.60 | Bargeld Ferien
```

There is no rate table and no rate download. A rate is written on the posting
that used it, or it is not known.

## Balances

**A balance is computed, never stored.** Every reader sums the postings for an
account, in date order, on top of the account's opening balance. Nothing is
written back into an account note, and no closing entry is posted at year end.

This is a deliberate trade. Recomputing means a decade of postings is scanned to
show a balance, which for a household is roughly thirty thousand lines and takes
no perceptible time. In exchange, correcting a posting from three years ago
corrects every balance that depends on it at once, with nothing to rebuild and
nothing that can be stale. A year can still be archived when the file count
becomes tiresome, by setting an opening balance and date on each account and
moving the older journals out of the folder.

## Reports

Four, each of them a pure function of accounts plus postings plus a period.

**Gewinnermittlung**, income less expenses over a period, grouped by the account
tree exactly as the chart prints it. The report a year is judged by.

**Bestandeskonten**, every asset and liability balance at a date, with the total.
What the household is worth on a day.

**Kontoauszug**, one account's postings with a running balance. What is compared
against a bank statement.

**Budget vs actual**, below.

## The budget

The reason the old budget went unused is worth stating exactly, because it
determines the design: it was yearly only, and a yearly figure is not something
a month can be judged against. But entering twelve figures for each of fifty
accounts is 600 numbers a year, which is a different way of not being used.

Almost every household cost has a **rhythm**. The electricity payment is monthly,
the car insurance falls once in March, the water bill is quarterly. So a budget
line is an amount plus a rhythm, and the twelve monthly figures are derived:

| Field | Meaning |
|---|---|
| `account` | The account this line budgets |
| `amount` | What one occurrence costs |
| `rhythm` | `weekly`, `monthly`, `quarterly`, `semiannual`, `annual`, `once` |
| `month` | For the rhythms that do not fall every month: which month it starts in |
| `note` | Free text |

One note per year, roughly fifty lines, and the plugin expands them into the
twelve monthly figures the overview needs.

**This replaced the budget that came before it**, which keyed its lines to an
area and a category and measured them against the bill, purchase and recurring
notes. Two budget systems in one plugin would be two answers to "am I over
budget", and once every payment produces a posting the account version is
strictly the better of the two: it measures what actually moved rather than
what the paperwork implies. The area and category budget is gone rather than
kept alongside.

**Per month overrides** exist for where reality departs from the rhythm: a line
may carry explicit figures for named months, and those win over the expansion.
Nobody has to use them.

Both views are then available from the same note. The **year overview** is the
starting point: accounts down, months across, with the yearly total. The
**month view** is what gets checked: budget against actual, per account, for one
month, with what no line claimed shown rather than hidden.

## How the existing notes feed it

Nothing that exists is replaced. The bill, purchase and recurring notes stay
exactly what they are, and each gains the two properties a posting needs:

| Property | Meaning |
|---|---|
| `account` | The income or expense account it belongs to |
| `paidFrom` | The asset account the money left |

Marking a bill paid then writes the posting into the right month's journal, with
the bill note as its reference. The workflow that already drafts bill notes from
the PDFs in the document folders becomes the workflow that fills the ledger, and
no figure gets keyed in twice.

A posting that has no bill behind it, which is most of them, is written straight
into the journal.

## What is checked, and what is not

The ledger is full of things that are quietly wrong in ways only a check
notices. From the chart this was designed against, two real examples: an account
numbered in one person's range but grouped under the other, and a car with a
petrol account where its sibling has none.

Two such checks exist today, and neither is in the vault health check. They
surface where somebody is already looking at the ledger, above whatever tab is
showing, because a figure computed from a journal that did not parse is one
worth distrusting before it is worth reading:

| Check | What it catches | Where it surfaces |
|---|---|---|
| Unknown account | A posting naming a number no account note has | The ledger view, from `unknownAccounts` |
| Unbalanced split | Continuation amounts that do not sum to the total | The ledger view, as a journal parse problem |

Neither refuses anything. They are reported, and the person decides.

What the vault health check gained instead is narrower: a budget line naming an
account no note claims. That is the same check the area version did, moved with
the budget onto accounts, and it is there because a line pointing at nothing is
a figure that will never be measured and will never say why.

The rest of what this section once listed -- a duplicate account number, a
number sitting outside its siblings' range, a bill marked paid that no posting
settles, a line dated outside the journal note holding it, a posting to a closed
account -- is not built. They are still the right checks and are kept here as
the list to build from.

## What this will not do

Stated here so it is not discovered later.

### Both sides of what was borrowed for

A mortgage is in the chart because it is owed. The house it bought has to be
there too, or the balance sheet reports a household as several hundred thousand
in the red: arithmetically correct, and a description of nobody. The first real
chart this was tested against had exactly that shape, two mortgages and no
property, because it had been a cash-flow chart where a house that is never
bought or sold never appears.

**Valued at what was paid, and then left alone.** A purchase price is a fact
that does not change. A market estimate is a guess that changes every month and
that nobody will keep current, and a balance sheet whose largest figure was
last guessed at in March is worse than one that is simply conservative. Somebody
who wants the sheet to agree with a tax return can use the official value
instead; what matters is that it is one number, chosen once, and revalued by a
deliberate posting rather than by drifting.

The same reasoning is why the cars are absent and should stay absent. They are
leased, the instalment is an expense, and there is nothing owned to put on the
sheet.

### When a debt earns an account of its own

NODAtrail already knows what an unpaid bill is: a bill note has a due date and
a paid date, and a bill nobody has paid is open. So a liability account is not
how an unpaid invoice gets tracked, and giving every electricity bill one would
double the bookkeeping for nothing.

**The rule is whether the debt outlives the month.** A bill that arrives and is
paid within a few weeks is a bill note and one posting. A debt that is incurred
once and discharged over months is a liability account, because only an account
can answer what is still owed on a day, and only an account lets the expense be
recognised when it was incurred rather than smeared across whichever months the
instalments happened to fall in.

Three kinds of household debt meet that test, and the shipped chart has an
account for each:

**A card balance.** Purchases accumulate and are paid off later, and the
purchases are the expense.

**An instalment plan.** One purchase, several payments.

**A tax bill.** This is the case where the difference is starkest. A Swiss
household is assessed once and pays over the year, often on provisional
instalments before the final figure is even known. Booked as expenses when
paid, the tax lands in whichever months the instalments fell, which says
nothing about the year the tax is for and makes a monthly budget meaningless.
Booked against `2021` and `2022`, the assessment is one posting into the tax
expense in the month it arrives, every instalment reduces what is owed, and a
correction when the final assessment differs from the provisional one is a
single posting between the same two accounts.

### The order a first import has to go in

A bank statement holds the payment to a card and nothing about what was bought
with it. The purchases are on the card's own invoice. So the invoice is entered
first and the bank statement imported second, or the card ends the month owing
a negative amount, which is not a thing any card has ever done.

The same holds for a tax assessment against its payable, and for any debt
carried into the first year. The rule in one line: **the posting that creates a
debt comes before the posting that settles it**, and only the second of those
is ever on a bank statement.

### Cards and instalment plans

A monthly payment to a credit card or an instalment provider is **not an
expense**. It is money moving from the bank account to a debt, and the expense
was whatever was bought weeks earlier. So each gets a liability account, the
payment is a transfer that reduces the debt, and the purchases are posted
against the card from its own statement.

The alternative, treating the payment as the expense, is much less work and
wrong in three ways at once: the purchases behind it are invisible, they are
dated to the month the bill was paid rather than the month they happened, and
the outstanding balance appears nowhere. On the statement this was designed
against that would have hidden thirteen hundred francs of purchases behind
three round payments.

**No bank connection.** Not now and not planned.

What there will be is an import. The bank this was designed against issues a
PDF per transaction, a PDF statement per month, and a CSV statement on request,
and the application being replaced can import none of the three. So a CSV
importer is not a nice-to-have that might happen: it is the piece that decides
whether the bank side is typed or read, and it is the clearest advantage this
has over the tool it replaces.

It was built second rather than first, and deliberately. A bank CSV has no
standard: the column names, the date format, the sign convention and the way a
debit is distinguished from a credit differ between banks and sometimes between
export dialogs at the same bank, so the importer had to be written against a
real file rather than against a guess. And matching an imported row to a bill
note that already exists was only worth writing once there were postings to
match against. Both conditions were met, and it exists: `import-modal.ts` and
`import-write.ts` here, `import-plan.ts` and `statement.ts` in the core, with
the profiles kept as the `importRules` setting on a settings page of their own.

The shape it takes: a **profile per format**. Two real exports were read to
settle it, and they share not one structural decision. The bank is semicolon
separated with day-first dates, debit and credit in their own columns,
apostrophe thousands, the newest row first and the currency in a column
heading. The card account is comma separated with ISO timestamps, one signed
amount column, the fee in a column of its own, an explicit currency and status
per row, and the oldest row first. Anything that guessed would guess wrong on
one of them.

Four things a profile knows beyond the columns, each of which was worth
finding:

**The running balance is a proof.** Every row states the balance after it, and
both files reconcile to the cent from first row to last. That is what makes an
import trustworthy rather than merely convenient: if the chain holds, nothing
was dropped, nothing was counted twice, and no sign was read backwards. A break
names the first row where it stopped adding up.

**A batched payment is a split.** `Zahlungsauftrag e-banking (Anzahl Buchungen:
10)` is ten invoices the bank posted as one debit. Six of the twenty-five rows
in one month's statement were such lines, covering thirty-one payments between
them. An importer that posted each as a single expense would be wrong about
almost half the month.

**A fee is a movement.** One card row states an amount of zero and a fee of
18.99. Reading only the amount would post nothing and leave every later balance
out by that much.

**A transfer names the other account.** `Uebertrag von 0510.5272.2002` is the
household's own second account, so the far side resolves rather than being
guessed, provided the account note carries its IBAN or its printed number.
Which is why they now can.

The remaining pieces are the ones that write: a preview of what would be posted
before anything is, a match against existing bill notes by amount and date, and
a refusal to import the same row twice.

### Recognising a row again

Three fallbacks, and the reason the third exists is worth recording.

The bank's own reference, when the export carries one. Failing that, the
**running balance**, which is unique within an account by construction. Failing
both, the date, the amount and the text, with an occurrence number appended
where even that collides.

The middle one was added after the card export turned up three identical
`Apple -4.00` charges settled in the same second on the same day. Keyed on
date, amount and text they were one row, and a second import of that month
would have skipped two of the three as already present, quietly losing eight
francs. The synthetic fixtures could not have shown that. The real file did.

### Two accounts, one transfer

A transfer between two of the household's own accounts appears in **both**
statements: once as money leaving the first, once as money arriving in the
second. Import both files naively and it is posted twice, and neither balance
is right afterwards.

The rule: a transfer whose far side resolves to an account that is itself
imported is posted once, from whichever file is read first, and recognised as
already present when the other file is read. This is the single largest source
of a wrong balance in a multi-account import, and it is the reason the account
notes carry their bank identity.

It is caught by looking for the posting the other file already wrote: same pair
of accounts, same direction, same amount, dated within three days. Not by the
import key, which cannot help here, because the two ends come from two files
and carry two different keys.

Direction is part of it and has to be. A thousand francs sent to the other
account and a thousand sent back the same day are the same pair, the same
amount and the same date, and they are two movements rather than one counted
twice.

**What it cannot catch yet.** Money that moved between two of the household's
own accounts while hidden inside a batched payment line. The bank states one
debit of 2851.55 covering five payments and says nothing about what they were,
so if one of the five was a transfer to another account, nothing can know that
until the split is filled in. Once it is, the mirror check applies to the leg
like any other posting. The order matters in practice: split the batches before
importing the other account's file, or the transfer inside one will be posted
from both ends.

### What a real month looks like

Two real exports, read one after the other with a starting set of rules:

| | rows | ready | needs a decision | skipped |
|---|---|---|---|---|
| bank account | 25 | 19 | 6 | 0 |
| card account | 27 | 21 | 5 | 1 |

Every one of the six on the bank side is a batched payment line needing its
split. Five of the card ones are merchants with no rule yet, each of which
writes a rule the moment it is assigned. The one skipped row is the transfer
between the two accounts, caught from the second file. Forty postings from
fifty-two rows, and eleven decisions, most of which do not recur.

**No exchange rates.** A rate is written on the posting that used it.

**No audit trail.** Postings are text in a note and can be edited freely. Git
history is the only record of what changed, which is more than most household
tools offer and less than accounting software guarantees.

**No VAT, no accountant's export.** The tax deductible account exists and its
yearly total is a report, which is what a private tax return needs. Anything a
business needs is out of scope.

**It does not balance itself.** Double entry means the balance sheet reconciles
if the postings are right. It cannot tell you that a payment you never entered
is missing. Only comparing an account statement against the bank does that, and
that comparison is the one piece of discipline the design cannot remove.

## Invoices the household sends

Built, bar the statement import's half of it. `docs/design/sales-invoices.md`
is the design and its record of what happened: a `direction` property on the
bill format, absent meaning incoming, and a settlement posting with the two
sides swapped. What remains is an inward statement row settling an outgoing
invoice, which is a second matcher over the same rows and writes postings if it
is wrong.

Worth knowing while reading the rest of this document: **it needs nothing here
to change.** The four account kinds already cover a Debitoren account, which is
an asset, and a sales account, which is income; `increasesOnDebit` is the whole
of double entry the rest of the code knows about and it is already right for
both. What is missing is a document that says money is owed to the household,
not arithmetic that can express it.
