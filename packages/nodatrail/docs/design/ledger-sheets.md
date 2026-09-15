# The ledger sheets

**Written 15 September 2026, decisions taken the same day.** Built: all five
sheets, the readings every tab and its sheet share (`ledger/readings.ts`),
`rollingYear` and `closedThrough`, `exportsSubfolder`, `exportAuthor`, the
Export action and command, and closing and reopening a month. APERtrail's four
sheets carry the same `exportAuthor` setting and credit line since 15 September
2026, each keeping its own caveat and, where it had one, its "the notes are the
record" line above the credit.

The sheets are titled in the tab's own words rather than the ones first
written here: Kontenplan, Kontoauszug, Gewinnermittlung (with "(Geldfluss)" on
the cash basis) and Bestandeskonten. The statement tab gained the period bar
with its sheet, bounded by the period as a bank statement is; it had listed
every posting the account ever saw.

APERtrail turns a trip into one HTML page that prints, mails and opens
anywhere. NODAtrail's ledger view has five tabs that are just as much
something a person wants on paper: the chart with its balances, one account's
statement, the profit calculation, the balance sheet and the budget. This is
the plan for exporting each tab as a sheet of the same kind.

## What already exists, and what is to be copied from APERtrail

| APERtrail has | Where | What NODAtrail does with it |
|---|---|---|
| The paper: A4, escaping, links as display text, `section()` gluing a heading to its first block, `printableDocument()` | `apertrail/src/shared/print-sheet.ts` | Shares it (decision 1) |
| Write-or-replace into the vault, Notice naming the path, open in a new tab | `apertrail/src/shared/write-sheet.ts` | Shares it (decision 1) |
| `exportsSubfolder`, default `_exports` | `apertrail/src/shared/export-folder.ts` | Same key, same meaning (decision 2) |
| A **pure builder** taking localized, formatted strings and returning markup, and an **App-bound half** that reads and formats | `trips/export-trip-document.ts` and `trips/ui/export-trip-document.ts` | The same split per sheet |

| NODAtrail has | Where |
|---|---|
| Every figure the sheets need, already computed per render | `ui/views/ledger-view.ts`: `renderChart`, `renderStatement`, `renderIncome` / `renderCashOut`, `renderBalance`, `renderBudget` |
| The arithmetic | trail-core `incomeStatement`, `cashOut`, `balanceSheet`, `statement`, `budgetYear`, and `ledger/budget-month.ts` `measureMonth` |
| Money and dates in the one display locale | `ui/kit/format.ts` |
| Period, basis and chosen account | the view's `PeriodPicker`, `basis`, `account` |

Nothing new is needed in the note format. The sheets only read.

## The one structural risk: a sheet that disagrees with the view

Each tab computes its figures inline, with options that matter: `hideEmpty`,
the converter for foreign currencies, the balance sheet's day being the last
day of the period rather than today. A sheet that calls `balanceSheet` itself
will one day pass different options and print a net worth the view does not
show.

So step 2 lifts each tab's computation out of the view into a **reading**: a
plain function from `(ledger, settings, period, basis, account)` to the model
that tab draws. The view renders the reading into Obsidian elements; the sheet
formats the same reading into strings. One computation, two renderings. It is
a refactor with no visible change and it lands before any sheet does.

```
ledger/readings/chart-reading.ts       balance sheet at period end + income/expense for the period
ledger/readings/statement-reading.ts   account, opening, rows with running balance, closing
ledger/readings/income-reading.ts      accrual (incomeStatement) or cash (cashOut)
ledger/readings/balance-reading.ts     balanceSheet on range().to
ledger/readings/budget-reading.ts      budget note, measureMonth, budgetYear
```

## The five sheets

Every sheet: a header with the title and **the period or the day it is
about** (a figure that does not say which day it is about cannot be checked); a
stat strip of the same two or three figures the view shows; the body; and the
footer below.

### The period is the one on screen

Every sheet respects the period bar: a month, a quarter or a year exported is a
monthly, quarterly or yearly Kontoauszug, Erfolgsrechnung and so on, and the
period is part of the file name. Four tabs already compute over `range()`, so
for them this is free.

**The budget is the exception.** It is a year sheet whatever the period bar
says; see "The budget sheet is a rolling year plan" below.

### The footer

Three lines, one helper in the shared print code so APERtrail's sheets can use
the same one:

1. **The notes are the truth**, in the trip document's manner: "Diese Seite ist
   ein Ausdruck des Journals zum Zeitpunkt der Erstellung. Massgeblich sind die
   Notizen im Vault; jede Zahl wird aus den Buchungen berechnet."
2. **The currency rule**: accounts in another currency are converted at the
   rate from the settings or listed outside the total, never summed silently.
   Only on a sheet that has such an account.
3. **The credit**: "Erstellt von {Autor} am {Datum} mit NODAtrail -
   technosoftware.com", the domain as a link whose text is the address, so it
   still reads on paper. With no author set: "Erstellt am {Datum} mit
   NODAtrail - technosoftware.com".

