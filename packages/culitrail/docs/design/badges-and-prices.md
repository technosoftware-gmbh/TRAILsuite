# Badges as figures, and what a ready meal costs

> **Status: all six phases built.** Two pieces that arrived together and are written
> up together because the fourth request joins them: the badge row became a strip of
> figures, and a ready meal has a price that the strip sits over.
>
> **Read the per-phase sections at the end before changing any of this.** Each one
> records what building it contradicted, and there is a lot of that: this page argued
> for two separate strips and was reversed by counting the library, missed a fourth
> copy of the component it was consolidating, forgot that the meal header is more
> than one layout, and put the price in a band that had stopped existing by the
> time it got there. The sections are not a changelog; they are the reasons the code does not
> match parts of the design above.
>
> The price half was deliberately split: the dish price shipped first, and the order
> arithmetic followed as phase 6 with its own review, because it changes the order
> note format.

Four requests, in the order they were given:

1. Meal badges should look like a shop's product card: a small uppercase label
   with the figure under it, no pill, no icon.
2. The diet badge belongs under the title, not in with the figures.
3. A ready meal has a price. Nothing uses it yet; in future an order's total is
   the sum of its meals, minus a discount, plus shipping.
4. The information a card shows today can move into a strip under the price.

## The finding that shapes the first half

**This pattern is already in the codebase three times, and none of the three is
the badge row.** That makes the first half a consolidation rather than a new
component, which is a much smaller and much safer change than it looks:

| Where                                              | Class                | Shape                                                        |
| -------------------------------------------------- | -------------------- | ------------------------------------------------------------ |
| Meta banner nutrition (`view/meta-banner.ts`)       | `culi-nutrition-grid` | `grid-template-columns: repeat(4, auto)`, label `grid-row: 1`, value `grid-row: 2` |
| Mobile times (`view/mobile/stat-row.ts`)            | `culi-mobile-stat-row`| flex cells, `culi-label-caps` over `culi-mobile-stat-value`, bordered box |
| Mobile Info nutrition (`view/mobile/info-panel.ts`) | `culi-mobile-nutrition-strip` | flex cells, bordered box, and the **figure above the label** |
| Header and card badges (`view/badge-row.ts`)        | `culi-badge`          | a pill: icon, uppercase label, value, inline                  |

The third row was missed when this page was first written and found by grepping
for the classes during the build. It matters more than a miscount: it is the only
one of the three that put the figure first, and it sits directly below the times
strip in the same view, so two strips on one screen disagreed about their own
shape.

The first of those **is** the requested look, already shipping, already
per-serving. So the design is not "invent a strip". It is: extract the strip that
exists, render the badge row through it, and let the other two callers stop
carrying their own copy.

That also means `culi-mobile-stat-row` stops being a mobile-only special case. It
exists because a phone needed times big enough to read across a worktop; if every
surface renders figures that way, the divergence has no reason left.

## Part 1: the strip

### A cell holds exactly one label and one figure, and that rule decides everything

A pill is elastic. It can hold an icon and no value (Favorite), or three values
(`diet: [vegetarian, gluten-free, low-carb]` renders as three pills). A strip cell
cannot: it is one label over one figure, in a column of fixed width, aligned with
its neighbours. Put a valueless badge in one and you get a label over a blank; put
a three-value badge in one and either it overflows its column or it silently shows
the first.

So the split is structural, not a preference, and it does not need a new setting
to decide it:

- **A badge with exactly one value renders as a cell.**
- **A badge with no value, or more than one, renders as a chip**, in a chip row
  above the strip.

`CustomBadge` gains `display?: 'chip' | 'cell'` for the case where somebody wants
a single-valued badge as a chip anyway, but **absent resolves by the rule above**
rather than by a migration. That matters: `headerBadges` is a saved list, and a
field whose absence had to be repaired on load is the kind of thing that
misreads a hand-edited `data.json`. Nothing needs writing to `data.json` for the
restyle to land.

Diet lands in the chip row by that rule alone, since `splitArray: true` is how it
already ships. Request 2 is therefore not a special case: **it is what the rule
does**, which is the version worth having.

### What a cell drops, and the honesty problem that creates

A cell has no pill, so it has no background to tint and no room for an icon
before the label. Two `CustomBadge` fields stop meaning anything in cell mode:

- **`icon` is not rendered in a cell.** The mockup has none, and an icon above a
  two-line cell makes the strip's rows stop aligning.
- **`color` tints the value text** rather than a background.

