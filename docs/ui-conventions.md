# The suite's user interface: what the three plugins agree on

**Status: written 26 August 2026, section 5 revised the same day** once the
three missing tests were moved. From conventions already proven in shipped code
rather than proposed fresh. Where a rule is one plugin's practice and not yet
the other two's, it says so.

This is the one document in the suite that cannot become a module. Everything
else the three plugins share is in `trail-core` and imported. A user interface
cannot be, for two reasons that both hold independently:

- **The core holds no view.** `packages/core/CLAUDE.md`: it holds no view, no
  user-facing string and no settings object, and nothing in it may import
  `obsidian` or touch the DOM. A shared UI kit would break the one rule that
  lets the core run under vitest and in a future standalone application.
- **The licence boundary forbids the sideways move.** CULItrail is
  GPL-3.0-or-later because of its inherited Recipe Box code, and its UI kit is
  part of that package. Copying a file out of it into either PolyForm package
  would relicense that package, and `tests/licence-boundary.test.ts` fails the
  build on the attempt.

So the suite gets a consistent interface the only way available to it: **one
specification, implemented three times.** That costs three implementations of
the same idea and buys three packages that stay independently licensable and
independently installable. The trade was made when the licences were, and this
document is the half of it that was never written down.

**Nothing here is a matter of taste.** Every rule in section 3 was paid for by a
bug in a real vault, most of them on an iPad where a desktop looked fine.

---

## 1. The anatomy all three share

A user who installs one plugin and then a second should not have to learn a
second set of habits. These are the shapes already common to the three:

| | |
|---|---|
| **One `Plugin` subclass** | Modules are a source layout, not a runtime abstraction. There is no module registry and no `Component` indirection. Obsidian awaits an async `onload()`, so ordering is plain `await` |
| **A dashboard as the front door** | Reached from the ribbon and the command palette. It summarises; it does not edit |
| **Views are singleton leaves** | Opening a dashboard or a gallery twice reveals the existing leaf. The exception is a view that renders one note, which is a `TextFileView`, one per open note |
| **One toolbar above anything that lists** | A row, a search field with the magnifier inside it, square icon-only buttons for view controls, labelled buttons for actions that write a note |
| **One `BaseModal`** | It owns `onOpen()` and builds sticky header, scrolling body, sticky footer. Concrete modals implement the title, the body and the footer and never touch `contentEl` |
| **One settings page** | One scrolling page with sub-pages behind it: Folders, Property keys, and one per long list. A property row is never hand-built, so the read-only lock lives in one place |
| **Fenced blocks in notes the plugin does not own** | Each plugin renders its own block inside a shared note. An unclaimed fence renders as a plain code block rather than an error |
| **One record card for a list of records** | A name, a muted identifier beside it, icon actions pushed to the end of the header, then a wrapping strip of labelled fields. Used where a record has four or five figures: a row has one title, one subtitle and one trailing figure, so the rest end up packed into a subtitle joined by dashes and read by position |
| **Ribbon icons built once, at load** | Toggled by CSS class, never added and removed, because Obsidian keeps its own record of registered actions and can redraw a removed one |

**The card is a shape, not a module.** CULItrail's order card and NODAtrail's
`card()` look alike and share no code, because they cannot: the licence boundary
forbids it in both directions. Each is written against the other's appearance.
That is the general answer whenever two plugins want the same control.

**Footer buttons** are right-aligned, one row, horizontal-scroll on overflow
rather than wrap. The order is Cancel, then the primary action. The primary
action takes `mod-cta`, or `mod-warning` when destructive, never custom colour
CSS.

## 2. Naming

- **One CSS prefix per plugin**, for the whole UI including anything a module
  contributes: `culi-`, `apt-`, `nod-`.
- **Fence languages take the prefix**, with two recorded exceptions, both because
  the string is already in somebody's vault or already owned elsewhere:
  `travel-itinerary` and `travel-related-trips` in APERtrail, and `noda-journal`
  in NODAtrail, whose name belongs to `trail-core`'s parser.
- **Settings keys carry no prefix.** `mealsFolder`, `tripsFolder`, `areasFolder`.
  Which area a setting belongs to is expressed by the settings page's grouping.
- **Translation keys have no top-level namespace.** `dashboard.x`, not
  `meals.dashboard.x`.
- **Settings are reached through `plugin.getSettings()`**, never a `settings`
  getter: Obsidian's own `Plugin` declares a `settings` member and overriding a
  property with an accessor is a type error.
- **CULItrail keeps the inherited name after its prefix.** Where a class came
  from Recipe Box, `rb-` became `culi-` and the rest of the name did not change,
  which is what keeps its stylesheet diffable against the code it came from.
  That rule is CULItrail's alone and does not generalise.

## 3. The rules paid for in bugs

Each of these has a symptom that looked like something else.

