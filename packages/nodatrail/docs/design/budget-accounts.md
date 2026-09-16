# Planning per account

**Design, written 16 September 2026. Nothing here is built, and nothing is
decided until the questions at the end are answered.** It changes the budget
note format, which this repository treats as expensive: a vault is somebody's
records, and a wrong write is found months later.

## What is missing

The rolling year (`ledger-sheets.md`, `rollingYear` in the core) shows every
account's balance at each closed month end, and for the months still to come
only the net worth total. The spreadsheet it replaces plans every account's
balance through December, and that is what it is used for: whether the private
account goes negative in November, whether the reserve holds enough when the
mortgage interest falls due.

Two things make that impossible today:

1. **A budget line says what money is spent on, not where it comes from.**
   `6110 Haushalt, 1650 monthly` plans an expense and moves no bank account.
2. **A transfer between two own accounts cannot be planned at all.** The
   monthly amount moved into a reserve account, and the payment out of it every
   third month, have no income or expense side. The budget editor offers only
   income and expense accounts, deliberately, and `rollingYear` reports a line
   on any other account as stray.

The net worth total does not need either, because in double entry net worth
moves by the result alone. A single account needs both.

## The idea: a budget line is a planned posting

A journal line already says everything a plan needs: an amount, the account it
lands on, and the account it comes from. A budget line lacks only the second
account. Give it one, and every line becomes a posting that has not happened
yet, repeated by its rhythm:

```yaml
lines:
  - account: 6110          # Haushalt
    amount: 1650
    rhythm: monthly
    from: 1005             # paid from the Haushaltskonto
  - account: 3010          # Lohn netto Anna
    amount: 7800
    rhythm: monthly
    from: 1011             # received into Anna's Privatkonto
  - account: 1030          # Renovationsreserve
    amount: 600
    rhythm: monthly
    from: 1011             # a transfer: no income, no expense
  - account: 6130          # Hypothekarzins
    amount: 1900
    rhythm: quarterly
    month: 3
    from: 1030             # paid out of the reserve
  - account: 2050          # Festhypothek
    amount: 2000
    rhythm: annual
    month: 6
    from: 1011             # an amortisation: the debt goes down
```

(Invented accounts and figures, the same household as the sheet tests' fixture.)

**Which way the money goes follows from the account's kind**, so a line never
needs a sign or a second amount:

| `account` is | The line means | Posted as |
|---|---|---|
| expense | spent, paid from `from` | debit `account`, credit `from` |
| income | earned, received into `from` | debit `from`, credit `account` |
| asset | moved into `account` out of `from` | debit `account`, credit `from` |
| liability | paid off out of `from` | debit `account`, credit `from` |

That is the rule the ledger already applies to every posting
(`increasesOnDebit`), read from the named account's side. A negative amount
turns the direction round, which is how a loan drawn or a withdrawal from a
reserve would be written, and which nobody needs for an ordinary year.

## What each part of the plugin then does

**Rolling year, flows half.** Unchanged in what it shows. A line on an asset or
liability account is a transfer: it is left out of income and expenses, as a
transfer is left out of the income statement, and is no longer reported as
stray.

**Rolling year, balances half.** For every month after the last closed one, an
account's balance is its last measured balance plus the planned postings that
touch it in each month. The account rows then carry on to December like the
spreadsheet's, projected figures in italics as the net worth row already is.

**The invariant that keeps it honest:** the sum of every projected account is
the projected net worth that exists today. An income or expense line with no
`from` still moves net worth and moves no account, so its amount goes to one
row, **Nicht zugeordnet**, under the balances. The total therefore never
changes because of this design; only how much of it is attributed to real
accounts. A budget with no `from` anywhere looks exactly as it does now plus
that one row, and the row shrinks as lines are given accounts.

**The budget editor** gains a "paid from / received into" account picker per
line, and offers asset and liability accounts as a line's `account` too, so a
transfer can be entered. The reason it excluded them ("budgeting a bank balance
is not what a budget is for") is answered by the new meaning: a line on an
asset account is not a budgeted balance but a planned movement into it.

**One month view, the dashboard and the `nod-budget` block.** All three go
through `measureBudgetMonth`, which today makes a row of every line whatever its
account. It has to skip lines on asset and liability accounts, so a transfer
does not appear as a planned expense measured against a bank balance's
movement. Nothing else reads a budget note.

## Not in this design

- **Deriving `from` from recurring cost or bill notes.** A recurring note
  carries an `account` and a bill a `paidFrom`, so a plan could be suggested
  from them. It is a convenience on top of this format and can come later.
- **Checking a plan against a closed month per account.** The flows half
  already compares; a per-account "planned 600 into the reserve, 450 arrived"
  is a second report.
- **Several currencies on one line.** A line stays in the budget's currency; a
  foreign account projected in it is converted at the settings' rate, as every
  report does.

## Format changes, all additive

| Where | What | Absent means |
|---|---|---|
| a budget line | `from`, under a new `budgetLineFromField`: the other account's number | the line moves net worth but no account |
| the budget editor | asset and liability accounts offered as `account` | |
| trail-core | `AccountBudgetLine.from: number \| null`; `rollingYear` projects balances per account and adds an unassigned row | |

A vault written before this reads unchanged, so by this repository's rule it is
a minor release of the core and of NODAtrail. As with `closedThrough`, the new
field is required on `AccountBudgetLine` in the types, which is a code-level
change for anybody constructing a line by hand.

## Order of work

1. Core: parse and write `from`; `rollingYear` projects per account, reports
   transfers as transfers, adds the unassigned row; `measureBudgetMonth` skips
   transfer lines. Tests, including the
   invariant (per-account sum equals the projected net worth) broken on purpose
   once.
2. NODAtrail: the setting, the editor's account picker and the wider account
   list, the unassigned row and italic projections on the sheet and the view.
3. Docs: data model, settings reference, `ledger-sheets.md`, user guide.

## Questions

1. **The field's name.** `from` reads right for an expense and a transfer and
   wrong for income ("Lohn, from Privatkonto" means received into it).
   Alternatives: `via`, `counter` or `with`. The note's own
   words are preferred; which word would you write by hand?
2. **One list or two.** Transfers as ordinary lines whose `account` is an asset
   or liability (this design: one list, one editor, one rhythm engine), or a
   separate `transfers:` list with `from` and `to` (clearer to read in the note,
   a second editor and a second list to keep in step)?
3. **A default account.** Most spending leaves from one or two accounts. Should
   the budget note carry a `defaultFrom` that a line without its own `from`
   uses, so fifty lines do not each repeat the same account? Without it, the unassigned row
   is large until every line is filled in.
4. **The unassigned row.** Shown only while it is not zero (proposed), or always?
5. **Liabilities.** A mortgage can be planned here as a debt that goes down by
   an amortisation line. Is an amortisation something to plan, or does a debt
   only change when the bank says so, so that liability accounts need no lines
   at all?
