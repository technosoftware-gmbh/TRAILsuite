# The ledger: double-entry, and the matching around it

Written for the Claude Project because no repository document covers this.
`docs/architecture.md` predates it. The authority is the source, in
`packages/core/src/ledger/` and `packages/nodatrail/src/ledger/`.

## Why it is in the core

An account and a posting are records of what happened, and a vault holds them
long after any particular reader. This is the note-format promotion test rather
than the two-consumer one: a ledger whose meaning drifted between releases would
be a ledger whose balances drifted.

## The model

Four account kinds, fixed, because every report keys off them:
`asset`, `liability`, `income`, `expense`. Equity is not modelled. For a private
household it is what is left over, and computing it is cheaper than asking
somebody to maintain it.

The whole of double entry that the rest of the code has to know is one function:

```ts
export function increasesOnDebit(kind: AccountKind): boolean {
  return kind === 'asset' || kind === 'expense';
}
```

An `Account` carries its number (unique, and the sort order), kind, group,
currency, an opening balance with the day it is true as of, an optional closed
date (reported on, never refused), and the bank's own identifiers: `iban` and
`bankAccount`. Those last two are what let an imported statement line that names
an account resolve to an account note, which is how a transfer between two of
the household's own accounts is recognised rather than read as text.

A `Posting` names `debit` and `credit` as account **numbers** rather than
accounts, because a journal is parsed before the chart is necessarily known, and
a posting naming an account that does not exist has to survive long enough to be
reported.

**Balances are computed, never stored.** As with everything else derived in this
codebase, nothing is written back.

## The journal format

A household writes a couple of thousand postings a year. One note each would
make every folder listing and the metadata cache useless for the sake of a note
holding one line, so postings live in a fenced ` ```noda-journal ` block inside
one note per month.

Lines are pipe-separated. A split is a header line plus indented legs, and the
side the legs fill is left **blank** on the header:

```
2026-05-26 |  | 1011 | CHF 293.26 | KLARNA BANK AB (PUBL) ...
    4004 | 293.26 | ZOOPLUS
```

Here the credit is 1011 and each leg supplies its own debit. The parser expands
the continuation lines rather than inventing a nested shape, so everything
downstream sees one flat list. `readSplit()` recovers the original shape by
finding which side is constant (the header's) and which varies (the legs').

**Nothing in the journal parser throws.** A journal is typed by hand, and one
fat-fingered line must not take the other two hundred down with it. Every
unreadable line comes back as a problem carrying its line number, and the
postings that could be read are still returned.

## Importing a bank statement

A `StatementProfile` describes one bank's export: delimiter, header rows, column
indices, date format, whether the newest row is first, which status values count
as settled, and the patterns to strip from a description. Two ship:
`SWISS_EBANKING_PROFILE` (semicolon, `DD.MM.YYYY`, separate debit and credit
columns, currency read out of the balance column's heading) and
`CARD_ACCOUNT_PROFILE` (comma, ISO dates, one signed amount column with a fee
beside it, oldest first). The second matches Revolut's export exactly, and books
on the **completed** date while carrying the started date as `valueDate`; the two
differ by a day often enough to matter.

Each row gets an import key, either the bank's reference or
`<date>~<amount>~bal:<balance>`, and a repeated key gets `#2` appended. That key
is what makes re-importing an overlapping period safe.

`planImport()` produces one proposal per row with a status: `ready`,
`needs-account`, `needs-split`, `already-imported`, `mirrors-existing`, or
`already-settled`. It writes nothing. An import that wrote first and reported
afterwards is one nobody dares run on real books.

Four ways a wrong balance can arrive from an import that looks like it worked,
and what catches each:

1. **The same row twice**, from an overlapping re-export. Caught by the key.
2. **The same movement from both ends.** A transfer between two of the
   household's own accounts appears in both statements. Caught by `findMirror`,
   within a three-day window, because one bank books when money leaves and the
   other when it lands.
3. **A row posted to the account being imported into.** `effectOn` returns zero
   for a posting from an account to itself, so the money simply does not move
   while the books still close, and the only symptom is a closing balance that
   disagrees with the bank. Guarded explicitly: a counter-account equal to
   `intoAccount` becomes `needs-account`. This happened in a real vault from an
   over-broad learned rule matching the account holder's own name inside
   `Urspruenglicher Auftraggeber:`.
4. **A payment already entered by hand**, from the mark-paid dialog. Caught by
   `matchPaidBill` against bills already settled from that same account.

**Two of those guards were themselves wrong, and a real vault found both.**

*The mirror guard swallowed the second run.* `findMirror` was shown every
posting the ledger held, including the ones this same file had written on an
earlier import. So the second import of a statement reported nothing to do: each
row was dropped as a mirror of itself. The pool `findMirror` searches now
excludes any posting carrying a key **this file produces**, which is the precise
statement of "another account's side of this movement, not my own earlier run".
The first attempt gated only the same-run pool and merely moved the bug.

*Learned rules matched on the wrong half of the text.* A Swiss e-banking
description carries the counterparty, then `Mitteilung:` or `Urspruenglicher
Auftraggeber:` and a reference that changes every month. A rule learned from the
whole string therefore matched exactly one row, forever. `counterpartyOf()` cuts
the description at those markers, and both the rule and the row are compared on
the head alone. Replayed over 421 rows against 115 rules: 394 unchanged, **zero
filed to a different account**, 16 newly filed by a rule that had been pinned to
one month's reference.

