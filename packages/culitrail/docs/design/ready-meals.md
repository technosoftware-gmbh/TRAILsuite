# Ready meals: reheating a purchased dish

> **Status: built**, and this page is still the specification for the merge
> rule below. `trail-core`'s resolver is written to be read against the table
> in this page rather than instead of it, and its test suite has one case per
> row.
>
> Three bugs in this feature were found by putting real notes in front of it
> rather than by any test written first. They are named in the sharp-edges
> section.

A dish here is bought pre-cooked and reheated. It needs instructions of a
shape a recipe never had, per appliance, and they belong to the dish as a
product rather than to any one order of it. The wording usually belongs to
the supplier rather than to the dish at all, which is the reason this is a
merge rather than a field.

## What the vault actually looks like

Counted before any of this was designed, because the shape of the data
decides which case deserves to be the easy one:

| Population                                            | Notes   |
| ----------------------------------------------------- | ------- |
| Meal notes                                            | **126** |
| Referenced by at least one order                      | 125     |
| Bought ready-made                                     | **111** |
| Carrying ingredients or a method                      | 14      |
| Carrying ingredients or a method and never ordered    | **0**   |

The plugin was originally built on the assumption that a dish is something you
cook. In this vault that described **14 notes out of 126**, and every one of
those 14 had also been bought ready-made. Reheating was not a mode to switch
into; it was the whole library. That count is what eventually took cooking out
of the plugin altogether rather than leaving it as the other half of a
distinction nobody was on the far side of.

All 125 ordered dishes come from one company, `TomTasty AG`. The design must
not assume that stays true; nothing below is single-supplier.

## Note formats

### The meal note

A section under the configured reheating heading, with one sub-heading per
appliance:

```markdown
# Reheating

## Steamer
Remove the clear plastic wrap from the dish. Use the reheat function at 95
degrees Celsius and heat it for about 25 minutes.

## Microwave
Pierce the film. 800 W for 6 minutes, stir, then 2 minutes more.
```

Or, when the supplier's wording already covers it, the dish supplies only the
numbers:

```markdown
# Reheating

## Steamer
[temp:: 95 °C] [time:: 25 min]

## Oven
[temp:: 180 °C] [time:: 20 min]
```

Inline fields rather than frontmatter, because they belong to one appliance and
frontmatter has no room for a per-appliance value. `[rating:: N]` on a meal-plan
line is the precedent for the notation. Both field names are settings.

### The company note

The supplier's boilerplate, once, under the same heading. `{temp}` and `{time}`
are filled from the dish. The `{token}` convention matches the `{GGGG}`, `{WW}`
and `{person}` tokens the path settings already use.

```markdown
# Reheating

## Steamer
Remove the clear plastic wrap from the dish. Use the reheat function at {temp}
and heat it for about {time}.

## Microwave
Pierce the film and heat at {temp} for {time}. Stir halfway through.
```

**CULItrail reads this section and never writes it.** A Person or Company note is
shared: APERtrail creates it, and any other plugin in the vault may read it. Per
[the shared-CRM contract](shared-crm.md), each plugin answers its own question
inside a note none of them owns, and CULItrail's half of that contract is that it
creates and modifies no CRM note. The boilerplate is typed by hand or by whichever
plugin owns the note. If that ever changes, it changes there, not here.

## The appliance vocabulary

A list setting, `reheatAppliances`, each entry an `id` and a `label`:

| id         | English default | German default |
| ---------- | --------------- | -------------- |
| `microwave` | Microwave       | Mikrowelle     |
| `oven`      | Oven            | Backofen       |
| `steamer`   | Steamer         | Dampfgarer     |
| `skillet`   | Skillet         | Bratpfanne     |

**The id and the display label are separate**, which is the same separation the
weekday keys and the meal-slot keys already enforce, and for the same reason:
collapsing them makes the vocabulary untranslatable without a note migration.

The defaults resolve through the locale, so a German vault gets German labels on
first load and they then belong to the vault. That is required, not
optional: a default that freezes into `data.json` as an English literal can never
afterwards be told from a value somebody typed.

