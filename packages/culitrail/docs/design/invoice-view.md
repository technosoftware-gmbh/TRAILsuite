# The document view, and the model under it

> **Status: built.** An order note opens as an invoice and a delivery note opens
> as the same document without the money, the way a meal note opens as the meal
> view. Nothing is written into any note to make that happen, and every order and
> delivery already on disk renders untouched.

An order note held frontmatter and an empty body, so opening one showed its
inline title and nothing else. It now opens as a document: what was ordered,
what each line cost, what it added up to, and who chose what. A delivery note had
the same problem and now has the same answer.

The mechanism is the one meals already use, deliberately: an auto-opening
read-only `TextFileView`, a setting to turn it off, a file-menu entry to ask for
it, and a plain pencil in the header that hands the raw note back. No fenced code
block, and nothing written into a note.

## The split, and why there is one

Three parts, in two packages:

- **`trail-core`'s `document/invoice.ts`** is the model, types only.
- **`trail-core`'s `obsidian/render-invoice.ts`** builds the DOM from one.
  Neither file knows what an order is.
- **The adapters live here**: `orders/invoice-model.ts` maps an order onto the
  model, `deliveries/delivery-note-model.ts` maps a delivery onto it. Each is a
  single App-free function.

The seam existed from the first version, when both halves sat in
`src/ui/invoice/` and the argument for it was hypothetical: APERtrail might grow
records of its own, and a receipt is a receipt. **The delivery note turned that
into two consumers in one plugin, and two consumers is what earned the move into
core.** APERtrail's hotel and restaurant records are the third, and they will
import the same file rather than copy it.

**The test of whether the seam holds is the vocabulary.** There is no order, no
dish, no meal and no person anywhere in `document/invoice.ts` or
`render-invoice.ts`. If something order-shaped ever needs passing into the
renderer, the split has failed and the fix is in an adapter, not in a new
parameter.

The class names the renderer writes still carry the `culi-` prefix. CULItrail
wrote them and its stylesheet ships them in every vault that has the plugin;
renaming them would rewrite a file on disk for no gain a reader could see.

### The contract

A model is:

| Field            | What it is                                                                     |
| ---------------- | ------------------------------------------------------------------------------ |
| `documentLabel`  | What kind of document this is, in the reader's language                        |
| `reference`      | Its own identifier, already decorated (`#771823`), or null                     |
| `counterparty`   | Who the document is with                                                       |
| `facts`          | A row of label, value and optional lucide icon, for dates and the like         |
| `currency`       | Stated once beside the totals, never repeated in a cell                        |
| `columns`        | The table's headings. **A null heading means that column is absent**           |
| `lines`          | Label, optional link target, quantity, unit price, line total, all as text     |
| `totals`         | Label, amount, and a `kind` of `subtotal`, `adjustment`, `total` or `stated`   |
| `footer`         | Optional: a heading and groups of `label -> entries`, each entry linkable      |

Two properties of that shape are load-bearing:

- **Every cell is display text the adapter formatted.** The renderer never
  formats a number or a date, so rounding, currency and locale are decided in the
  one place that knows the domain. A renderer that formatted would be a second
  opinion about money.
- **A column is present exactly when it has a heading.** A separate list of flags
  beside the labels is two fields that have to agree about the same column, which
  is the shape that lets a table render a heading over nothing.

`kind` on a totals row is what lets the renderer style a bottom line without
knowing what a discount is. Four kinds are defined because the model is general;
CULItrail's two documents both emit a single `total` row, and the other three are
there for a document that genuinely walks down a column.

## Which columns an order shows

`orders/invoice-model.ts` decides, and the rule is the one `trail-core`'s
`order/total.ts` already argues for, applied to the layout:

- **Unit price and line total, only when at least one line carries a price.** All
  59 order notes in the vault this was built against predate line prices.
  Rendering them a column of dashes and a computed 0.00 beside a stated 89.40
  would read as a plugin that had lost the money, which is exactly why
  `computedOrderTotal()` returns null rather than zero.
- **Quantity, when it says something.** Alongside the prices, where it is what
  turns a unit price into a line total and its absence would make the two look
  inconsistent, or when any dish was ordered more than once. A column of 1s on an
  unpriced order adds nothing.

An unpriced order therefore shows a plain list of dishes, its total, and no
arithmetic at all.

## One total, and which one

**The bottom of the document is a single row.** It used to be four -- a subtotal,
each adjustment, the figure computed from the lines and the figure the note
states -- and every one of them existed because a note could say one thing while
its lines said another, with no way to know which was right.

That is settled at the source instead. **An order that has line prices is
totalled from them**, because the editor computes the total rather than asking
for it, so the two can no longer disagree. **An order that has none uses the
total somebody typed**, which is every order written before line prices existed
and the only thing such a note knows about money. `documentTotal()` in the
adapter is those two sentences; there is no third case, so there is no second
row.

A note hand-edited to state a figure its lines contradict therefore renders the
figure from the lines, silently. That is deliberate: the lines are the record the
stated total was derived from, and re-opening the disagreement in the layout was
what the old four rows cost.