The trap here is the settings editor. Six badges ship built in: Diet, Prep,
Reheat, Total, Last eaten and Streak, the last of them switched off so that
nobody's already-arranged header gains a chip they did not ask for. Four of them
carry a `clock` or a `calendar-check` icon and the badge editor offers an icon
picker, so after this change somebody can pick an icon and see nothing happen. That is exactly the
class of bug this plugin has shipped twice with `setIcon` and an unknown Lucide
name, arriving from the other direction. **The badge editor's icon and colour
fields get a note saying they apply to chip display**, and the fields stay: a
badge can move between the two modes, and clearing a field that only some modes
read is worse than labelling it.

### The nutrition figures stay their own strip, with their caption

The mockup's four figures are nutrition. The clarification given with it is the
important part: **the strip's figures are the per-serving totals, while the
breakdown a note declares is per 100 g.** That breakdown is frontmatter now and
has a surface of its own, a card below the description on desktop and a tab on
mobile, which is what makes this caption load-bearing rather than decorative:
two sets of nutrition figures are on one screen, and the caption and the card's
own heading are the only things saying which is which.

CULItrail already resolves exactly that. `view-model/nutrition-row.ts` returns four
cells and a caption, through `displayedNutrition()`, which handles per-serving
against whole-meal and the case where a meal states nutrition but no servings and
therefore cannot be converted at all.

Two things follow, and the second is a decision worth not undoing:

- **No new nutrition built-in badges.** Four badges reading calories, protein,
  carbs and fat would be a second path to numbers the meta banner already derives,
  and the two could disagree on a note whose servings are missing. A vault that
  wants one anyway can add a custom badge for any property; the mechanism exists.
  This also sidesteps the `withMissingBuiltins()` rule entirely: a new built-in
  must ship `enabled: false` to reach a vault with a saved badge list, so four new
  built-ins would arrive switched off and need four toggles to reproduce the
  mockup.
- **The nutrition strip keeps its caption and stays separate from the badge
  strip.** `nutrition-row.ts` exists because "600 kcal with no indication of
  whether that is a plate or a tray" is the failure it prevents. Merge the
  nutrition cells into the badge strip and that caption ends up sitting under
  `PREP` and `LAST EATEN` as well, describing cells it says nothing about. Two
  strips, one captioned.

### Where each surface puts what

| Surface | Order, top to bottom |
| --- | --- |
| Gallery card | image with title overlay → **chip row (diet)** → **nutrition strip** → **price** → **info strip (total time, times eaten, last eaten)** |
| Meal header, desktop | `h1` → chip row (diet) → tags → stars → meta banner (serves, **price cell**, nutrition strip) → **badge strip** |
| Meal header, mobile | unchanged in structure; `culi-mobile-stat-row` becomes the shared strip, so the times it shows and the badge strip are the same component |

Request 4 is the card's third row: the icon-and-text meta row
(`culi-gallery-card-meta-row`) becomes strip cells under the price.

**The card's title stays overlaid on the image.** The mockup puts it underneath,
and this deliberately does not follow it: the overlay is what lets a card be a
picture at card size, and moving the title into the info block adds one to four
lines of variable height directly into the thing the next section is about.

### The card's height is the risk in this half, not the CSS

`CLAUDE.md` states the rule and the meal-plan week card is the worked example: a
card in a grid of cards is one fixed size, and its height must not depend on what
it happens to contain. This change adds **two new rows to every card**, one of
which (price) is absent on most meals and one of which (the strip) has a
variable number of cells.

Three rules, and as with the week grid none is sufficient alone:

1. **The price row is always present**, rendering empty rather than being skipped,
   so a priced and an unpriced dish are the same height.
2. **The strip does not wrap.** A fixed cell count with `overflow: hidden`, not
   `auto-fit`. Four cells is the mockup; the fifth is dropped on a card and kept
   in the header.
3. **A cell's value is one line**, clamped. `2 h 30 min` and `24.08.2026` are both
   plausible values and both are longer than `615`.

**Measured, not guessed.** There is a harness precedent for this: the week grid's
cards were 61px to 126px until they were measured, and the fix was verified at
80px uniform across six widths. The same Playwright harness measures this one
before it is called done, and a card whose height varies by meal is a failure of
the phase rather than a polish item.

## Part 2: what a ready meal costs

### Now: the dish price

One property, and the currency comes from a setting that already exists.

| Setting | Default | Note |
| --- | --- | --- |
| `priceProperty` | `price` | A number on a meal note. Unprefixed, because unprefixed is the meal area's convention (`imageProperty`, `dietProperty`); the order's own total is `orderPriceProperty`. |