**Reach two classes deep for anything Obsidian also styles.**
`.culi-toolbar .culi-toolbar-btn`, not `.culi-toolbar-btn`. Obsidian's mobile
stylesheet reaches the same elements through `input[type='search']` and a bare
`button` selector, both of which outrank a single class. Four hand-rolled
toolbars once agreed on a desktop and disagreed on an iPad for exactly this
reason. Sizes come from custom properties on the row, so the mobile override is
two declarations rather than a second copy of every rule.

**An icon goes in a slot inside a button, never straight into it.**
`setIcon(button.createSpan({ cls: 'culi-icon-slot' }), name)`. `setIcon(button,
name)` renders on a desktop every time and on iOS only in some contexts, and the
failure is an empty-looking button. The mechanism is somewhere in the app's own
stylesheet and was never pinned down, which is why this is a test rather than a
convention: **the broken version is the one that looks right on the machine it
was written on.**

**An icon-only button sizes its own svg.** Obsidian's `.svg-icon` takes its size
from `--icon-size`, which is not set in every context, so a button hosting an
icon without its own `svg { width; height }` rule can render it at zero and look
empty. That has shipped twice.

**In a flex row, state a `flex-basis`, never a `width`.** Obsidian's mobile
stylesheet sets a width on a text input with a selector more specific than one
class. An order editor's price field rendered about 590px wide on an iPad and ate
the row while the dish name beside it vanished; the desktop looked fine. A flex
item's main size comes from its basis, which no `width` can override.

**`grid-auto-columns: minmax(0, 1fr)`, never `1fr`.** `1fr` is
`minmax(auto, 1fr)`, which floors each column at its content width. That made a
German nutrition strip 78/78/78/123, because one long word widened its own
column.

**A card in a grid of cards is one fixed size, and its height must not depend on
what it contains.** A card is a grid item stretched to its row's height, so a
short card makes its neighbours grow. Three rules together fix it and none is
sufficient alone: the title is clamped **and** pinned to a fixed number of lines,
because `line-clamp` caps the maximum while a fixed height also lifts the
minimum; optional labels share **one row that is always present**; and a
`min-height` carries a card that has neither. Adding a row means adding to that
sum and re-measuring.

**Label and value are siblings in one two-row grid, not a wrapper per cell.**
That is what keeps figures on one line across a strip when a label wraps. A
wrapper per cell steps the figures. Measured at 360px.

**Inline offsets are direction-aware.** `margin-inline-start`,
`inset-inline-end` and friends, never `left` and `right`. APERtrail is where
this rule was written down and, until the `stylesheet` test was moved there, the
one package that did not check it. That inversion is what section 5 used to be
about.

**A class goes on an element in the same edit that gives it a rule.** Not
before. A hook set now for a stylesheet somebody intends to write later is
indistinguishable, to a reader and to the `stylesheet` test, from a class that
was meant to be styled and was missed -- and the second kind is a view that
renders wrong. APERtrail carried fourteen of these when its test was switched
on; twelve were deleted rather than styled, and the two that remained turned out
to be `<datalist>` ids rather than classes at all. Adding a class back alongside
its rule costs one line.

## 4. Behaviour

- **Nothing is cached.** Every view re-reads the vault on render, so what a view
  shows can never drift from what is on disk. The data is never stale; only the
  pixels can be.
- **Refresh is manual.** No view holds a `metadataCache` subscription. They
  redraw on open, on an explicit refresh, and after a modal writes a note, and
  not when a note is hand-edited in another tab. That is a deliberate trade, and
  it is the sixth entry on the user guide's troubleshooting list because it is
  the sixth most common surprise.
- **A dashboard summarises; it does not edit.** Its quick actions navigate. A
  card's header holds its title, its navigation and its actions, and **the title
  is the element that gives way when the card is narrow**, because what would
  otherwise be pushed off the right edge is a control nobody can then see is
  missing.
- **Never a bare `async () => {}`** as a DOM or Obsidian callback. Make the
  callback synchronous and `void` the call inside it. A floating promise in a
  post-processor is a rejection nobody sees.
- **No `console.log`** in shipped code; Obsidian's review flags it directly.
- **No `innerHTML` or `outerHTML`.** Build DOM with `createEl` / `createSpan` /
  `empty()`, or set `.textContent`.
- **No `element.style.x = ...`.** Toggle classes for binary states, and use
  `setCssProps()` only for genuinely dynamic runtime values such as drag
  positions and computed popover coordinates.
- **A view does not query the document for DOM it built itself.** Hold the
  reference.
- **Nothing derived is written back.** Balances, variances, projections and
  totals are recomputed on every render.
- **A form redraws on everything its shape is computed from, not on a proxy for
  it.** NODAtrail's posting form draws the amount box's label and the whole
  conversion row from the two chosen accounts, and compared the two currency
  codes before and after a change to decide whether to redraw. An account nobody
  has chosen yet reports the *home* currency, so `CHF EUR` meant both "no debit
  yet, credit in euros" and "debit in francs, credit in euros": choosing the two
  in one order redrew and in the other did not, and the second figure the
  posting needed was never offered. The key now carries the derived answer
  itself. A comparison key must be able to tell every state apart that changes
  what is drawn.
