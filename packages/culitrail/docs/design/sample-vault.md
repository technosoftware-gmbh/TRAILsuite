# The sample vault

> **Status: built, as a command rather than as a folder.** `CULItrail-Sample`
> was described on this page for a long time as a vault sitting beside the
> repository, and it never shipped: the suite that checked it skipped unless it
> found the vault, and a skipped suite and a passing one look alike in the
> summary line. The notes are a function in this package now, `sampleNotes()`
> in `src/sample/notes.ts`, and **Create the sample notes** writes them into
> whatever vault is open. `tests/sample-vault.test.ts` seeds them into a fake
> vault and runs unconditionally.

Fifteen notes: the fastest way to see every feature working without typing
anything, and the layout the folder defaults are named for. If a default path in
[Settings reference](settings-reference.md) looks arbitrary, this is why it is
what it is.

Everything in it is in English, and every wikilink in it resolves. **The note
content is never translated**, only the command name, the modal and its notices.

## Layout

```
Eating/
  Meals/                  4 notes, plus a `From a real vault/` folder of 1
  Meal Plans/
    2026/                 4 notes (2 people x 2 weeks)
  Orders/                 3 notes
CRM/
  People/                 2
  Companies/              1
```

Every folder is where `DEFAULT_SETTINGS` looks with an empty `rootFolder`, which
is the point: seed it, and the dashboard, the gallery and the meal plan find
every note on first render with nothing configured. It does not demonstrate
every default. There is no `Eating/Deliveries/`, so the delivery note, the
delivery document view and the meal picker's last-box ordering have nothing to
run against; a folder the plugin looks in and does not find is a folder holding
nothing, which is why the vault still opens clean.

The `From a real vault/` folder needs no setting to be in scope. The meal reader
matches folder membership **at any depth**, so a subfolder of `mealsFolder` is
already scanned; `additionalMealFolders` is for meals kept somewhere else
entirely and is deliberately not used here.

**The two meal-plan weeks are relative to the clock**, which is why
`sampleNotes()` takes a `now`. One week is the week just gone and one is the
week you are in, so a freshly seeded vault has something on screen today rather
than a grid that was current in whichever month this was written.

Cover images are named and **not present**: the notes carry paths so the
property has something to point at, and a meal whose image does not resolve
falls through to the configured default, which is itself worth seeing.

## What each folder demonstrates

| Folder | What it is there to show |
|---|---|
| `Eating/Meals` | Both extremes of the shape range: a full note with a cover image, a per-100 g breakdown, allergens, a diet and a price, and a note carrying little more than `type: meal` and a reheating section. Between them they also cover a meal with no servings at all, and one carrying every allergen the exclusion filter has anything to match on. The reheating cases are described below |
| `Eating/Meals/From a real vault` | A note nobody wrote for CULItrail: `prep:` and `cook:` rather than `prepTime:` and `reheatTime:`, `yield:` rather than `servings:`, `cover:` rather than `image:`, `kcal:` rather than `calories:`, and `diet:` as a bare string rather than a list. This is the only place the alias lists and the lenient readers are proven against a foreign convention |
| `Eating/Meal Plans` | Two people, two consecutive weeks, so per-person isolation and week navigation are both visible without editing anything. The past week is eaten and rated; the current one is planned and unrated. One entry is a free-text `Leftovers` entry rather than a wikilink, because that path is easy to break and invisible until it is, and it is also eaten with no rating, which is the state the old checklist had to write `[rating:: 0]` for |
| `Eating/Orders` | Three orders from one company, covering both people, in all three schemas: one **v1 flat selections** note so the read-and-upgrade path has something real to run against, one v2 note with a bare `meals:` list, and one v3 note with priced `items:` so the invoice has real arithmetic to print |
| `CRM/People` | The `personsFolder` lookup: `type: person`, the tag `Family` on both so the eligibility filter can be demonstrated by typing one word into a setting, the shared `roles:` list, and a `culi-related-orders` block |
| `CRM/Companies` | The same shape one level up, plus the two things only a company carries: the commercial terms, and the supplier's `# Reheating` boilerplate, which is what makes the merge demonstrable |

## The reheating cases

What a note holds decides what it can do, and no `type:` value or folder says
anything about it. Two meals carry the cases worth having:

- **`Tom Yum Gai`** supplies **only numbers**. Its two appliance headings carry
  `[temp:: 95 °C] [time:: 25 min]` and `[temp:: 800 W] [time:: 6 min]` and no
  prose at all, and it states no `supplier:` property either, so the supplier is
  derived from the order that references it. That is the case worth having,
  because it is the one where three separate derivations have to agree before
  anything appears on screen: the dish supplies numbers, the company supplies
  the wording, and the order supplies the company.