~~**No `priceCurrencyProperty` on a meal.**~~ **Reversed.** The argument was that
`orderDefaultCurrency` already exists, that a household buys in one currency, and
that a second currency setting on the dish would be a field right to leave blank
on every note, which is how a setting becomes noise. What overturned it was a
supplier: one dish bought from a German company was shown in Swiss francs, which
is not a blank field but a wrong number. `mealPriceCurrencyProperty` (default
`priceCurrency`) exists now, and the objection was answered by making it a chain
rather than a lone setting -- the meal's own property, then its supplier's
currency, then `orderDefaultCurrency` -- so the ordinary meal note still carries
nothing. **The property exists for the exception, not the rule.** Multi-currency
totalling is still out of scope: a company total is withheld entirely for a
mixed-currency run rather than added up.

What it reaches, and most of it for free:

- `MealMeta.price`, read through the same alias-tolerant path as every other
  numeric field.
- The card's price line and the header's banner cell.
- The meal editor gains a field. A price is typed, not derived.
- **The badge editor's property picker gets it without any work**, because the
  picker scans the library's properties rather than reading a fixed list.
- Gallery sort by price is a `GallerySortField` addition and is **optional**, kept
  out of the first phase so the phase is a read and a render.

### Later: the order total

Specified now, built in its own phase. The answer to "what is a line worth" is
**the order records what was paid**, and that decides the shape:

> Order total = sum of its lines, minus discount, plus shipping. The dish's price
> is only the default offered when a meal is added to an order.

An order from last year keeps last year's prices. A supplier raising a price must
not retroactively change what an old order cost, because an order note is a
record of a transaction and a record that recomputes is not one. This is the same
reason `lastEaten` and `eatenCount` are the *only* derived values written back:
everything else is derived at read time, and a stored price is stored precisely
because deriving it later would be wrong.

Two order-level settings:

| Setting | Default |
| --- | --- |
| `orderDiscountProperty` | `discount` |
| `orderShippingProperty` | `shipping` |

And a **v3 selection schema**, read-and-upgrade from v2 the way v2 already reads
v1:

```yaml
selections:
  - person: "[[Stefan]]"
    items:
      - meal: "[[Tom Yum Gai]]"
        price: 17.9
        quantity: 1
```

`items` rather than a second list parallel to `mealTitles`: a parallel list
keyed by position breaks the moment somebody hand-edits one of the two, and
hand-editing a note is always safe here. `quantity` is in the shape from the start
because two of the same meal is obviously next and adding it later would be a
fourth schema.

~~**The computed total is shown beside the stated one, never over it.**~~
**Reversed after the phase shipped.** The argument was that an order whose stated
total disagrees with its lines is either a typo or a discount nobody recorded, and
both are worth seeing. What overturned it was the editor: once it computes the
total it writes rather than asking for it, the two cannot disagree except in a
note somebody hand-edited, and four totals rows were spent on an ambiguity that no
longer exists. The document shows **one** total, and `documentTotal()` picks it:
the lines when any of them carries a price, the stated figure when none does. A
hand-edited note that still contradicts its lines renders the figure from the
lines, silently, which is the deliberate cost of not reopening the argument in the
layout. Nothing is written back either way, so `orderPriceProperty` and every
order note that already exists are still untouched.

## Two rule violations found while reading the code for this, and the test that followed

Both were in shipped text, both were the "no em dashes" rule, and the first was
rendered on screen by the very component this design restyles:

- ~~**`view-model/nutrition-row.ts` uses an em dash as its absent-figure
  placeholder.**~~ **Fixed in phase 3**, which touched that file. It is now an
  exported `ABSENT_FIGURE` en dash, shared with the gallery card, because two files
  disagreeing about which dash means "nothing recorded" would be worse than either
  choice. The rule was easiest to miss exactly here: a one-character constant that
  renders on screen.
- **`view/layouts/has-content.ts` has two em dashes in its file comment**, from
  the ready-meals work earlier. Comments are covered by the rule too.

**Phase 5 fixed the second one and reversed the paragraph that used to sit here.**
It argued that a contract test was not worth it, because a scan of `src/` would need
an exemption list for the regex character classes that legitimately match an em dash,
and such lists grow until the test means nothing. The objection was right about
exemption lists and wrong about the alternative. `tests/no-em-dash.test.ts` exempts
nothing by name:

- **In TypeScript it checks only comments**, and finds them by asking the TypeScript
  scanner for its comment trivia rather than guessing with a regex, which cannot tell
  a comment from an apostrophe inside a string. An em dash in a regex literal or a
  string is matching or asserting something, not being read, so the two legitimate
  files pass without being mentioned.
- **In Markdown it strips code first**, fenced blocks then inline spans, and checks
  what is left. A page quoting another tool's output, or quoting this rule's own
  violation, does so in backticks and passes by construction. The stripped regions
  are replaced with spaces rather than deleted, so reported line numbers stay right.