- **What opens after a form saves is decided per kind of note.** A note whose
  form collected every field it has should not then be opened: the reader is
  part-way through entering the next six and the list they entered it from
  already shows the new row. A note that is a document somebody is about to
  write in should be opened. In NODAtrail that is the line between the money
  notes and the PARA ones, and it lives in one place rather than in each form.
- **Every user-facing string goes in both `en.ts` and `de.ts`**, and a default
  that persists into `data.json` resolves through `t()` rather than sitting as a
  literal: once a default is persisted, the plugin cannot tell an untouched
  default from a value somebody deliberately typed in English.

## 5. What is enforced, and where the enforcement is missing

A convention with a test behind it is not a preference. These fail the build:

| Test | CULItrail | APERtrail | NODAtrail |
|---|---|---|---|
| `stylesheet` (no class without a rule, no rule nothing sets, no physical inline offset) | yes | yes | yes |
| `ui-conventions` (no self-query, no `innerHTML`, no console logging, no inline style assignment, no bare async listener) | yes | yes | yes |
| `icon-slot` (an icon-only button by shape, not by a hand-kept list) | yes | yes | yes |
| `settings-coverage` (every setting has a control, or a stated reason for having none) | yes | yes | yes |
| `translation-keys` | yes | yes | yes |
| `property-name-lock` | yes | yes | yes |
| `no-em-dash` | yes | **no** | yes |

**That table used to be the practical content of this document**, and its first
version had three rows reading no in at least one column: `stylesheet` ran in
two packages of three, `ui-conventions` in one, `icon-slot` in one. Moving the
three was cheaper than rewriting any UI, because they read source text and
stylesheets and so carry no licence weight and no runtime dependency, and it was
done rather than deferred.

**Switching a check on is where the findings arrive, not where they end.** Each
of the three arrived red and each red was worth having: fourteen unstyled
APERtrail classes, four missing icon slots across two packages, and fifty-one
APERtrail settings with no settings-page row that turned out to be a defensible
line needing a stated reason rather than a control. None of that was visible
while the rule was a preference.

One row still reads no. `no-em-dash` is enforced in CULItrail and NODAtrail and
absent from `core` and `apertrail`, which are kept clean by hand.

## 6. Where the three actually stand

Honestly, because the point of this document is to converge and that starts with
saying how far apart they are:

| | CULItrail | APERtrail | NODAtrail |
|---|---|---|---|
| `src/ui/` | a flat kit of 13 modules: `base-modal`, `toolbar`, `stat-strip`, `tab-strip`, `week-nav`, `list-editor`, `star-row`, `field-picker`, `lightbox`, `reorder`, `ribbon`, `images`, plus `dashboard/` | `components/`, `dashboard/`, `gallery/`, `settings/` | `kit/`, `components/`, `views/`, `modals/`, `blocks/`, `settings/` |
| Maturity | the kit the lessons came from | partial | least built out |

**CULItrail's kit is the reference implementation**, not because it is better
designed but because it is the one that has been through a real vault on a real
iPad. Where this document and a plugin disagree, this document is what the other
two are converging on and CULItrail is where to look for how a thing is done.

**What must not be done to converge:** import from `culitrail`, move a file out
of it, or lift its stylesheet. Read it and write the equivalent. That is the same
rule that governs everything else in this repository, and the same reason.

## 7. The Life Dashboard, as built

Written 26 August 2026 against the four points this section used to recommend.
All four were taken, and one of them is the reason the dashboard survived its
first contact with an iPad.

1. **The twelve-column grid is in `ui/dashboard/cards.ts`**, with the span
   classes spelled out as a record rather than composed, because the stylesheet
   test reads quoted class names and a composed one is invisible to it.
2. **The cards hold one height.** Confirmed on a real iPad: a title wrapping to
   two lines does not make its card taller than its neighbours.
3. **The three PARA strips scroll horizontally** rather than wrapping, and an
   area click filters the goals and projects below it.
4. **It summarises.** The edit actions it carries open the same modals the PARA
   view does; nothing is edited on the dashboard itself.

**What the iPad actually said.** A static audit before the screenshots found
NODAtrail's stylesheet has zero `is-mobile` rules against CULItrail's sixteen,
and predicted trouble. The dashboard was fine: it is grid and flex with
`overflow-x` on the strips, and that geometry is already width-agnostic.
CULItrail's sixteen rules exist mostly for things this dashboard does not do,
such as fixed-width sidebars and hover-only affordances. The lesson is the
measurement's, not the prediction's: **count rules to find where to look, not to
decide what is broken.**

The gap that remains is real but narrower than the count suggested. Icon-only
buttons carry `aria-label` and `title`, and neither surfaces on a tablet, where
there is no hover. An icon-only control on a touch view has to be legible as a
picture or it is unlabelled.

---

## Related

- `docs/architecture.md` section 2 for what may and may not enter the core,
  section 11 for how the plugins cooperate without importing each other.
- Each plugin's `CLAUDE.md` for the reasoning behind its own half of this, and
  for the measurements that produced section 3.
- `NOTICE.md` for why a shared UI module is not available in the first place.
