# Delivery

What actually arrived, and when. One note per box, under `deliveriesFolder`,
carrying `deliveryTypeValue` in its type property.

Normally written by the **Record a delivery** dialog. This template is for
hand-writing one, and for knowing what a hand-edit will survive.

## Why this is not a field on the order

Two cases will not fit inside an order note: an order can arrive in two boxes
a week apart, and one box can settle two orders. Both happen with a meal
company, and a delivery modelled as a property of an order would have to lie
about one of them.

The distinction it buys is the one the meal plan needs. An order says what was
asked for; a delivery says what is in the freezer now.

## The filename is the date

`yyyy-mm-dd.md`, for example `2026-02-18.md`, with a suffix when two boxes
arrive on one day: `2026-02-18-2.md`.

Unlike an order, **a delivery is never renamed** when its date is corrected.
The `deliveryDate:` property wins on read, so the corrected date is already the
one that counts, and renaming would break links somebody has made to the note.

## Fields

1. **Type**
   `delivery`, or whatever `deliveryTypeValue` is set to
2. **Delivery date** (`deliveryDatePropertyName`)
   A plain `yyyy-mm-dd` date. Falls back to the date in the filename when
   absent, and wins over it when present
3. **Orders** (`deliveryOrdersProperty`)
   A **list** of `[[Order]]` wikilinks, resolved by title. May be empty: the
   freezer knows what is in it whether or not the paperwork was filed
4. **Items** (`deliveryItemsProperty`)
   What was in the box. Each entry pairs `meal:` (`deliveryItemMealField`)
   with `quantity:` (`deliveryItemQuantityField`)

A quantity of 1 is omitted, the way an order line omits it, and a quantity of 0
is read as 1 rather than as nothing: a line something did not arrive for is a
line to delete, not a line to write a zero on.

A bare wikilink is accepted in place of a mapping, because a box of six
different dishes is quicker to type as a plain list:

    items:
      - "[[Penne alla Norma]]"
      - "[[Coconut Pumpkin Soup]]"

## Example layout

    ---
    type: delivery
    deliveryDate: 2026-02-18
    orders:
      - "[[2026-02-13-23624]]"
      - "[[2026-02-15-23701]]"
    items:
      - meal: "[[Penne alla Norma]]"
        quantity: 2
      - meal: "[[Coconut Pumpkin Soup]]"
      - meal: "[[Jambalaya with Chicken and Shrimp]]"
    created: "2026-02-18T13:35"
    ---

The body is yours. The writer clears only the frontmatter keys the delivery
schema owns and never touches what is below the fence.

## What reads it

The meal picker. Dishes from the most recent dated delivery are offered at the
top of the list when planning a week, and marked, so the plan is built from
what is actually in the house. They are sorted to the top rather than filtered
to: the freezer holds more than the last box.

A delivery with no date is skipped when working out which one is the most
recent. "The last one" is a claim about time, and a note stating no date cannot
support it however it happens to sort.