Matching a sub-heading to an appliance is deliberately forgiving, and consults
every name rather than selecting one by locale:

1. the configured label, case-insensitively and trimmed
2. the id
3. the shipped English and German defaults, as aliases

So `## Dampfgarer`, `## Steamer` and `## steamer` all resolve to the steamer in
any locale. **A sub-heading matching nothing still renders, labelled as written.**
Text somebody typed is never hidden because the plugin did not recognise its
heading; that is the same judgement as a fenced block no plugin claims rendering
as a plain code block.

## Which supplier's defaults apply

In order, first hit wins:

1. an explicit `supplier:` on the meal (property name is a setting), resolved as
   a wikilink by title like every other link in the plugin
2. the company on the most recent order that names this dish
3. none: only the dish's own reheating text is available

Derived, not written back. A dish whose supplier is derived from order history
needs no property, which is what keeps every existing note untouched.

## The merge rule

Resolution is **per appliance**, and this is the part worth getting exactly right,
so it is stated as a table. For one dish and one appliance:

| Dish says                    | Supplier says          | Result                                                       |
| ---------------------------- | ---------------------- | ------------------------------------------------------------ |
| prose                        | anything               | the dish's prose, supplier ignored for this appliance         |
| prose **and** `temp`/`time`  | anything               | the dish's prose, with its own tokens filled if it has any    |
| only `temp` and/or `time`    | prose with tokens      | the supplier's prose, tokens filled from the dish            |
| only `temp` and/or `time`    | prose with no tokens   | the supplier's prose, then the numbers on a line of their own |
| only `temp` and/or `time`    | nothing                | the numbers alone, as a one-line instruction                  |
| nothing                      | prose with no tokens   | the supplier's prose                                          |
| nothing                      | prose with **tokens**  | **the appliance is not offered for this dish**                |
| nothing                      | nothing                | the appliance is not offered                                  |

The last-but-one row is the rule that needs defending. A supplier instruction
reading "heat for about `{time}`" with no time to fill in is worse than silence:
it looks like a bug, and a reader in a kitchen cannot act on it. **An unfilled
token means that appliance is not available for that dish**, and the settings
status row should be able to say how many dishes are in that state, because it is
a data-entry gap rather than an error.

The check is per token rather than per instruction: a wording that names both a
temperature and a time needs both, and filling one while blanking the other
produces "at 95 °C for", which is worse than not offering the appliance.

A dish that resolves nothing at all simply has no reheating section, which is the
correct answer for a dish nobody has ever bought.

## What it looks like in the interface

### The meal view

- **A reheating section**, one group per appliance, rendered through the same
  step renderer any run of steps goes through. It is the main body of the view:
  a dish that arrives cooked has nothing else to say about being made.
- **A meal with nothing to reheat shows no section at all**, rather than an empty
  one. On a phone that means the tabs are Reheating and Info, or just Info, and
  never a tab that opens onto nothing.
- Appliances render as stacked groups. Chips selecting one appliance at a time
  would suit a phone better and are deliberately **not** here: remembering which
  appliance somebody last used is persisted state, and the no-caching rule makes
  that a decision of its own rather than a detail of this feature.

### The suggester (removed)

This section specified a derived filter field, `@reheating`, so the suggester
could be asked for something reheatable. It shipped as an `@`-prefixed
pseudo-field and left with the suggester itself; `DERIVED_FILTER_FIELDS` in
`meals/discovery/field-types.ts` is what remains of it, offered by the property
picker. Kept here because the reasoning against reserving a synthetic
*property* name still applies to anything that would compute a value a note
could also carry: it would both promise a property that does not exist and let
a vault carrying its own `reheating:` shadow the computed one.

The badge precedent is genuinely different, and that is why it points the other
way: a badge's `property` is **rendered**, so a reserved name there would be a
promise about a note's contents. A filter field is only ever **resolved**, and the
resolver already had two namespaces.