**The discount, the shipping and the VAT are facts**, up beside the dates, not
rows in a sum. On an unpriced order that was already true, for want of a subtotal
to take a discount off; making it true everywhere means a reader looking for "was
there a discount on this one" finds it in the same place whichever kind of order
they opened. The VAT figure is taken off the total the document actually prints,
so a hand-edited note cannot show a VAT share of a number that is nowhere on the
page.

## The arithmetic lives in one module

Everything the adapter states about money comes from `trail-core`'s `order/total.ts`:
`dishLines()` for one row per distinct dish, `computedOrderTotal()` for the
bottom line, `selectionTitles()` for the footer and `includedVat()` for the tax
fact. `itemTotal()` and `orderSubtotal()` are in the same module and are the
order editor's rather than this document's, since a document with one total has
no subtotal row to fill; `computedOrderTotal()` sums `orderSubtotal()` behind the
adapter's back. `totalsDisagree()` went unused here when the four totals rows
became one: there is no longer a row for saying so.

The compact card in the orders list and this invoice are deliberately two
different documents: a row in a list of everything bought, against one order read
end to end. **They agree on every order this vault holds**, because no real order
carries line prices and both then show the figure the note states. Their
precedence is not the same, though, and that is unresolved rather than decided:
the card and the sort read the stated total first and compute only where nothing
is stated, while `documentTotal()` here computes first and falls back to the
stated figure. On an order carrying line prices that contradict its stated total,
the list and the document would print different numbers.

## What a delivery document is

`deliveries/delivery-note-model.ts` is **the invoice without the money**: the
same header, facts, table, total and footer, with no currency, no unit price and
no line total anywhere. A box has no price, and columns of dashes would be the
document claiming something the note does not say.

- **The supplier is read off the orders it settles**, because a delivery note
  names none of its own. Two suppliers in one box is not a case worth a layout,
  but it is one worth being honest about, so both names are shown rather than the
  first one silently winning.
- **The quantity column appears exactly when the portions total would otherwise
  look unaccountable**, that is, when any dish arrived more than once. Same rule
  as the order document's, applied to the one number a delivery has.
- **The footer lists the orders it settles, grouped by supplier**, so the block
  has the shape the order document's footer has. An order whose note has gone is
  still listed, with no supplier behind it: dropping it would hide a broken link
  rather than show it.
- **An order whose title cannot be resolved still renders.** The adapter takes a
  `SettledOrder` -- a title and a supplier, nothing else -- rather than an
  `OrderRecord`, which is what makes that possible and what keeps it testable
  without a vault.

## How a second plugin adopts it

Two steps, now that the model is in core:

1. **Import it.** `import type { InvoiceModel } from '@technosoftware/trail-core'` and
   `import { renderInvoice } from '@technosoftware/trail-core/obsidian'`. The `culi-invoice-*`
   rules have to be in that plugin's own `styles.css`, since the renderer writes
   the class names and each plugin ships its own stylesheet.
2. **Write an adapter.** One function, from that plugin's record to an
   `InvoiceModel`, App-free so it is unit-testable without a vault. That is where
   its own version of the column rule goes, and where every figure it states
   comes out of that domain's own arithmetic module rather than being computed in
   the adapter.

Unlike [the shared CRM](shared-crm.md), which is two implementations of one
written contract, this is one implementation both plugins import. The difference
is what the contract is about: a CRM contract is about notes on disk that neither
plugin owns, and this is about code.

## Auto-open serves both kinds now

`meals/lifecycle/` used to name meals in three places. The decision in
`auto-open.ts` is now kind-agnostic (`shouldOpenInOwnView`, taking `isSubject`),
and `register-lifecycle.ts` takes a list of targets: a kind, a view type, the
setting that enables it, how to open it, and its file-menu label.

Nothing about the reasoning already recorded in those files changed. Both events
are still bound (`file-open` for navigating within a leaf, `active-leaf-change`
for focusing another one), the suppression is still a timed set rather than a
consume-once flag because one `setViewState()` fires both, and **the suppression
is asked once rather than per target**: it is about this path having just been
handed back as Markdown deliberately, whatever it would otherwise have opened as.

There are four targets now: meals, plan notes, orders and deliveries.

`autoOpenOrderView` is a separate setting from `autoOpenMealView` on purpose.
Somebody who wants a meal rendered has said nothing about how they want to read
an order. `autoOpenDeliveryView` is separate again, and it is the one that
defaults on for a reason of its own: a delivery note holds everything it knows in
frontmatter, so with it off Obsidian shows a blank page.

## Sharp edges

- **An icon-only button sizes its own svg.** The fact icons here are spans rather
  than buttons, but the rule is why `.culi-invoice-fact-icon svg` states a width
  and a height.
- **The empty remark span in a totals row is deliberate.** The row is a
  three-column grid so the amounts line up down the block, and a row that skipped
  its remark would place its amount in the remark's column.
- **The table scrolls sideways inside the document rather than widening it.** On
  a phone the dish column alone can be wider than the pane, and a view that grows
  past its own edge takes the header and the totals with it.
