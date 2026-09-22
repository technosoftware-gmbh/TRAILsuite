# A budget line for part of the year

**Status: built on `feat/budget-line-range`, 22 September 2026.**

## The problem

A budget line ran the whole year. A cost that only exists from March until
November -- the garden, a season ticket, a summer mooring -- could only be
planned as nine `once` lines, one per month, or as a monthly line with zero
overrides for the three months it does not fall in. Both work and neither is
what somebody means.

## The decision

Two optional fields on a line, month numbers 1 to 12:

```yaml
lines:
  - account: 4210
    amount: 120
    rhythm: monthly
    from: 3
    to: 11
    note: Garten
```

| Field | Setting key | Absent means |
|---|---|---|
| `from` | `budgetLineFromField` | January |
| `to` | `budgetLineToField` | December |

Considered and rejected: a range key inside `months` (`"3-11": 120`), which mixes
"what a month holds" with "whether the line runs" in one property and is awkward
in a form; and an `active:` list of months, which handles gaps but is long to
write and read. A gap is rare enough for an override of 0 to cover it.

## The rules

- **A first month after the last wraps.** `from: 11`, `to: 2` is January,
  February, November and December of this year's note. The note is one year,
  so a winter is its two ends; it is not refused, because a winter cost is one
  line.
- **The rhythm counts from `from`** when the line names no `month` of its own:
  quarterly from March falls in March, June and September. A named `month` still
  wins.
- **A weekly line is spread over the months in range**, `amount * 52 / 12` each,
  as before.
- **The range masks, the overrides come after.** `months:` names a month and a
  figure outright, so an override outside the range is kept rather than
  second-guessed.
- **A value that is not a month is absent.** `from: 14` is not read as December;
  the editor does not write one either.
- **Written only when it says something**, like every other optional line field:
  a line without a range stays as short as it was.

## Where it lives

The format is the core's (`ledger/account-budget.ts`): `fromMonth` and `toMonth`
on `AccountBudgetLine`, `lineFromField` and `lineToField` on
`AccountBudgetProperties`, `inBudgetRange()` and `hasBudgetRange()`. Everything
that reads a plan goes through `expandBudgetLine`, so the year view, the month
measure, the rolling year and the printed Jahresplanung follow without a change
of their own.

NODAtrail adds the two settings, the two boxes in the budget line editor ("From
month", "Until month"), and the hint under the line: a monthly line with a range
shows "Mar - Nov", a skipping one the months it falls in.

## Not done

- No health finding for an `annual` or `once` line whose month lies outside its
  range, which plans nothing. It is visible under the line in the editor.
- A range across two budget years. A budget note is one year; November 2026 until
  February 2027 is a line in each note.