The sweep that phase 5 ran first found seven lines carrying U+2014, in more shapes
than the paragraph above had imagined: a character class, a regex alternation, a test
asserting the character's *absence*, a changelog quoting an old note-line format,
and two pieces of genuine prose. Only the last two were violations, and one of them
was in `docs/design/data-model.md`, which nothing had looked at.

**The test is verified against the bug, not just against today.** An em dash was
reintroduced into a TypeScript comment and into a Markdown heading, and the test was
confirmed to fail on each and to name the offending line; a dash added to a string
literal was confirmed not to trip it. That check exists because a fix earlier in this
project shipped with a test that passed against the bug it claimed to prevent.

## The tests this needs

- **`stat-strip.test.ts`**, one case per branch of the cell rule: a single-valued
  badge is a cell, a valueless one is a chip, a multi-valued one is a chip, an
  explicit `display` overrides all three. App-free, because the planner stays
  separate from the DOM exactly as `badge-values.ts` already is.
- **`badge-values.test.ts`**: extended, not replaced. The planner keeps deciding
  what a badge says; only where it renders is new.
- **`stylesheet.test.ts`**: every new class declared once and applied once, and
  the icon-box rule (a small square box with `padding: 0` needs an explicit svg
  size) still satisfied for the chips that keep icons.
- **Card height, measured.** Playwright, six widths, one figure: every card the
  same height, priced or not, with a one-cell strip or a four-cell one.
- **`translation-keys.test.ts`**: the strip's labels in `en.ts` and `de.ts` in the
  same commit. Nothing new is expected here, since the labels are the badge labels
  that already exist.
- **`settings-coverage.test.ts`**: `priceProperty` needs a control somewhere on
  the settings page, and the two order properties need one when their phase lands.
- **Price formatting**: `17` renders as `17.00`, the currency comes from
  `orderDefaultCurrency`, a missing price renders as nothing rather than `0.00`,
  and a price of `0` is a real value (a free replacement meal) rather than absent.
  Same distinction `recordEatingInPlan()` already draws for a rating of 0.
- **`sample-vault.test.ts`**: `Tom Yum Gai` gains a price, so the card and the
  header have something real to render. The suite seeds `sampleNotes()` into a
  fake vault now and needs no environment variable.

## Build order

Each phase leaves the plugin working.

1. ~~**Extract the strip.**~~ **Done.** `ui/stat-strip.ts` plus the cell-or-chip
   rule in `view-model/badge-display.ts`. Four call sites became one component and
   eleven CSS rules became one block. See the phase-1 section above for the four
   things it found and the three differences it deliberately leaves.
2. ~~**Render the badge row through it.**~~ **Done.** Diet moved to the chip row,
   the figures became cells, and the icon and colour fields in the badge editor now
   say they apply to the chip form. See the phase-2 section.
3. ~~**The card face.**~~ **Done.** Chip row, nutrition strip, the meta row became
   the info strip, and the height is uniform and measured. See the phase-3 section.
4. ~~**The dish price.**~~ **Done.** Property, setting, `MealMeta`, editor field,
   card row and header line. See the phase-4 section.
5. ~~**The em-dash fixes.**~~ **Done.** One landed in phase 3, which touched that
   file; phase 5 fixed the other, swept everything shipped, and added the contract
   test this page had argued against.
6. ~~**Order arithmetic.**~~ **Done.** v3 selections with read-and-upgrade, the two
   order properties, the computed total shown beside the stated one, and the editor
   that writes line prices. See the phase-6 section.

## What phase 1 actually found

`src/ui/stat-strip.ts` is the component and
`src/meals/view-model/badge-display.ts` is the rule. Four things came out of
building it that the design above did not predict, and each one would have shipped
unnoticed:

**The cell-or-chip rule cannot read the resolved values.** The first cut asked how
many values a badge produced, which is the structural argument this page makes. It
is wrong in practice: `diet` ships `splitArray: true`, so a meal naming two diets
put diet in the chip row and a meal naming one put it in the strip, and the badge
moved between the title and the figures from meal to meal. The rule now keys on
**`splitArray`**, a declaration about the property rather than an observation about
one note, so a badge renders in the same place on every meal. Two tests pin it,
including a `diet:` written as a bare string rather than a list.

**The two boxed strips used a smaller label than the desktop one.** 0.65rem via
`culi-label-caps`, against `var(--font-ui-smaller)` at 12px in the meta banner.
Unifying on the desktop value made both mobile strips 5px taller. Found by
measuring, not by looking: 5px is not visible.

