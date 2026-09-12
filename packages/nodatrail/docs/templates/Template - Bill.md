---
type: bill
direction:
company:
account:
paidFrom:
area:
category:
amount:
currency: CHF
issueDate:
dueDate:
paidDate:
reference:
document:
lines:
recurring:
purchase:
---

Leave `status` off. It is worked out from the dates, and the only value worth
writing is `cancelled`, which no date can express.

`direction` is written only for an invoice you sent (`outgoing`); absent means an
invoice you received, which is what every bill written before the property
existed already meant.

`account` is the expense or income account this books to and `paidFrom` the
account it was paid out of. Both are needed before marking it paid can write the
ledger posting.

`document` takes one path or a list of them: an invoice with a reminder and a
receipt behind it is common enough that one path per note would mean losing two
of the three.

`lines` splits one invoice across several accounts, each entry an `account`, an
`amount` and a `note`.