## Keeping the statement

The file an import came from is copied into the vault beside the journal notes
it fed, under the same `_documents` subfolder the invoices use, named
`<from>-<to>_<account>.csv`. Filed by the year of the **last** row, which is the
same rule the card profile uses to date a row.

**Never overwrites and never stores identical bytes twice.** Re-importing a file
already archived is the normal way somebody finishes the rows they left
undecided. A *different* file covering the same period gets a numbered name,
because two exports of one month are two documents and the later is not
necessarily the better one.

What the archive is for is the second column: for each kept statement, how many
of its rows the ledger does not hold. **Replayed, not remembered.** Nothing is
written down about the import; the count is worked out from the file and the
postings every time it is drawn, so answering a row or correcting a posting
three years later moves the figure by itself. A statement with rows outstanding
is an account whose balance disagrees with the bank by exactly their total.

Keeping is offered on its own as well as after a write. A statement whose rows
are all already imported can never reach the write path, so without a button of
its own the archive could only ever hold files from imports that happened after
it existed.

## Marking a bill paid, and the near miss

The reverse direction of the invoice matching above. `postingsCovering()` asks
whether the ledger already holds this payment, so that stamping an invoice paid
does not write the money a second time. It matches on the amount, **both**
accounts, and a date window anchored on the invoice rather than on the proposed
paid date.

Its strictness fails closed into the most expensive outcome this module has: the
dialog offers to write a posting for a payment already in the books, and nothing
on screen says so. Both ways it happened in a real vault, a fortnight apart. An
invoice booked to `4039` whose payment the import had filed to `4036`. And an
invoice due on the 14th paid on the 26th, when the search reached the 19th.

`paymentsNearMiss()` answers the question the reader actually has at that
moment. Each reason requires everything **except its own field** to match, so it
reports "the payment is there and the account is wrong" rather than "here is a
posting the same size". A posting with both the wrong account and the wrong date
says nothing: two fields off is a different payment that happens to match in
size. Nothing more than sixty days away is reported at all, because January's
subscription is not July's invoice and reporting it would teach the reader to
dismiss the warning.

Reported, never enforced. The dialog says what it found and what it would write,
and still lets it be written.

## Matching a row to an invoice

**The bank's reference is useless for this.** Every row carries `Ref.-Nr.`,
which is the bank's own transaction number and has nothing to do with the number
the vendor printed. Matching on it would find nothing, on every row, forever.

What is left is the amount and the vendor's name in the text, which is what a
person uses by hand. The amount is exact and does almost all the work.
Ambiguity is reported through `alsoFits`, never resolved quietly: two identical
unpaid bills from one vendor is what a monthly subscription looks like, and
picking one silently would be right half the time.

**Payment providers are the exception.** A shop can hand its collection to
Klarna or PayPal without telling anybody, and from that day its rows name the
collector while its invoices still name the shop. There is nothing shared to
match on. So a company note can be flagged `paymentProvider: true`, and a row
naming one is matched on amount, currency and date alone, with the name check
dropped for that row and no other.

## Matching a row to an order

The inverse problem, and there are two matchers because there are two cases.

`matchOrderForText()` is for a line that **prints the order number**, which a
card statement does because that is what the merchant sends to the card scheme.
There the number identifies and the amount only confirms, so a disagreement is a
finding rather than a silent overwrite. The statement wins: a refund, a
substitution or a partial delivery all show up exactly there.

`matchOrderForCharge()` is for a line that prints **no number at all**. A
Revolut row says `Tom Tasty` and a figure. It matches on merchant, amount,
currency and date, and is correspondingly strict. Two details worth knowing:

- The merchant is compared with spaces removed as well as by whole words,
  because the order note says `TomTasty AG` and the card prints `Tom Tasty`, and
  those share no word at all.
- The date window is **asymmetric**: one day before the order, six days after.
  A symmetric window has to stay around three, because these orders arrive
  weekly and a repeat order repeats its price to the cent, so at four days a
  charge three days after one order sits four days before the next and fits
  both. Nobody is charged for an order they have not placed, so the whole
  allowance goes on the side the charge can actually be.

**An order already paid for is never offered again**, read from the postings
themselves rather than stored. This is the one error class that no amount of
balancing will reveal: two charges pointing at one order are both real money
that really left the account, so the books close either way.

## Cross-plugin reading, and the licence boundary

NODAtrail reads CULItrail's order notes and adopts its folder and property names
by reading that plugin's `data.json` off disk. There is **no**
`app.plugins.getPlugin()` call and **nothing imported** from CULItrail, which is
what keeps a PolyForm package from taking on GPL code. It also means the notes
are readable whether or not the plugin that wrote them is installed. Adoption
only ever touches settings still sitting at NODAtrail's shipped default, so a
value somebody chose is never overwritten.

## Money rules

Three, and they are the core's:

1. A total over unpriced lines is **null, never zero**.
2. Currencies are **never summed together**.
3. Nothing derived is written back.

And one more from the purchase side: **the stated total wins over the computed
one, always.** A note is a record of what was charged; the computed figure is
what the health check compares against, not what a budget spends.
