---
type: budget
period: 2026
currency: CHF
lines:
  - account: 4000
    amount: 450
    rhythm: monthly
    note:
  - account: 4200
    amount: 1200
    rhythm: annual
    month: 3
    note:
---

```nod-budget
```

A line names a ledger **account** by its number, an amount and a **rhythm**:
`monthly`, `quarterly`, `semiannual`, `annual`, `weekly` or `once`. The twelve
months follow from the rhythm, so an annual charge with `month: 3` lands in March
rather than as a twelfth of itself every month. `months:` overrides a single
month without disturbing the rhythm.

The period is a bare **year**. `2026-08` is refused rather than read as 2026.
Name the note the same as its `period`.
