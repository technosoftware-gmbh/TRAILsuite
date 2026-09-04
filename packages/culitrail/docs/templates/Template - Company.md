# Company

A vendor you order meals from: a ready-meal service, a caterer, a delivery
kitchen. Read on the same terms as a Person: a note in the configured
Companies folder carrying the configured type value, which is a setting
rather than a fixed word.

**CULItrail creates no company notes**, for the same reason it creates no
person notes. Write one by hand from this template, or let APERtrail create
it if you have it installed.

An order's `company:` is a wikilink resolved by title against this folder.
An order pointing at a company note that does not exist still opens and
still shows its selections; it just renders one fewer row.

## Fields

1. **Type**
   `company`, or whatever `companyTypeValue` is set to
2. **Title**
   The company's name, for Obsidian's own property editor. The filename is
   what orders link to
3. **Description**
   One line
4. **Tags** (`companyTagProperty`)
   Free tags, read from a separate setting from the person one, so the two
   can differ
5. **Address**
6. **Website**
7. **Email**
8. **Phone**
   A company gets `phone`, a person gets `mobile`. Two settings rather than
   one shared field, because that is the number you would actually use in
   each case
9. **Commercial terms** (`companyCurrencyProperty` and its six neighbours)
   What this company charges: `currency`, `paymentMethod`, `invoiceTiming`,
   `shippingFee`, `freeShippingFrom`, `discountTable` and `lines`. A new order
   from the company is pre-filled from these, and what lands in the order note
   is a plain number. **Read and never written, with one exception:** `lines:`
   is written by the **Edit a supplier's product lines** command, which edits
   that one list and touches nothing else on the note. It is the only property
   CULItrail ever writes on a contact note, and it exists because the meal
   editor has offered a dropdown of a supplier's ranges since the field did,
   with nothing to fill it in but hand-typed YAML
10. **Related orders block**
   Lists every order placed with this company, most recent first
11. **Reheating section**
    Under the same `reheatingHeading` a meal uses, with one sub-heading per
    appliance. This is the supplier's boilerplate, written once here instead
    of on every dish they sell, with `{temp}` and `{time}` filled in from
    whichever meal is being read. **CULItrail reads this section and never
    writes it**, which is its half of the shared-CRM contract. See
    [Ready meals](../design/ready-meals.md)

## Example layout

    ---
    type: company
    title: TomTasty AG
    description: Weekly ready-meal delivery
    tags:
      - Food delivery
    address: Seestrasse 513, 8038 Zürich, Switzerland
    website: https://www.example.com/
    email: info@example.com
    phone: "+41 44 000 00 00"
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
    created: "2026-08-09T09:00"
    modified: "2026-08-09T09:00"
    ---

    # Overview

    - **Kind:** ready-meal subscription, weekly delivery
    - **Order by:** Sunday evening for Wednesday delivery
    - **Where the order number comes from:** the confirmation email subject

    # Reheating

    ## Steamer
    Remove the clear plastic wrap from the dish. Use the reheat function at
    {temp} and heat it for about {time}.

    ## Microwave
    Pierce the film and heat at {temp} for {time}. Stir halfway through.

    ```culi-related-orders
    ```

## The discount ladder is counted in meals

`discountTable:` and `freeShippingFrom:` both count **portions ordered**, not
francs spent, because that is how a meal company sells. The highest rung at or
below the count is the one that applies. A rung can also be written on one
line, `12: 10`, which reads as "from twelve meals, ten percent".

`lines:` are the ranges this company sells the same dish under. The same dish
in two lines is two meal notes: the nutrition differs between them, and one
note could only state one set of figures.

## One thing worth not doing

Do not keep a list of order names in a property on the company note. It was
a reasonable thing to do before the related-orders block existed, and it
goes stale the first time an order is renamed or deleted. The block derives
the same list at read time and cannot go stale.
