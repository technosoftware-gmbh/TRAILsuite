---
type: account
number:
kind:
group:
currency: CHF
opening: 0
openingDate:
closed:
iban:
bankAccount:
person:
---

`kind` is one of `asset`, `liability`, `income` or `expense`. There is no
equity account: for a household it is what is left over, and computing it is
cheaper than maintaining it.

`number` is unique and is the sort order everywhere accounts are listed, so
leave room between them.

`iban` and `bankAccount` are worth filling in for any account a statement is
ever imported from. They are what lets an imported line that names an account
resolve to this note, which is how a transfer between two of your own accounts
is recognised instead of being read as text and booked twice.

`opening` is what the account held before the first posting in the vault, and
`openingDate` is the day that is true as of. A posting dated earlier is still
counted.

Leave `closed` off unless the account is done with. A closed account is
reported on, never refused.
