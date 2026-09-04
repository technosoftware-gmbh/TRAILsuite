# Note templates

> **Status: built.** These are the note shapes CULItrail reads today, and
> the same shapes the [sample notes](../design/sample-vault.md) use.

A starting shape for each kind of note CULItrail reads. These are
**templates, not a schema**. CULItrail reads whatever frontmatter is there
and treats anything absent as unset, so a note carrying three of these
fields works exactly as well as one carrying all of them.

They deliberately include more than the plugin writes. Every writer writes
the type property and the fields it actually collected, and nothing else,
because a note full of empty keys is harder to read than a note with three.
`created` and `modified` are the plugin's: `created` is stamped once when a
note is made and never backfilled onto one that arrived without it, and
`modified` is rewritten by every save. `image` is a field in the meal editor.
The remaining cosmetic fields below (`title`, `source`) are here for
hand-editing or for your own
[Templater](https://github.com/silentvoid13/Templater) templates to fill in.

Property names shown are the English defaults. Every one of them is a
[setting](../design/settings-reference.md), so if your notes already use
different names, change the settings rather than the notes. Those rows sit
behind a lock that ships off, since they are what every note already in the
vault is read by and a stray keystroke in one of them empties a view without
an error. The same is true of all six `type:` **values**: `meal`, `order`,
`delivery`, `mealPlan`, `person` and `company` are whatever `mealTypeValue`,
`orderTypeValue`, `deliveryTypeValue`, `mealPlanTypeValue`, `personTypeValue` and
`companyTypeValue` hold. Nothing in CULItrail is matched against a literal.

Section headings in the body (`# Reheating`, `# Notes` and `## Eating History`)
are settings too, and all three resolve through the locale, so a German vault's
notes can say `# Aufwärmen` from the start and nothing has to be renamed.

Two more heading settings exist and are **read only**: the pair naming the body
sections a meal's per-100 g figures used to live in. Nothing writes them any
more, because the breakdown is frontmatter now, but a meal written before that
move still keeps its figures there and is still read from there, and the vault
migration has not run. Those two stay plain English in both locales, because
that is the wording the notes already in these vaults use. See
[Settings reference](../design/settings-reference.md#section-headings).

Three conventions worth keeping when you adapt these:

- **Write datetimes quoted.** An unquoted `2026-02-13T09:00` becomes a
  native `Date` in Obsidian's YAML parser, which loses the time.
  `"2026-02-13T09:00"` round-trips intact.
- **Omit what you do not have.** An absent key is unset. An empty key is
  indistinguishable from a deliberate blank six months later.
- **Do not write derived values.** `lastEaten:` and `eatenCount:` are
  computed from the ticked lines on the meal plans. Writing them by hand as
  well creates two sources of truth that quietly disagree. Where you do write
  one, it wins, which is occasionally what you want and usually is not.

| Template | For |
|---|---|
| [Meal](Template%20-%20Meal.md) | One dish, the only note with real body structure |
| [Meal Plan](Template%20-%20Meal%20Plan.md) | One person's week, as a property list. Normally written by the plugin |
| [Order](Template%20-%20Order.md) | Meals bought from a company, per person |
| [Delivery](Template%20-%20Delivery.md) | What arrived in one box, and when |
| [Person](Template%20-%20Person.md) | A household member, or anyone an order names |
| [Company](Template%20-%20Company.md) | A vendor you order from |

The Meal Plan template is included for reading rather than for copying: that
note is written and rewritten by the plugin, and the value of seeing its
shape is knowing what a hand-edit will and will not survive.

These describe the note shape the current reader and writer actually
handle. Where a template and the code disagree, the code is right and the
template is the bug.