`SuggestCandidate` carried the derived value alongside its raw frontmatter
rather than inside it, for the shadowing reason. It left with the suggester;
the reasoning is kept because the next computed value that wants a name faces
the same choice.

## Settings

Every one of these needs a control on the settings page or
`tests/settings-coverage.test.ts` fails, which is the intended behaviour.

| Setting             | Default                          |
| ------------------- | -------------------------------- |
| `reheatingHeading`  | `Reheating` / `Aufwärmen`         |
| `reheatAppliances`  | the four above, localized labels  |
| `reheatTempField`   | `temp`                            |
| `reheatTimeField`   | `time`                            |
| `supplierProperty`  | `supplier`                        |

**Where each row sits on the settings page is deliberately not stated here.**
That column said "Meal view" and "Orders & CRM" and was wrong within one
release, because a page gets regrouped and a note format does not.
[Settings reference](settings-reference.md) is the page's own map and is the
one document that has to follow it.

`reheatAppliances` has a list editor of its own, since a rename must preserve an
id. The heading joins the other body headings that resolve through the locale.

## The tests this needs

Not a wish list. The contract suites fail without most of these:

- the merge rule, **one case per row of the table above**, including the
  unfilled-token row. App-free, and it lives in `trail-core` with the resolver.
- appliance matching: label, id, alias, unknown-heading-still-renders, and a
  German vault reading an English heading.
- supplier resolution: explicit property, newest order, two companies selling one
  dish, no company at all.
- `translation-keys.test.ts`: every string in both `en.ts` and `de.ts`.
- `settings-coverage.test.ts`: the five settings above.
- `sample-vault.test.ts`: a dish supplying only numbers, a dish overriding its
  supplier, and a company with boilerplate, with `sample-vault.md` carrying the
  claims to match.
- `stylesheet.test.ts`: any new class declared once and actually applied.

## Not in scope, and named so nobody assumes otherwise

- **No bulk data entry.** Every dish needs its times typed in, or its supplier's
  boilerplate written once and the numbers per dish. Nothing here fetches them. A
  helper that reads a supplier's product list is a separate feature with a
  separate design.
- **No writing to company notes.** Stated above; it is a contract, not an
  omission.
- **No new note type and no new folder.** Reheating instructions are just a
  section of a meal note.
- **No ordering workflow change.** "Add this dish to an order" from the meal view
  is a real gap, but it changes how orders are created and belongs in its own
  design.
- **No appliance chips**, for the state reason given above.
- **No per-appliance nutrition or servings.** A dish is one portion as sold, and
  the servings field already describes it.

## What real notes caught that fixtures did not

Recorded because the pattern is the lesson: every one of these was a *note
structure* the tests did not imagine, not a flaw in the merge rule they covered
heavily.

- **A fenced block inside the reheating section.** The company note carries
  `culi-related-orders` after it, nothing follows, so every line of the fence landed
  in the last appliance's instruction. A reader was told to remove the plastic wrap
  and then shown backticks.
- **An eating log nested under `# Reheating`.** The log's writer emits `##` while
  these notes write their other sections `#`, so pasting the snippet above the log
  put the log inside the section. It was offered as an appliance.
- **A layout's early return.** "Nothing to lay out" was decided on sections that a
  bought dish does not have, so nothing rendered at all, and the only trace was a
  card in the header.

## Sharp edges

- **A renamed appliance label orphans notes that used the old one**, unless the old
  name happens to be one of the shipped defaults, which are kept as aliases. A
  vault that invents `Heissluftfritteuse` and later renames it will stop matching
  its own sub-headings. The id in the setting is what a rename preserves, and the
  list editor must not let a rename change an id.
- **The supplier derived from order history is a guess about the present.** A dish
  bought once from a company that has since changed its packaging will show that
  company's current boilerplate against an old dish. Correct in the common case,
  and the explicit `supplier:` property is the escape hatch.
- **Nothing enforces that a token-carrying supplier instruction has any dish that
  fills it.** The count of unfillable appliance instructions belongs on the
  settings status row for the same reason the CRM drift count does: the failure is
  silent and looks like missing data rather than misconfiguration.