**`grid-auto-columns: 1fr` does not give equal columns.** It is
`minmax(auto, 1fr)`, so each column is floored at its own content width, and the
German nutrition strip came out 78/78/78/123 because `Kohlenhydrate` widened its
own column. `minmax(0, 1fr)` is the fix, and equal columns are the entire point of
the variant.

**Equal columns then clip a long German label.** With the columns forced equal, a
13-character single word in an 89px column overflows, and the boxed variant sets
`overflow: hidden`, so it was cut off with no ellipsis and no sign anything was
missing. `overflow-wrap: anywhere` on the label fixes it, and **the shared-rows
design is what makes wrapping safe**: measured at 360px, the German label takes two
lines while all four figures still sit on one, because the two grid rows are shared
across every column. A wrapper element per cell would have stepped them.

### The three deliberate differences

Everything else is geometrically identical, measured across four widths in both
locales: the desktop nutrition strip matches to the pixel in all eight cases, and
the mobile nutrition strip matches in six of eight.

1. **The mobile Info strip now reads label-then-figure**, like the times strip
   above it. This is the inconsistency named in the table.
2. **The mobile times strip is 1.6px taller**, having adopted the nutrition
   strip's 0.1rem gap between label and figure. One value had to win; the
   nutrition strip is what the request was about, so it kept its spacing exactly.
3. **A German mobile Info strip narrower than about 400px changes shape.** It used
   to wrap into two rows of two cells and stand 99px tall; it now keeps four
   columns with a two-line label and stands 62px. Shorter, and the figures line up
   where they did not before.

Nothing else moved. The harness that establishes that reads the new rules out of
the shipped `styles.css` and the old ones from a transcription, compares strip box,
column widths, text-row count, border, radius and caption gap, and lives outside
the repo because it is a one-off measurement rather than a suite.

## What phase 2 changed, and one place it departs from the table above

`badge-row.ts` now renders two things: `renderBadgeChips()` for the pills and
`renderBadgeFigures()` for the strip, with `renderBadgeRow()` kept as the
both-in-order convenience the gallery card and the mobile layout still use.

**The strip stays where the badge row already was**, under the stars, rather than
below the meta banner as the surface table says. Deliberate: this phase changes
what a badge *looks* like, and moving where the numbers are in the same commit
would mean two things to judge instead of one. The banner is controls (the
servings and the header actions) while the title block is what the dish *is*,
which is also a
reasonable place for the figures to stay. The table's version is not ruled out;
it is just not something to do in the same step.

Two additions to the rule that phase 1 did not have, both from reading the badge
editor rather than from thinking about it:

- **A badge with `hideLabel` set stays a chip.** `hideLabel` is how a badge renders
  as its icon and value alone, and a column whose heading is hidden is a figure
  floating over blank space. A badge with no label configured at all is the same
  case reached differently, and is covered by the same check.
- **A prefix and a suffix are folded into the figure.** In a pill they are their own
  muted spans; in a column they read as part of the one value, because the cell
  contract is one label over one figure rather than over three elements.

### Measured

The header is *supposed* to look different here, so the question was not whether it
matches but whether it behaves. Across four pane widths in both locales:

- **The diet chips are directly under the title**, at 44px instead of 86px, with
  the tags below them. Request 2, visible in the numbers.
- **The strip is one row of columns at every width from 260px to 1000px**, with no
  overflow and nothing clipped in either locale.
- **The header's height stopped depending on its width.** It is a constant 158px for
  the two-chip, four-figure case at 420px and above, where the old pill row varied
  between 114px and 181px depending on width and locale, because six pills wrapped
  onto two or three lines.
- **It is 44px taller on a wide English pane** and about 23px shorter on a wide
  German one, and shorter at most narrow widths. Two blocks of information cost
  more height than one wrapped row when the row did not have to wrap. That is the
  price of the requested look, and it is the one number worth a second opinion.

## Phase 2b: the counted library sent the design back

Phase 2 shipped and the reaction was "I don't see a change". The build was correct
and byte-identical in both vaults, Obsidian had reloaded, and the diagnosis is worth
recording because guessing would have gone the wrong way three times over.

The open note was `Eating/Meals/Grüne Casarecce mit Poulet`, read out of
`workspace.json`. It states `prep:`, `cook:` and `total:` as **empty**, which are
the keys that vault writes and which the alias lists still accept, and it carries
no `lastEaten` and no log of any kind. So its strip had nothing in it and its only
badge was the diet pill, which had indeed moved from below the stars to under the
title. One pill shifting two rows is not a visible change.

Running the real `planBadges()` over all 126 meal notes in that vault:

