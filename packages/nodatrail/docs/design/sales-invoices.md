# Invoices in both directions

**Written 28 August 2026. Steps 1 to 6 built the same day.** The statement
importer itself exists and has since the ledger did; what is still to come is
its half of this, an inward row settling an outgoing invoice. That is step 7,
and it is the one piece deliberately left.

NODAtrail records what the household is billed. This is the design for
recording what it bills, so that a Debitorenrechnung is the same document as a
Kreditorenrechnung read the other way round.

It was written before any code because it changes a note format, which is the
class of change this repository treats as expensive: a vault is somebody's
records, and a bad write is discovered months later.

**There is exactly one vault, `Stefan-Life`.** That is worth knowing while
reading this, because it settles some questions and not others. It makes a
migration cheap, so no decision here needs to be made to avoid one. It does
not make a wrong write cheap: sixty invoices rewritten wrongly are still sixty
records somebody has to reconstruct, and there is no second vault to compare
them against.

## What already exists, and it is more than it looks

The ledger needs no new machinery. `ACCOUNT_KINDS` is already
`asset | liability | income | expense`, and `increasesOnDebit` is the whole of
double entry the rest of the code knows about:

```ts
export function increasesOnDebit(kind: AccountKind): boolean {
  return kind === 'asset' || kind === 'expense';
}
```

So a Debitoren account is an asset and a sales account is income, and both are
accounts a vault adds rather than code anybody writes. The posting engine, the
balance sheet and the income statement all handle them today.

What does not exist is a document that says money is owed **to** the household,
and a settlement that posts it the other way.

## The two documents, side by side

|  | Kreditorenrechnung | Debitorenrechnung |
|---|---|---|
| German | Eingangsrechnung | Ausgangsrechnung |
| `direction` | `incoming` | `outgoing` |
| The other party | a company or person with role `vendor` | role `customer` |
| `account` offers | expense accounts | income accounts |
| On receipt | *nothing is posted* | *nothing is posted* |
| On settlement | Soll Aufwand · Haben Bank | Soll Bank · Haben Ertrag |
| `paidDate` means | the day the household paid | the day the customer paid |
| Overdue means | the household is late | the customer is late |

The mirror is exact, which is the argument for one document type rather than
two: every asymmetry in the table is a value, not a shape.

### There is no control account, and that is deliberate

The first draft of this table had `Soll Aufwand · Haben Kreditoren` on receipt
and `Soll Kreditoren · Haben Bank` on settlement, which is what a textbook says
and **not what this plugin does**. It was written from convention without
checking, and corrected after somebody was about to create a Debitoren account
that nothing would ever have posted to.

An invoice reaches the ledger when it is settled, as one posting between the
bank account and the expense or income account. Nothing is posted when it
arrives or is sent. The vault this was built for shows the same shape on the
purchase side: it has no Kreditoren account, and the liabilities it does carry
(a card, an instalment plan, two mortgages) are debts somebody actually owes
rather than control accounts.

**What is owed lives in the invoice notes, not in the ledger.** An outgoing
invoice with no paid date is a receivable, and the finance tab totals them.
That is the receivables list, and a Debitoren account would be a second answer
to the same question, kept by hand, that could disagree with the first.

Accrual accounting -- posting the receivable when the invoice is sent and
reversing it on payment -- is a different system, not a missing feature. It
would mean two postings per invoice and a reversal, on both sides, for a
household that wants to know what it owes and is owed. If it is ever wanted it
should be wanted for both directions at once.

## The note format

One new property on `type: bill`.

| Property | Setting key | Meaning | Shape |
|---|---|---|---|
| `direction` | `billDirectionProperty` | `incoming` or `outgoing` | string |

**A note with no `direction` is incoming.** Every bill that exists today is
one, so the absent value has to mean the common case or the day this ships is
the day a vault's invoices change meaning. The property is written only on an
outgoing invoice, which also keeps the diff on existing notes empty.

That is worth keeping even though **there is only one vault**, and it is worth
saying why: a default that means the common case is not migration machinery,
it is the rule that makes the property optional. A vault where every invoice
had to declare a direction would be a vault where forgetting to is a wrong
figure in two reports.

**Written as a literal, read leniently.** `incoming` and `outgoing` are
identifiers rather than words on screen, the same rule the account kinds and
the travel statuses follow: the German labels are the translation tables' job,
and a value in frontmatter is not translated on its way in or out.

Everything else on a bill already fits. `company` is the customer instead of
the vendor; `amount`, `issueDate`, `dueDate`, `reference`, `document` and the
split `lines` mean exactly what they mean now.

### `paidDate` and `paidFrom` keep their names

On an outgoing invoice `paidDate` is the day the customer paid and `paidFrom`
is the account the money landed in, which is the opposite of what both names
suggest. **The forms show direction-appropriate labels; the frontmatter keeps
one name.**

The first draft justified this by the cost of migrating every vault. That
argument does not hold: **there is exactly one vault, `Stefan-Life`.** A rename
would be a one-time rewrite of some sixty notes, which is an afternoon and not
a reason.

The reasons that do hold are two, and they are smaller:

- **The frontmatter name is already the vault's own.** `billPaidDateProperty`
  is a setting. A vault that wants the property called `settledDate` renames it
  today, in the settings page, without any code changing. What reads oddly is
  the *TypeScript field*, which nobody's records contain.
- **`paidDate` is right for the majority and merely awkward for the rest.**
  Every bill in this vault is incoming, and outgoing invoices will be a
  minority of a minority.