`{Autor}` comes from a new setting, shared with APERtrail (decision 7). The plugin name and the
link are fixed, not settings.

### Sheet by sheet

Three of the five print a `ReportGroup` tree, so they share one pure
**report table**: number, name, amount right-aligned in tabular figures, each
group as a subtotal row, nesting by indent, a foreign-currency account with
its held amount and rate beneath, an account outside the total marked in words
rather than colour. Groups print expanded whatever is folded on screen: folding
is a reading posture, and paper has no click.

| Tab | Sheet | Body |
|---|---|---|
| `accounts` | **Kontenplan** | Assets and liabilities as of period end, income and expense for the period, each a report table. Empty accounts hidden as in the view (decision 8) |
| `statement` | **Kontoauszug** | Account label, IBAN or bank number, currency. Opening balance, then a table: date, text, counter-account, debit, credit, running balance. Closing balance and posting count. In the account's own currency. Long statements break across pages with the table header repeated |
| `income` | **Erfolgsrechnung** | The basis on screen, named in the header with its hint text. Accrual: income, expense, result. Cash: expense, settled, total out |
| `balance` | **Bilanz** | Assets, liabilities, net, headed with the day |
| `budget` | **Jahresplanung** | See the next section. Landscape (decision 4) |

Debit and credit as two columns on the statement rather than a signed movement:
on paper a minus sign is the thing a photocopy loses. Negative results and an
over-spent budget line say so in a word or with a leading minus, never only in
red.

## The budget sheet is a rolling year plan

Added 15 September 2026, after Thomas showed the Excel/Numbers sheet the budget
tab is meant to replace. It is not a plan
beside an actual. It is **one year, one column per month, where every month
already closed shows what happened and every month still to come shows the
plan**. In January it is pure plan. At the start of February January is
replaced by reality, and the Total column then says whether the rest of the
year still works. Costs are not divided by twelve: a premium due in January is
planned in January, which is what `rhythm`, `month` and `overrides` on a
budget line already express.

Its two halves, and what the ledger can already give each:

### Half 1: Einnahmen and Ausgaben per month

```
                         Jan  Feb  Mar | Apr ... Dez | Total | Plan | Abweichung
Total Einnahmen
  Erwerbseinkommen         (group rows from the chart's report groups)
    3010 Einkommen Netto
Total Ausgaben
  Steuern ...
Einnahmen - Ausgaben
                     <- Ist ->        <- Plan ->
```

- **Closed months**: `movementBetween` per account per month, the same figure
  the income statement uses. Unbudgeted expense accounts with movement appear
  as rows too, as the budget tab already insists.
- **Open months**: `expandBudgetLine` per line.
- **Total** is the forecast: actual so far plus plan for the rest.
  **Plan** is the pure plan as made in January, and **Abweichung** the
  difference. These two columns answer "still in plan?" in one glance, which
  the Excel sheet leaves to memory. (Decision 10.)
- Rows and groups come from the chart's report groups, so the sheet groups the
  way the Kontenplan does. Income positive, expense negative, as in the Excel
  sheet.
- A marker between the last closed and the first open month: a heavier rule
  and the words Ist and Plan over the columns.
- Apart from `closedThrough` (decision 9), nothing here needs a note format
  change. It needs one new core function,
  `rollingYear(lines, accounts, postings, year, closedThrough)`, returning
  both the forecast and the plan per account per month.

### Half 2: Vermögen per month

