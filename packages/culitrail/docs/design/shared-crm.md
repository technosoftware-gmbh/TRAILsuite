# Shared CRM with APERtrail

> **Status: built.** Everything on this page describes what runs, with one
> asymmetry named in place: the first-load settings adoption exists in CULItrail
> and does not exist in APERtrail.

A Person or a Company note is not a CULItrail note. It is a note in the vault that
CULItrail reads and that APERtrail reads and writes. Two plugins, one set of
notes, one shared core.

This page is the contract that makes that work; the defaults it turns on live in
`trail-core`'s `CRM_CONTRACT` (`packages/core/src/settings/crm-contract.ts`).

## Who owns what

**No plugin owns the settings.** The nine defaults that say what a Person or
Company note _is_ live in `trail-core`'s `CRM_CONTRACT`, which both plugins import
into their own defaults rather than respelling them. It was seven until the two
roles properties joined it: NODAtrail needs to know which companies send it
invoices, CULItrail narrows its supplier dropdown to the meal companies and
APERtrail narrows its accommodation lists, and a company that is several of those
should say so once rather than under three spellings.

**APERtrail writes the notes.** It has the creation flow, guarded so a blank folder or
a blank type value refuses rather than writing a note the reader that just created
it cannot see.

**CULItrail creates none.** It reads the two configured folders and renders what it
knows: which orders name a person, and what has been ordered from a company. Two
plugins both offering "New person" would produce two shapes for the same person
the first time somebody used the wrong button.

Each plugin adds its own part inside a note none of them owns. That is the model,
and it generalises: a third plugin could render its own block in a Person note
without either of these two knowing.

## What "shared" means

- The same two folders, by default, in both locales.
- The same `type:` values by default: `person` and `company`.
- The same tag properties by default: `tags` for each, as two settings rather
  than one, so neither setting's name has to lie about what it covers.
- The same roles properties by default: `roles` for each, on the same two-settings
  split and for the same reason.
- The same treatment of an empty tag filter: no filter, never no people.
- Wikilinks resolved by note title, never by path, in both plugins. An order's
  `person:` and a trip's `persons:` point at the same note by the same rule.

## What it does not mean

- **No shared `src/crm/`, and no dependency between the plugins.** What they share
  is `trail-core`, which neither of them owns: `CRM_CONTRACT` for the defaults,
  `crm/note.ts` for the note format, `crm/tags.ts` for the tag matching. Each
  plugin keeps its own `src/crm/` over that, and CULItrail's is deliberately shaped
  like APERtrail's, down to file names, so the two can be read side by side.
- **No runtime lookup of the other plugin.** No `app.plugins.getPlugin()`, no
  `enabledPlugins` check to decide behaviour. The only cross-plugin read anywhere
  is the one-time `data.json` read below, and it reads a **file**, not an object.
- **No merged settings surface.** Each plugin keeps its own `data.json` and its
  own settings tab. The values happen to agree.
- **No degradation when the other is absent.** Each plugin is fully usable alone.
  That is a requirement, not a nice-to-have, and it is the reason the contract is
  defaults rather than code.

## The aligned defaults

Every value here is copied verbatim from APERtrail's own tables. `tests/crm.test.ts`
pins them, in both locales, and that test is the tripwire: if one side changes a
value alone, a vault with both plugins silently reads two different sets of contact
notes, and the symptom is an empty person list rather than an error.

| Setting              | English         | German         |
| -------------------- | --------------- | -------------- |
| `crmFolder`          | `CRM`           | `CRM`          |
| `personsFolder`      | `CRM/People`    | `CRM/Personen` |
| `companiesFolder`    | `CRM/Companies` | `CRM/Firmen`   |
| `typePropertyName`   | `type`          | `type`         |
| `personTypeValue`    | `person`        | `person`       |
| `companyTypeValue`   | `company`       | `company`      |
| `personTagProperty`  | `tags`          | `tags`         |
| `companyTagProperty` | `tags`          | `tags`         |
| `personRolesProperty` | `roles`        | `roles`        |
| `companyRolesProperty` | `roles`       | `roles`        |
| `eligiblePersonTags` | _(empty)_       | _(empty)_      |

The type values and the property name are **not** locale-aware, and the test
asserts that as an absence rather than as a value per locale: the localized
defaults resolver returns no opinion on them at all, which is what makes a locale
change structurally unable to touch them. A `type:` value is data. Translating one
would orphan every note already on disk.

## First-load settings adoption

On a genuinely fresh install, meaning `loadData()` returned `null` or `{}`,
CULItrail reads `<configDir>/plugins/apertrail/data.json` and adopts only the
CRM-shaped fields it recognises. APERtrail's keys are already the names CULItrail
uses, because CULItrail adopted its naming for exactly this reason, so nothing has
to be translated on the way in.

Everything else comes from CULItrail's own defaults, including every folder under
`Eating/`. This is deliberately narrow: **adopting a folder is safe because it
only changes where the plugin looks; adopting a behaviour toggle is not.**

The read goes through a helper that never throws and returns `null` for a missing,
unreadable or invalid file, so an absent sibling plugin is indistinguishable from
a genuinely fresh vault. It runs once, on first load, and the result is persisted
immediately so the next load is an ordinary one rather than a second import
against a vault that has since changed.

**The adoption is reported, not silent.** The Orders & CRM settings tab shows one
read-only line naming which plugin the values came from and which keys came
across. A German vault that suddenly reads `CRM/Personen` when nobody typed that
is confusing until you know why, and the line is the only place that answers it.

### The asymmetry

**APERtrail does not do the reverse.** Its `load()` calls `loadData()` and hands
the result straight to `mergeSettings()`; there is no `configDir` read anywhere in
its source.

This is recorded rather than quietly fixed because it is a real, defensible state:
APERtrail defined these defaults first, so it has nothing to adopt _from_ in the
common case. If the behaviour is ever wanted, it should be
built symmetrically with the one described above, not bolted on.

## The blocks a shared note carries

A Person note in a vault with both plugins carries two fenced blocks:

    ```culi-related-orders
    ```

    ```travel-related-trips
    ```

Each takes no arguments and reads which note it is in from the rendering
context's own path, so the same fence works pasted into any Person or Company
note. Neither breaks when its plugin is absent: **a fence no plugin claims
renders as a plain code block**, which is visible and harmless rather than an
error.

`culi-related-orders` answers two questions depending on where it sits. In a Person
note it lists the orders naming that person, with the supplier, what they chose
and the price. In a Company note it lists what has been ordered from them, who
ordered, and a total.

Two judgement calls in it are worth keeping:

- **An order naming somebody who has chosen nothing yet still counts as theirs.**
  Somebody recorded who was in on the order before deciding what they wanted.
  Dropping it would make the order look unrelated to them.
- **A company total is withheld entirely for a mixed-currency run.** Adding CHF to
  EUR produces a number that is wrong in both, and a household that orders in two
  currencies is better served by no total than a plausible one.

## Where the sharp edges are

- **Nothing enforces the contract at runtime.** A vault that changes
  `personTypeValue` in one plugin and not the other gets two readers disagreeing
  about the same folder, and the symptom is an empty list rather than an error.
  The settings tab's status block exists for exactly this: it counts matching
  notes per folder, so zero people tells you the folder is right and the type
  value is wrong, or the other way round.
- **The defaults are only defaults.** They align a fresh install. They cannot
  align a vault where somebody has already configured one plugin differently on
  purpose, and they should not try to.
- **Writing into `personsFolder` is not CULItrail's job**, and the guard that
  matters if that ever changes is the one against touching an existing note, not
  the folder check.