| Strip columns | Notes |
| ------------- | ----- |
| 0             | **2** |
| 1             | **113** |
| 2             | 1     |
| 3             | 10    |

**Ninety percent of the library got a one-column strip reading `LAST EATEN` over a
date**, which is a thin return for a restyle, while the four nutrition figures every
note carries sat in a separate band below. The design's own argument for keeping them
apart, that the caption would describe cells it did not cover, was correct about the
risk and wrong about the balance: it was protecting a caption at the cost of the
feature having anything to show.

So nutrition moved into the strip, ahead of the figures, and left the meta banner
with what it actually is: controls. `view-model/header-strip.ts` composes the two
halves and `StatCell.groupStart` marks the boundary, drawn as a rule in the plain
variant so the caption cannot read as covering the times. The four caption strings
now name nutrition explicitly, which is the cheap half of the same fix; they were
used in one place, so rewording them cost nothing.

**Measured** across three real note shapes, two locales and four pane widths, all 24
cases: one row of columns, no overflow, nothing clipped. The strip is 32px at 820px
and above for every shape except an eight-column German one, which needs about
620px before it stops wrapping its labels and reaches 170px at 480px. It degrades by
growing rather than by clipping, which is the right failure mode, and a full desktop
pane is rarely that narrow.

**What this says about the method, not just the feature.** The strip's content was
counted before phase 3 rather than after, and the count inverted a decision this page
argued for at length. The ready-meals design was corrected the same way, by counting
the 14 notes that carried ingredients or a method where it had claimed 9. Counting
the library beats reasoning about it, and both times the reasoning was internally
consistent and pointed the wrong way.

## Phase 2c: mobile was never in it

The next report was a screenshot of an **iPad**, still showing no change. This one
was not about the note: `meal-view.ts` wraps the whole chips-and-strip block in
`if (layoutId !== 'mobile-tabs')`, because the mobile layout builds its own header.
So phases 2 and 2b changed the desktop layouts and nothing else, and a phone or
tablet saw exactly what it saw before. The vault syncs to the device and the build
had arrived; the gate was mine.

Worth naming as a class of mistake: **a change to "the meal header" is a change to
every layout the header has, and one of them is behind a guard that reads as an
implementation detail.** Both earlier reports in this feature were diagnosed by
looking at data rather than by re-reading code, and this one needed the opposite.
The screenshot's tab strip was the tell.

Mobile now gets the nutrition figures in its header, after the diet chips, as a
bordered strip. **Two strips there rather than one**, and that divergence is
deliberate: desktop has room for eight columns in a row, while seven boxed columns
at phone width is about 55px each. Mobile's Info tab correspondingly stops rendering
the nutrition figures, since repeating them one screen apart is the duplication that
layout's own comments already warn about.

Measured at four device widths across three column sets, all 12 cases: equal
columns, every figure on one row, nothing clipped. The only wrap is German
nutrition on an iPhone in portrait, where `Kohlenhydrate` takes two lines and the
strip grows from 51px to 62px with the figures still aligned.

## What phase 3 built, and the four things measuring changed

The card is now a picture with its title and any rating over it, then three fixed
rows: chips, the nutrition strip, the info strip. `view-model/card-face.ts`
composes them.

**Counting decided which rows earn a place**, before any of it was built:

| on a card    | notes stating it |
| ------------ | ---------------- |
| diet         | 124 / 126        |
| nutrition    | 124 / 126        |
| eaten count  | 124 / 126        |
| a total time | 14 / 126         |
| a rating     | **3 / 126**      |
| a favourite  | 0 / 126          |

**The stars moved onto the picture.** Three notes of 126 carry a rating. Reserving
a row for them in the info block would have meant a blank line on 123 cards, and
leaving the row conditional would let those three stretch every card in their grid
row. Over the picture it costs no height either way.

**Four things the harness changed, none of which were visible by reading the code:**

1. **The nutrition labels had to be abbreviated.** Four columns across a 200px card
   is about 50px each, and "Calories" does not fit on one line. A wrapping label is
   precisely the thing that makes one card taller than its neighbours, so the card
   uses `kcal / prot / fat / carb` and the gram suffixes come off. This is what the
   product cards the request was modelled on do, for the same reason.
2. **Total time came off the card entirely.** Three info columns are 55px each and
   both `1 h 10 min` and `06/08/2026` rendered with an ellipsis through the middle.
   Two columns that can be read beat three that cannot, and time is the least earned
   of the three at 14 notes against 124. The meal view shows it in full.
3. **The date is the short form.** `06/08/2026` overflows an 85px column where
   `06/08/26` fits, so `formatIsoDateShort()` exists for the card alone.
