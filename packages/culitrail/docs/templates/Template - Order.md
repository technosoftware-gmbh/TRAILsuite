# Order

What was bought from a company, by whom, and for how much. One note per
order, under `ordersFolder`, carrying `orderTypeValue` in its type
property.

Normally written by the **New order** modal. This template is for
hand-writing one, and for knowing what a hand-edit will survive.

## The filename carries the order number

`yyyy-mm-dd-ordernumber.md`, for example `2026-02-13-23624.md`.

The order number lives **only** here. There is no frontmatter property for
it and therefore no setting. Rename the file and you have renamed the order.

## Fields

1. **Type**
   `order`, or whatever `orderTypeValue` is set to
2. **Company** (`orderCompanyProperty`)
   A `[[Company]]` wikilink, resolved by note title against
   `companiesFolder`. An unresolved link renders one fewer row rather than
   breaking the view
3. **Order date** (`orderDateProperty`)
   A plain `yyyy-mm-dd` date. No clock time, so quoting is not needed
4. **Delivery date** (`orderDeliveryDateProperty`)
   Same
5. **Price** (`orderPriceProperty`)
   A number, the order total. Not per person
6. **Currency** (`orderPriceCurrencyProperty`)
   Defaults to `orderDefaultCurrency` on a new order
7. **Discount and shipping** (`orderDiscountProperty`, `orderShippingProperty`)
   Numbers, off and onto the whole order. Both are pre-filled from the
   company's terms when the order is written and are plain figures afterwards
8. **VAT** (`orderVatRateProperty`, `orderVatAmountProperty`)
   Optional. Every price in the note is gross; these say how much of it was
   tax. Either can appear without the other
9. **Selections** (`orderSelectionsProperty`)
   A list, one entry per person. Each entry pairs `person:`
   (`orderSelectionPersonField`) with `meals:`
   (`orderSelectionMealsField`)

`person` and `meals` are **sub-keys inside a list entry**, not top-level
properties. They are still settings, so a vault can spell them differently;
what it cannot do is restructure the list.

Once any line carries a price, a quantity or a discount, `meals:` is written as
`items:` (`orderSelectionItemsField`) instead, one entry per dish with `meal:`,
`price:`, `quantity:` and `discount:`. An order with none of them stays in the
simpler shape, so saving an untouched order rewrites nothing. **A line price is
what was charged**, not what the dish costs today: a meal's own `price:` is only
the default the editor offers when the dish is added. A line `discount:` is a
percentage off that line alone, on top of whatever comes off the order.

## The v1 schema, for reading only

Orders written before the list-based schema carry one flat property per
person, built from `orderSelectionPropertyPrefix`:

    selectionStefan:
      - "[[Penne alla Norma]]"
    selectionErika:
      - "[[Risotto alla Puttanesca]]"

Those still **read** correctly, and any save through the modal upgrades the
note to the list form. Do not write new notes this way: it keys by first
name only, which collides the moment two people share one.

## Example layout

    ---
    type: order
    company: "[[TomTasty AG]]"
    orderDate: 2026-02-13
    deliveryDate: 2026-02-18
    price: 128.2
    priceCurrency: CHF
    discount: 12.8
    shipping: 0
    vatRate: 2.6
    selections:
      - person: "[[Erika]]"
        meals:
          - "[[Chicken Saltimbocca with Caponata]]"
          - "[[Risotto alla Puttanesca]]"
          - "[[Leek and Potato Soup]]"
      - person: "[[Stefan]]"
        meals:
          - "[[Penne alla Norma]]"
          - "[[Jambalaya with Chicken and Shrimp]]"
          - "[[Coconut Pumpkin Soup]]"
    created: "2026-02-13T10:37"
    modified: "2026-02-18T13:35"
    ---

The body is yours. The writer clears only the frontmatter keys the order
schema owns and never touches what is below the fence, so a note added by
hand under the frontmatter survives every edit through the modal.