So this is a choice rather than a constraint, and it can be revisited whenever
the outgoing side is common enough to be worth the churn. Recorded so nobody
mistakes it for an oversight, and so the next person does not repeat the
migration argument that was wrong.

## What the forms do differently

The bill form gains a direction control, and three things follow from it:

1. **The account picker offers expense accounts for incoming and income
   accounts for outgoing.** It offers everything today; narrowing it is part of
   this change and is worth doing in the same pass, because an outgoing invoice
   booked to an expense account is a wrong figure in two reports.
2. **The company picker narrows by role**, to `vendor` or `customer`, through
   the same setting-driven filter CULItrail's supplier dropdown uses: blank
   offers everyone, and narrowing begins when the vault has classified. Two
   settings, `billVendorRole` and `billCustomerRole`, both blank as shipped.
   The words are the vault's own -- a vault that says `Lieferant` sets that --
   which is why they are settings rather than the literals.
3. **The labels change.** `Rechnung von` against `Rechnung an`, `Bezahlt am`
   against `Beglichen am`.

A company that is both a vendor and a customer carries both roles and appears
in both pickers. That is the case the flat roles list was chosen for.

## Settlement

`MarkPaidModal` builds one posting today:

```
debit  <the expense account>      credit <paidFrom>
```

For an outgoing invoice the two swap:

```
debit  <paidFrom, the account it landed in>   credit <the income account>
```

Which means the dialog needs one conditional and no second implementation. The
near-miss check, the covering check and the duplicate guard all apply
unchanged: they compare an amount, two accounts and a date window, and none of
them cares which way round the two accounts are.

## The statement import

Deliberately **not** in the first pass, and the reason is worth stating: the
importer currently matches a statement row to an invoice the household owes,
and an inward row settling a receivable is a second matcher over the same
rows. Getting it wrong writes postings, which is the expensive failure this
module is most careful about.

When it is built, the shape is:

- An **outward** row may settle an incoming invoice. This is today's behaviour.
- An **inward** row may settle an outgoing invoice, matched on amount and the
  customer's name, with the same `alsoFits` ambiguity reporting.

`billsForImport` already returns outstanding bills; it would return them with
their direction and the matcher would ask for the ones that can be settled by
the row it is holding.

## The accounts a vault needs

None of these is code. They are accounts somebody adds once:

| Number | Kind | Why |
|---|---|---|
| e.g. 3100 | `income` | One per kind of thing the household invoices for. |

**One kind of account, not two.** A Debitoren account is not needed and would
never be posted to: see the settlement table above. What customers owe is the
outgoing invoices with no paid date.

A vault that never sends an invoice adds none of these and sees no change.

## What this is not

- **Not a second note type.** See the table at the top: every difference is a
  value.
- **Not VAT.** A household that has to account for VAT on what it invoices
  needs a tax model, and that is a larger thing than a direction property. The
  design does not preclude it and does not begin it.
- **Not receipts.** `type: purchase` stays as it is. A household sells
  occasionally and invoices for it; a Verkaufsbeleg is rarer still, and the
  pattern will be clearer once invoices work both ways.
- **Not a customer ledger.** Who owes what is the outgoing invoices with no
  paid date, which the finance list already answers once it knows the
  direction.

## Order of work

1. **Done.** `direction` on the bill format, in the core, with the
   absent-is-incoming rule and its test.
2. **Done.** The setting, in NODAtrail, and the property-keys row.
3. **Done.** The forms: the control above the fields it decides, the account
   picker narrowed by kind, the labels.
4. **Done.** The finance list: a section per direction, and two figures rather
   than one net one.
5. **Done.** `MarkPaidModal`'s swapped posting.
6. **Done.** The company picker narrowed by role.
7. **Not done, deliberately:** the statement import.

Step 3 did one thing this document did not anticipate: **changing the direction
clears the chosen account.** The account belonged to the other direction's
list, and a number still selected but no longer offered is exactly the shape
that saves an expense account onto a sales invoice.

Step 6 turned up two things the design did not anticipate, both of them the
same shape as the account one above.

**A company created from a narrowed form has to carry the role.** The plus
button beside the dropdown writes a company note, and a note without the role
the dropdown is filtering on would be rejected by the filter that had just
invited somebody to create it -- present until the form closed, gone the next
time it opened. `NewCompanyModal` therefore takes the role as a third argument
and seeds the field with it, editable like any other.

**Changing direction has to recheck the company, not only the account.** An
Obsidian dropdown holding a value with no matching option shows the *first*
option while still holding the old value, so a vendor left selected on an
invoice switched to outgoing would be invisible on screen and still be what
the note got. It is checked rather than cleared: a company carrying both roles
is valid on both sides, which is the case the flat roles list was chosen for.

**Persons are offered too, and that was not anticipated either.** The design
assumed the other party is a company. One bill in the vault had been pointing at
a Person note since before any of this shipped, and read correctly, because
`company` holds a wikilink and nothing checks the folder it resolves into. The
only thing that did not work was the picker: it offered companies alone, so
opening that bill in the edit form showed a value with no matching option --
which displays as the first company in the list. The fix is the picker, not the
format. Persons are read on the same terms as companies, narrowed by the same
two role settings, and a person note learns `account` and `category` the way a
company note does.

What stayed companies-only is the payment-provider list the statement importer
matches a row's text against. Klarna and a card acquirer are companies by
definition, and widening what that matcher will match on is widening something
that ends in a posting.

Steps 1 and 5 are the ones that write into somebody's notes and ledger. They
are the ones to review closely.