4. **The `DIET` label is hidden on a card.** There is only one kind of chip there, so
   the label says nothing, and dropping it is what keeps two diets on one row
   without the row clipping.

**The caption problem, solved differently here.** A card has no room for a line of
small print, and dropping the caption would leave `647` with nothing saying whether
that is a plate or a tray, which is the failure `nutrition-row.ts` exists to
prevent. `captionAs: 'tooltip'` puts it on the strip's `title` instead.

**Measured**: seven card shapes in English and four in German, across four grid
widths, including a note with no nutrition, one with two diets, one rated, one with
a title that wraps to two lines, and one never eaten. Every card in a grid is the
same height, the info block is 118px in all 44 cases, and nothing is clipped. The
card's total height varies with the grid width only, which is the 4:3 picture doing
what it should.

**One thing phase 4 must not undo.** `.culi-gallery-card-info` has a `min-height`
that is the sum of its three rows, their gaps and its padding. It is there because a
strip with no figures is not rendered at all, and two notes state no nutrition;
without it those two cards would be shorter and their neighbours would grow to fill
the row. Adding the price row means adding to that sum and re-running the harness.

## What phase 4 built

`priceProperty` (default `price`, alias `cost`) on a meal note, read into
`MealMeta.price`, formatted by `view-model/format-price.ts` with the currency
resolved through the chain the reversal above describes. A settings row, a field
in the meal editor beside Servings, and a line on all three surfaces: the gallery
card between its nutrition and info strips, and both headers directly under the
figure strip.

**It went to a line under the strip, not a meta-banner cell** as the surface table
above says. The banner became controls when nutrition left it in phase 2b, and a
price is a fact about the dish rather than a control. Under the figures is also
where the product card this was modelled on puts it.

**The price is never scaled by anything.** It is what one portion costs as sold,
which does not change because the figures beside it are being converted between a
serving and the whole meal. So the price and the nutrition cells sit next to each
other behaving differently on purpose, and there is a test for it on the card.

**Zero is a real price** and formats as `0.00`. A replacement meal sent free is a
line worth recording, and it is not the same information as a dish nobody has
priced. Same distinction `recordEatingInPlan()` draws for a rating of 0.

### Measured

**The card**: the price row joined the height sum, which went from 7.35rem to
8.95rem. Re-run across the same eight grid-width and locale combinations with some
cards priced and some not: every card in a grid is still the same height and the
info block is 143px in all of them, up from 118px. Nothing clipped.

**Both headers**, 18 cases across three widths, two locales' worth of column sets
and three price states including `CHF 1'234.50`: no overlap, no wrapping, a 24px row
when there is a price.

**A header with no price costs nothing**, and that was checked rather than assumed.
An empty block's top and bottom margins collapse through it, so the header measures
the same with the element as without. A `:empty { display: none }` rule was written,
measured to change precisely nothing, and removed again rather than shipped.

## Phase 6, confirmed and sharpened

Three points were confirmed in the user's own words, and they are requirements now
rather than inferences from a multiple-choice answer:

1. **The dish price is the default, and it will change.** A supplier raises a price;
   the note follows.
2. **An order does not change after the fact when that default changes.** Whatever it
   recorded stays recorded.
3. **The discount is on the total**, not per line.

The first two together are the whole argument for storing a price on the order line,
and the third fixes the arithmetic:

> total = sum of (line price x quantity), minus one order-level discount, plus shipping

### What the existing orders say about it

Counted rather than assumed, in the vault this has to work in: **59 order notes, every
one of them already v2, every one carrying `price` and `priceCurrency`, and not one
carrying a discount, a shipping cost or a per-line price.**

That decides a rule the design did not have: **no computed total is shown unless at
least one line carries a price.** Otherwise all 59 existing orders would display a
computed 0.00 beside a stated 89.40 and read as a plugin that had lost their money.
The computed figure is an opinion about a note that has the data for one, not a
default state.

It also settles the migration question by confirmation 2. **Nothing backfills.** An
existing order is not given line prices from today's dish prices when it is next
opened or saved, because that would invent a history the confirmation explicitly
rules out. An order gains line prices only for lines added after this ships, and a
v2 order that is never edited stays v2 and stays readable forever.

### One test already had to be corrected by this

`tests/sample-vault.test.ts` asserted that Tom Yum Gai's price equalled the amount its
order's total moved by. That was written before confirmation 1 and 2 existed and it
encodes their opposite: it would have failed the first time a supplier raised a price,
and reported a correct vault as an inconsistent one. It now asserts only that a price
is stated and readable. **The invariant worth pinning arrives with this phase**, and it
is a different one: a line price and its own order's total live in the same note, so
those must agree.