- **`Aubergine Parmigiana`** states `supplier: "[[TomTasty AG]]"` explicitly, so
  the property path is covered too. Its `## Oven` heading carries numbers for the
  company's wording to absorb, while its `## Microwave` is prose that overrides
  the company's instruction outright. Those two rows of the merge rule sit in one
  note on purpose: if the resolver ever starts preferring one source wholesale,
  this note shows it in one screen.

`CRM/Companies/TomTasty AG` carries the other half: a `# Reheating` with Steamer,
Oven and Microwave instructions written with `{temp}` and `{time}` tokens. A token
nothing fills means the appliance is withheld entirely rather than rendered with a
gap in the sentence, so a mismatch between the company's field names and a dish's
is a missing card rather than a broken one. The suite asserts the Steamer
instruction resolves from the **supplier**, contains `95 °C` and `25 min`, and
contains no `{`; and that the Oven card is **absent** for Tom Yum Gai, which is
the withholding rule in the one form that can be seen.

The company's `culi-related-orders` fence sits after the last appliance on
purpose. That is the note where every line of the fence once landed inside the
Microwave instruction, and the parser drops fenced blocks because of it.

**Three meals carry a `price:`**, and the suite asserts only that a price is
stated and readable, **not that it still agrees with the order's total**. That
stronger assertion was written first and then removed, because it is not a rule:
a dish price is the default offered when a meal is added to an order, it changes
when the supplier changes it, and an order does not follow it afterwards. The
figures agree in the seed because that is how it was seeded. Pinning it would
mean the suite failed the first time a price rose, and reported it as
inconsistency.

The invariant that **does** hold is the one inside a single note: the priced
order's lines, less its discount and plus its shipping, equal the total it
states. That is asserted.

## What is deliberately absent

Two properties are absent from all but one meal note even though the reader
supports them: `lastEaten:` and `eatenCount:`. Both are derived from the plans,
and writing them into every note as well would create two sources of truth that
quietly disagree. The one note that does state them, `Grandma's Lasagne`, is
there to show that an explicit value wins over the derived one, and the suite
pins that it is exactly one.

Contact details are placeholders on an `example.invalid` domain, prices are
real-shaped but invented, and the one company is fictional.

## Deliberately shared with the other plugins

`CRM/People` and `CRM/Companies` use the **same folder names, the same type
values and the same frontmatter shape** as APERtrail's and NODAtrail's sample
notes. That is not decoration: seeding two of the plugins into one vault is
meant to leave one set of contact notes answering to both, so the
[shared-CRM contract](shared-crm.md) can be demonstrated rather than only
asserted.

The planner in `trail-core` is what makes that work. **A target folder may hold
nothing except notes this plan would itself write**, so the second plugin to run
recognises the first one's `Stefan`, skips it, and appends only its own
`culi-related-orders` fence. One note the plan has never heard of refuses the
whole run, and the modal names it.

**The two CRM folders are the exception, and they had to become one**: the notes
in them carry `shared: true`, so a note this plan does not name is reported in
the preview rather than refusing the run. The rule above was written for
`CRM/People`, where all three plugins seed exactly Stefan and Erika and nobody
is a stranger to anybody, and it broke on `CRM/Companies` the first time the
three seeders were actually run against one vault: each plugin seeds the company
its own notes need, a travel operator or a meal supplier, no contract says which
companies a vault holds, and whichever ran second gave up on the entire seed
over the other's supplier. Every folder CULItrail owns outright, meals, plans
and orders, still refuses.

The one detail to keep aligned by hand: the person names. `Stefan` and `Erika`
exist in all three sets with the same filenames, because wikilinks resolve by
title and a merged vault with `Stefan` in one and `Stefan Muster` in the
other would demonstrate the opposite of the point.

## What checks it

`tests/sample-vault.test.ts` seeds `sampleNotes()` into a fake vault and reads it
back with the real parsers: the folder-and-type reader, the meal meta reader with
its alias lists, the reheating section parser and resolver, the meal-plan parser,
`parseOrder`, and the CRM readers. It asserts every claim on this page, including
that no wikilink in the set resolves to nothing.

A hand-written note whose heading or wikilink is subtly wrong looks perfectly
fine in Markdown and shows up as an empty view, which is the whole argument for
the suite existing. Every assertion in it was broken on purpose once and watched
go red; the two that survived the first pass were weak in the same way, and both
were rewritten to assert the absence that made the case a case.
