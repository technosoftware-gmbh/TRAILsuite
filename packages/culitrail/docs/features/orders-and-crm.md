# Orders, people & companies

> **Status: built.** The `culi-related-orders` block, the last piece that was
> still outstanding, ships too.

Every meal in this vault is bought from a company. An **order** records what
was ordered, by whom, for how much, and when it arrives, and it is the note
that connects a meal to the supplier whose reheating wording it borrows.

## The order note

One note per order, under `ordersFolder`, carrying `orderTypeValue`
(default `order`) in its type property.

**Filename:** `yyyy-mm-dd-ordernumber.md`, for example
`2026-02-13-23624.md`. The order number lives **only** in the filename,
never in frontmatter, so there is no property and no setting for it. That is
worth knowing before going looking for one.

**Frontmatter** (property names all configurable, English defaults shown):

| Property | Holds |
|---|---|
| `company` | A `[[Company]]` wikilink |
| `orderDate` | When the order was placed |
| `deliveryDate` | When it is expected |
| `price` | The order total, as typed |
| `priceCurrency` | Defaults to `orderDefaultCurrency`, `CHF` |
| `discount` | Taken off the whole order, not off any one dish |
| `shipping` | Added to it |
| `vatRate`, `vatAmount` | How much of the gross was tax. Stated, never computed |
| `selections` | A list, one entry per person |

Each `selections` entry pairs a `person:` wikilink with that person's dishes.

```yaml
selections:
  - person: "[[Erika]]"
    meals:
      - "[[Chicken Saltimbocca with Caponata]]"
      - "[[Risotto alla Puttanesca]]"
  - person: "[[Stefan]]"
    meals:
      - "[[Penne alla Norma]]"
```

### What a dish cost: the priced schema

Once a line carries a price, a quantity or a discount, the bare `meals:` list is
written as `items:` instead, one entry per dish:

```yaml
discount: 5
shipping: 7.9
vatRate: 2.6
selections:
  - person: "[[Stefan]]"
    items:
      - meal: "[[Tom Yum Gai]]"
        price: 17.5
      - meal: "[[Penne alla Norma]]"
        price: 19.9
        quantity: 2
        discount: 20
```

A line's `discount:` is a percentage off that line alone, on top of whatever
comes off the whole order. It exists because a company runs an offer on one
dish rather than on a basket, and expressing that by editing the price would
lose what the dish normally costs.

**The price on a line is what was charged, not what the dish costs today.** A
meal's own `price:` is only the default the editor fills in when the dish is
added; a supplier raising it later must not change what an order from last year
says, because an order note is a record of a transaction. Nothing in the reader
consults a meal note, so there is no path by which it could.

Three rules follow from that, and each is deliberate:

- **An order with no prices and no quantities keeps the `meals:` shape.** Saving
  an untouched order does not rewrite it into a priced form that says nothing new.
  Verified against a real vault of 59 orders: reading and rewriting every one of
  them changes not a single note.
- **Nothing is backfilled.** An existing order is never given prices from today's
  dish prices, for the reason above. Lines gain prices only when somebody types
  them.
- **A quantity of 1 is omitted** rather than written out, and a quantity of 0 is
  read as 1 rather than as a free line.

**Every price is gross**, which is what a meal company's invoice says and what
these notes have always meant. `vatRate:` and `vatAmount:` are what a note may
additionally claim about how much of that was tax, and the invoice prints it as
an included line under the total. Nothing is computed from them: an order
stating neither means exactly what it did before they existed, and one stating
both is not checked against itself.

**An order states one total.** Once any line carries a price the editor computes
it from the lines and locks the field, rather than showing a computed figure
beside a typed one: two answers to one question, with nothing in the note able to
say which was meant, is a worse thing to store than one answer. An order with no
priced lines keeps the total somebody typed, which is what keeps those 59 notes
from being handed a computed 0.00 in place of a real figure.

### The v1 schema

Older notes may still carry a flat, one-property-per-person shape built from
`orderSelectionPropertyPrefix`, for example `selectionStefan:`. Those are
still **read** correctly, and every save through the modal upgrades the note
to the list-based schema above.

The flat scheme keys by first name only and is therefore collision-prone,
which is exactly why it was replaced. New notes are always written in the
current form; the old one is documented here only because it can still show
up when reading pre-existing orders.