## What phase 6 built, and the one number that proves it is safe

`items:` replaces `meals:` inside a selection as soon as a line carries a price or
a quantity, with `orderDiscountProperty` and `orderShippingProperty` on the order.
`trail-core`'s `order/total.ts` holds the arithmetic; the invoice shows one total,
computed where the lines are priced and stated where they are not (see the reversal
above); the editor gained a **what it cost** section listing only the dishes
actually chosen, with a price and a quantity each and a running total.

**`OrderSelection.items` is the only list.** A first draft kept `mealTitles`
alongside it so the twenty-nine existing readers would not have to change, which is
precisely the two-sources-that-must-agree shape this codebase forbids everywhere else.
`selectionTitles()` derives them instead, and the compiler found every call site.

Four decisions, each of them a rule rather than a preference:

- **A line's price is what was charged.** Nothing in the reader consults a meal
  note, so there is no path by which a later price rise could reach an order already
  recorded. A test asserts it by reading a priced order with no meals in sight.
- **Ticking a dish is the one moment the meal's price is read**, and the modal
  snapshots every meal's price when it opens rather than looking one up per
  keystroke.
- **An unpriced order keeps the `meals:` shape.** The schema is decided per note,
  never per person, so one note cannot carry a priced list for one person and a bare
  list for another.
- **A quantity of 1 is omitted** and a quantity of 0 is read as 1. Zero would be a
  line nobody ordered, and treating it as free understates a total rather than saying
  so.

### The number that matters

The reader and writer were run over the **59 real order notes** in the vault this has
to work in. 443 dish lines parsed, **none** gained a computed total, and **not one
note's selections changed shape when what was read was written straight back**. That
last figure is the whole no-churn promise, measured rather than asserted: saving an
untouched order rewrites nothing.

## Two corrections after phase 6 met a real iPad

**A price belongs to the dish, not to the person who ordered it.** The editor listed
one row per person-and-dish pair, so two people choosing the same meal got two
separately editable prices that could disagree. It now lists one row per distinct
dish, with one price applied to every line naming it, and `x 2` where two portions
were ordered. The person's name is out of the row entirely, which is also what gave
the dish name back its space. The note still stores the price per line, so an order
remains a record of what was charged; only the view it is edited through changed.

`dishLines()` groups them and reports the **first** price of a hand-edited note whose
lines disagree, changing nothing. Normalising on open would be a silent rewrite of an
order, and the total goes on summing the lines as written. Only editing that dish's
price writes to all of them.

**And a layout bug worth generalising.** On the iPad the price field rendered about
590px wide while the dish name beside it vanished; on the desktop it looked correct.
The field's placeholder was still right-aligned, which is the clue: the rule was
applying and only its `width` was being beaten. Obsidian's mobile stylesheet sets a
width on a text input with a selector more specific than one class, and a flex item
whose `width` is overridden takes that as its basis and eats the row, while a sibling
with `flex-basis: 0` gets nothing and hides it with `overflow: hidden`.

**Stating a `flex-basis` fixes it, and a `width` cannot.** `flex: 0 0 5.5rem` on the
field, `min-width: 0` on the name so it can ellipsise rather than push. Verified by
reproducing the failure and not merely the fix: with the old declaration plus a
width override the field measures 679px at an 860px row, which is the screenshot;
with the basis stated it measures 88px at every width, override or not.

Worth carrying beyond this dialog: **anything laid out in a flex row here should
state a basis rather than a width**, because a width is something the host
application can outrank.

## Not in scope, and named so nobody assumes otherwise

- **No currency conversion and no multi-currency order.** One currency, from one
  setting. Named as a limit rather than half-solved.
- ~~**No tax, no per-line discount.**~~ **Both arrived later, and neither weakens
  the confirmation this phase rests on.** `orderVatRateProperty` and
  `orderVatAmountProperty` let a note state how much of a gross total was tax:
  prices stay gross, nothing is computed from them, and the invoice prints the
  share as a fact rather than as a row in a sum. `orderItemDiscountField` is a
  discount on one line, which is part of what that line cost rather than an
  adjustment to the order, so it is already inside the subtotal and the one
  order-level discount still comes off the total afterwards. What is confirmed
  remains confirmed: there is one discount **on the order**.
- **No price-per-supplier table.** It was considered and rejected: a stored line
  price makes it unnecessary, and a company note holding a price list would drift
  from what was actually charged.
- **No price history and no "cheapest supplier" view.** Both are real features and
  both need the order lines from phase 6 to exist first.
- **No writing a computed total into an order.** The stated total stays what
  somebody typed.
- **No new note type, no new folder, no new `type:` value.** A priced dish is a
  meal.