`Vortrag` (balance on 31 December of the previous year, `balanceAt`), then a
balance per account at each month end, grouped as the balance sheet groups
(cash, each person's accounts, reserves, pillar 3a, investments, mortgages),
with the Vermögen total on top.

- **Closed months**: `balanceAt` on the month end per account. Free.
- **Open months, the total**: last actual net worth plus the planned result
  (Einnahmen - Ausgaben) of each month. Exact, because in double entry net
  worth moves only by the result. Free.
- **Open months, per account**: **not possible today.** A budget line names
  one income or expense account and says nothing about which bank account it
  is paid from, and the budget editor deliberately offers no asset accounts.
  So a fixed amount moved into a reserve account every month, and a payment
  out of it every third month, cannot be planned yet. (Decision 11.)

### When a month counts as closed

The Excel sheet closes a month by hand, at the start of the next. The ledger
could decide by itself (every month before today), but the first days of
February would then show a January whose statements are not imported yet, as
if it were reality. (Decision 9: by hand.)

## Where they go and what they are called

Decided: all five into `{financeFolder}/{exportsSubfolder}`, so
`Finance/_exports/` by default. They are readings of the whole ledger rather
than of one note, and the finance folder is the ledger's home. Replaced on
re-export, never versioned, as APERtrail decided.

File names carry the sheet and what it is about, **through the translations**
(German in a German vault, English in an English one; the sheet word is a
translation key, the period is its title) and `sanitizeTitle`, so two periods never overwrite each other and the same period
always does:

```
Kontenplan 2026-09.html
Kontoauszug 1020 PostFinance 2026-Q3.html   quarterly
Erfolgsrechnung 2026 (Ist).html             yearly, cash basis
Erfolgsrechnung 2026-Q3.html                quarterly, accrual
Bilanz 2026-09-30.html                      the day, whatever the level
Budget 2026-09.html
```

## How a person asks for one

- An **Export** action in the ledger view's toolbar (icon `printer`), which
  exports the tab on screen with the period, basis and account on screen.
  What you see is what prints.
- One command, **Export ledger sheet**, which does the same for the open
  ledger view and, with no view open, opens it first. Five commands would each
  need their own period picker, which the view already is.

## Order of work

1. **The paper, shared.** Decision 1. If promoted: `print-sheet.ts` into
   trail-core as `print/` (pure), `write-sheet.ts` into `src/obsidian/`,
   APERtrail switched over, and a before/after comparison of an exported trip
   document proving not one byte of APERtrail output changed. Fix
   `printableDocument`'s hard-coded `lang="en"` on the way: it takes the
   language. Core minor release, staged as `docs/releasing.md` describes; the
   workspace build needs no publish, CULItrail is untouched.
2. **Readings.** Extract the five computations out of `ledger-view.ts`. No
   visible change; the existing view tests stay green.
3. **Plumbing.** `exportsSubfolder` and the author setting (types, defaults, validate,
   folders page, settings reference row, both translations), the path
   function, the toolbar action, the command.
4. **The report table**, then the sheets simplest first: Bilanz,
   Erfolgsrechnung (both bases), Kontenplan, Kontoauszug, Budget.
5. **Docs and gate.** This file marked built; `ledger.md` and the user guide
   gain a section; `06-nodatrail.md` names the new directory; bundle
   regenerated. `npm run check` from a clean clone, install into the vault,
   print each sheet from Chrome.

## What the gate will ask of it

- `translation-keys`: every sheet word in `en.ts` and `de.ts`; sheet titles
  looked up by tab name are dynamic keys and go in `DYNAMIC_KEYS`.
- `display-locale`: every figure and date through `ui/kit/format.ts`.
- `settings-reference` and `settings-coverage`: the new key has its row and
  its control.
- `no-em-dash`: sheets, docs and this file.
- `package-boundary`: no import from APERtrail, which is exactly why decision 1
  exists.

Tests of its own:

- Each pure builder: an account named `<b>A&B</b>` prints as text; a section
  with nothing under it prints no heading; the heading and first row share one
  `section-head` box; totals printed equal the reading's totals; the footer
  omits "von" with no author and escapes one that has markup in it.
- **View and sheet agree:** for a fixture ledger, the reading each tab renders
  and the reading each sheet formats are the same object, so the numbers cannot
  drift. Break it on purpose (pass `hideEmpty: false` to one side) and watch it
  go red before trusting it.
- The path: blank `exportsSubfolder` writes beside the finance folder.
- `vault-smoke`: all five sheets build from the real vault without throwing.

## Decisions taken, 15 September 2026

1. **The paper moves to trail-core**: `print-sheet.ts` as a pure `print/`
   module, `write-sheet.ts` into `src/obsidian/`, APERtrail switched over with
   byte-identical output. Minor core release.
2. **One folder**, `Finance/_exports/`, under the same key as APERtrail,
   `exportsSubfolder`.
3. **File names translated**, German in a German vault.
4. **The budget sheet is landscape**: Vortrag, twelve months and the totals on
   a named landscape page. Printing is done from Chrome, which honours named
   pages.
5. **Filters respected**: month, quarter and year on every sheet.
6. **The footer** says the notes are the truth and credits the author, the
   date, the plugin and technosoftware.com.
7. **The author name is shared with APERtrail**: `exportAuthor`, a string,
   blank by default, carried through a trail-core settings contract as the
   display locale is, so all nine sheets print the same credit line. Adds a
   row to both settings references and a field to the contract test.
8. **Kontenplan follows the view**: accounts with a balance or movement only.
9. **A month is closed by hand.** The budget note gains `closedThrough`
   (0 to 12, absent meaning 0), written by a "Monat abschliessen" action on
   the budget tab. A note format change: core parser and builder, a property
   setting, data-model and settings-reference rows.
10. **Total, Plan and Abweichung** columns on the Einnahmen/Ausgaben half.
11. **Vermögen: only the total is projected** into open months; account rows
    stay blank after the last closed month. Per-account planning (a budget
    line naming a counter-account, planned transfers) is its own design after
    the sheet has been seen.

## Decided after seeing the sheet

C. **The budget tab over a quarter or a year.** Decided 15 September 2026,
   after the printed sheet had been seen: the Budget tab shows the rolling year
   too, drawn from the sheet's own model (`budgetSheetModel`), so screen and
   paper cannot disagree. A selector offers "The year" (default) and "One
   month", which is the month measure as it was.