## Creating and editing

**New order** (the Orders view's own button) opens a modal that builds one from
scratch: pick the company, the dates, the total, the discount and the shipping,
then for each eligible person pick their meals from a searchable picker
restricted to the meal scan scope. The same modal reopens in edit mode from an
order row's actions, and from the invoice an order note opens as.

Under the picker, a **what it cost** section lists the dishes actually chosen, one
row each, with a single price for the dish. The **Total** field above the picker
is filled in from those prices as they are typed and locked while any of them
says anything, so the dialog states the total in one place rather than two.
A section of its own rather than a price box beside each
of a hundred and twenty-six checkboxes: the list is as long as the order rather than
as long as the library. Ticking a dish seeds its price from the meal's own, which
is the one moment that value is read.

**One row per dish, not per person, because a price belongs to the meal.** Two people
choosing the same dish pay the same for it, so offering two separately editable
prices would only invite them to disagree; editing the price sets it on every line
that names that dish. A dish two people chose shows `x 2`, which counts portions
rather than people. The person's name is not in the row at all.

**A quantity is read and honoured but not editable here.** The picker is a set of
checkboxes, so it can express "these two people each had one" and cannot express
"this person had two"; a field the rest of the dialog contradicts is worse than no
field. A note edited by hand can carry any quantity and the total counts it, which is
the usual arrangement here.

Choosing the company, or adding a dish, re-offers what that company charges:
the currency, the shipping fee (zero once the order is large enough to earn
free delivery) and the quantity discount, as money rather than as a percentage.
A field somebody has typed into is never overwritten again, because correcting
a shipping fee by hand and then adding one more dish would otherwise silently
undo the correction.

The writer clears only the keys the order schema owns and never touches the
note body, so it is one save path rather than a set of field-level writes.

## The Orders view

Orders newest first, each row showing the company, the order number, the
dates, the total and, underneath, each person's chosen meals as links
resolved by title.

A flat list rather than a week-grouped, week-navigable one. Orders are read to answer "what did we buy, and when", which is a question
the newest-first order already answers; a week the list has to be walked to
is a control between somebody and the row they are looking for.

**The toolbar is the gallery's**, literally the same component
(`src/ui/toolbar.ts`), because an order list and a meal library are both
"everything of one kind, narrowed", and two arrangements for that would be two
things to learn and two places for a button to end up the wrong size: a search
field, a filter button, a sort menu, then **New order** and **Record a
delivery**.

- **Search** matches the supplier, the order number, the note's own title, the
  people it names and the dishes somebody picked, because "when did we last
  order the ramen" is a question the company name alone cannot answer.
- **Filter** narrows to one supplier, to one year, or to orders **no delivery
  has been logged against**. That last one is a question about the *other*
  note: a delivery names the orders it settles, so an order counts as
  delivered when some delivery says so, not when its own date property happens
  to be filled in.
- **Sort** by order date, delivery date, supplier or total, in either
  direction. **A missing value sorts last both ways**: an order with no
  delivery date is not the earliest delivery, it is one with nothing to
  compare.

Where the toolbar was left is remembered between sessions, in
`ordersSavedState`, exactly as the gallery's is. The deliveries listed
underneath the orders are deliberately **not** narrowed with it: they answer
"has the box been logged", which is a question about all of them.

## Opening one order

An order note opens as an **invoice**, the same way a meal note opens as the
meal view: the supplier and the order number at the top, when it was ordered
and when it came, one row per dish with the quantity, the unit price and the line
total, the totals underneath, and who ordered what at the bottom. Dish names are
links, resolved by title.

Nothing is written into the note to make that work, so an order written before
this existed renders the same as one written today. **An order whose lines carry
no price shows no price columns**, only the total the note states. A column of
dashes beside a stated 89.40 would read as a plugin that had lost the money.

**There is one total at the bottom.** An order with line prices is totalled from
them, an order without uses the figure somebody typed, and the discount, the
shipping and the VAT sit up in the facts row beside the dates rather than as
steps in a sum.

Two buttons in the header: the square pencil opens the same editor the Orders
view uses, and the plain pencil hands the raw Markdown back. Auto-opening is
`autoOpenOrderView`, under Browsing with the other three, since what opens
itself is a preference about Obsidian rather than about orders; with it off,
**Open in order view** in the note's file menu asks for it. The document model under it is
format-agnostic, lives in `trail-core`, and is described in
`docs/design/invoice-view.md`.

## Deliveries

An order says what was asked for. A **delivery** says what arrived, and when.

One note per box, under `deliveriesFolder`, carrying `deliveryTypeValue`
(default `delivery`). The filename is the date, `2026-02-18.md`, with a numeric
suffix when two boxes come on one day.

```yaml
type: delivery
deliveryDate: 2026-02-18
orders:
  - "[[2026-02-13-23624]]"
items:
  - meal: "[[Penne alla Norma]]"
    quantity: 2
  - meal: "[[Coconut Pumpkin Soup]]"
```

**A kind of its own rather than a field on the order**, and the reason is the
two cases that will not fit inside one: an order can arrive in two boxes a week
apart, and one box can settle two orders. Both happen with a meal company, and
a delivery modelled as a property of an order would have to lie about one of
them. `orders:` is therefore a list, and it may be empty: the freezer knows
what is in it whether or not the paperwork was filed.

As on an order line, a quantity of 1 is omitted and a quantity of 0 is read as
1. A bare wikilink is accepted in place of a mapping, because a box of six
different dishes is quicker to type as a plain list.

### Reading one

A delivery note opens as **the invoice without the money**: the supplier across
the top, the date it arrived, one row per dish, the portions it came to, and the
orders it settles underneath. No currency, no prices, no computed anything -- a
box has no price, and a document implying one would claim something the note does
not say.

The supplier is read off the orders it settles, since a delivery names none of
its own, and the quantity column appears only when a dish arrived more than once,
which is when the portions total would otherwise look unaccountable.

It carries the same handles an order note does: two pencils in the header,
**Open in delivery view** in the file menu, both commands in the palette. The
setting is `autoOpenDeliveryView`, under Browsing with the other three, and it
**defaults on**, as all four do: a delivery note keeps everything it knows in
frontmatter, so with it off there is nothing on the page at all.

### Recording one

**Record a delivery** sits in the Orders view's toolbar, on each order row, and
in the command palette. Opened from an order, that order arrives already
ticked.

Ticking an order fills the dish list with **what that order is still waiting
for** rather than everything it asked for: ordered, minus whatever earlier
deliveries against the same order already brought. A meal company splits an
order across two boxes often enough that working the remainder out by hand from
two notes is exactly the arithmetic a plugin should be doing.

**Ticking adds; unticking takes nothing back.** By the time somebody unticks,
the list may have been corrected by hand, and a dialog that silently undid
those corrections would be worse than one that leaves a row to delete. A dish
nothing ordered can be added from the dropdown underneath, because a box can
hold a substitution, a sample or a gift.

Recorded deliveries are listed under the orders in the Orders view, newest
first. Correcting the date of one does **not** rename its note: the property
wins on read, so the correction already counts, and renaming would break links
somebody has made to it.

### What it is for

The meal plan. An order is a purchase; a delivery is the freezer. When a meal
is picked for the plan, the dishes from the most recent delivery are offered at
the top of the picker and marked, so a week is built from what is actually in
the house.

They are **sorted to the top, not filtered to**. The freezer holds more than
the last box, and a picker that hid the rest could not plan the dish that
arrived a fortnight ago.

## People and companies

CULItrail **reads** Person and Company notes. It creates neither, and it
keeps no contact registry of its own.

A note counts as a person because it sits under `personsFolder` and its type
property holds `personTypeValue`; a company because it sits under
`companiesFolder` and holds `companyTypeValue`. Both values are settings
rather than fixed words, which is what lets these stay folders your vault
already owned, spelled its own way.

| Setting | Default |
|---|---|
| `personsFolder` | `CRM/People` *(German: `CRM/Personen`)* |
| `personTypeValue` | `person` |
| `personTagProperty` | `tags` |
| `eligiblePersonTags` | empty |
| `companiesFolder` | `CRM/Companies` *(`CRM/Firmen`)* |
| `companyTypeValue` | `company` |
| `companyTagProperty` | `tags` |

Person and company get one tag property each rather than sharing one, so
neither setting's name has to lie about what it covers.

### What a company charges

A Company note can state its commercial terms, and a new order from that
company starts out filled in from them:

```yaml
currency: CHF
paymentMethod: Invoice
invoiceTiming: With the delivery
shippingFee: 9.9
freeShippingFrom: 12
discountTable:
  - from: 12
    percent: 5
  - from: 24
    percent: 10
lines:
  - Alltag
  - Sport
  - Weightloss
```

The discount ladder is counted **in meals**, not in money, because that is how
a meal company sells: the highest rung at or below the number of portions
ordered is the one that applies, and `12: 10` on one line is accepted as a
shorthand for the two-key form. `freeShippingFrom:` counts the same way.

`lines:` are the ranges the company sells the same dish under. The same dish in
two lines is two meal notes, because the nutrition differs and one note could
only state one set of figures.

**This is a default, not a derivation.** What lands in the order note is a
plain number, and from then on the note says what was charged. A company that
raises its shipping next year must not change what an order from today says,
for exactly the reason a line's price is recorded rather than looked up. Every
one of these terms is read and never written, with the single exception of
`lines:`, below.

### The one thing CULItrail writes on a company note

**`lines:` is the exception to "reads, never writes".** The meal editor has
offered a dropdown of a supplier's ranges for as long as the field has existed
and nothing ever wrote that property, so the only way to fill it in was to type
YAML into the company note by hand. **Edit a supplier's product lines**, in the
command palette, picks a supplier and edits that one list: it writes
`companyLinesProperty` and removes the property when the list is emptied, and it
touches nothing else on the note. Blank rows are dropped rather than written,
since a line named `''` would be an option in the meal editor that says nothing
and selects nothing.

It is a command rather than a button on a form, because a supplier with no meals
yet has no meal to open, and its lines are worth entering before the first dish
from it rather than after. The picker is narrowed by `mealSupplierRole`, the
same filter the meal editor's supplier dropdown uses, so this does not become a
list of every company the vault has ever paid.

### The eligibility filter

`eligiblePersonTags` (comma-separated, read from `personTagProperty`)
narrows which people are offered as an order recipient **and** as a
selectable meal-plan person. It is useful when a person-typed note exists
for reference only, such as somebody an old order names, and should not appear
as a household member.

**An empty filter means everyone, never nobody.** Turning the feature on
does not silently hide every person until it is configured.

### One folder, not many

CULItrail has one `personsFolder`. There is no registry of person folders,
so people cannot be split across several of them and deduped across all.

This is a real limitation and it was taken deliberately. It is what makes
sharing contacts with APERtrail possible at all, since APERtrail also has
exactly one, and a vault that genuinely needs two person folders is better
served by one folder with a tag than by two settings that have to agree.
`eligiblePersonTags` is that tag.

### CULItrail does not create contact notes

APERtrail writes person and company notes; CULItrail does not. That
asymmetry is on purpose and is the simplest thing that cannot go wrong: two
plugins that both offer "New person" would produce two notes with different
frontmatter for the same person the first time somebody used the wrong
button.

In a vault without APERtrail, person notes are created by hand or from a
template. See [Templates](../templates/index.md).

### Sharing contacts with APERtrail

When APERtrail is also installed, both plugins read the same two folders, by
default, in both locales, with the same type values and tag properties.
Neither depends on the other at runtime: no shared code, no plugin lookup,
no imported types. They agree through the vault, which is the only place two
Obsidian plugins should have to agree.

On a **fresh** install, CULItrail reads APERtrail's `data.json` once and adopts
only the CRM-shaped settings it finds there, so a vault that already configured
one plugin does not configure the second from scratch. Nothing else is adopted:
adopting a folder only changes where the plugin looks, adopting a behaviour
toggle changes what it does.

The full contract, including what it deliberately does not mean, is in
[Shared CRM](../design/shared-crm.md).

## The related-orders block

A fenced code block on a person or company note:

````markdown
```culi-related-orders
```
````

It lists every order naming that note, most recent first, with the meals
chosen in each. It takes no arguments and works out what to render from the
note it sits in, so it is copy-pasteable between notes and cannot be pointed
at the wrong one.

A person note in a vault with both plugins carries this block alongside
APERtrail's `travel-related-trips`, each answering its own question about
the same person. When a plugin is absent its fence simply does not render,
which is visible and harmless.
