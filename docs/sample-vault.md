# The sample vault

Each of the three plugins can fill an empty vault with a small, complete set of
its own notes: **Create the sample notes**, in the command palette. Run one and
you have a working example of that plugin. Run all three into the same vault and
you have the thing no single plugin can show on its own, which is what happens
where two of them meet.

This page is about the second case. What each plugin seeds on its own is
described in its own docs, and those pages are the ones to read for the content:

- [APERtrail](../packages/apertrail/docs/design/sample-vault.md), 16 notes
- [CULItrail](https://github.com/technosoftware-gmbh/CULItrail/blob/main/docs/design/sample-vault.md), 15 notes
- [NODAtrail](../packages/nodatrail/docs/design/sample-vault.md), 23 notes

Everything seeded is in English, whatever the vault's language. Folder names and
property names still resolve through each plugin's own settings, so a German
vault gets German folders holding English notes. That split is deliberate: the
folders are configuration and the notes are a demonstration, and translating
fifty-four sample notes into every locale is a maintenance cost with no reader.

## Start with an empty vault

The seeders write into exactly the folders the settings name, which is the point:
the sample vault is what the defaults were named for, and a path in a settings
reference that looks arbitrary stops looking arbitrary once you have seen the
folder it makes.

That is also why they are careful. **A target folder may hold nothing except
notes the plan would itself write.** One note the plan has never heard of refuses
the whole run, and the modal names the folder and the note rather than failing
quietly. A note that is already there is skipped, never overwritten. So pointing
one of these at a vault you care about does not scatter demo notes through your
own work; it declines.

The two CRM folders are the exception, and the reason they are is worth reading
before you run the second plugin. `CRM/People` is safe under the rule above
because all three seed exactly Stefan and Erika. `CRM/Companies` is not: each
plugin seeds the company its own notes need, a travel operator or a meal
supplier, and no contract says which companies a vault holds. The first attempt
at a combined vault refused on precisely that, so a folder written by more than
one plugin by agreement now never refuses. It reports instead: the preview names
the folder and says what is already in it, and writes beside it. The safety is
still bought everywhere else, and a vault whose only TRAILsuite-shaped content is
a contact list is the one case where you are asked rather than told.

Make a new vault, install the plugins into it, and run the commands. Each one
shows you what it would write before it writes anything.

## The order matters, once

Install and seed in this order:

1. **APERtrail**
2. **CULItrail**
3. **NODAtrail**

Any order produces the same notes. This one additionally shows the settings
adoption described below, because each plugin only looks at its siblings on a
**fresh install**, before it has a `data.json` of its own. Seed NODAtrail first
and you have the same vault with one fewer thing demonstrated.

## What the combined vault demonstrates

Three plugins under three licences, sharing a vault, with no code in common
beyond `trail-core`. There is no plugin API between them: none of them calls
`app.plugins.getPlugin()`, none imports a type from another, and a test refuses
an import that would let one. Everything below happens through files.

### One Person note, three plugins

`CRM/People/Stefan` and `CRM/People/Erika` are written once, by whichever plugin
runs first, and skipped by the other two. The folder, the type value, the tag
property and the roles property all come from `CRM_CONTRACT` in `trail-core`, so
a fresh install of any of the three ships the same defaults and the three
recognise the same note without anything being configured twice.

The one thing the later plugins do to a note they did not write is **append
their own fenced block** when it is missing. APERtrail's related-trips fence,
CULItrail's related-orders fence and NODAtrail's spending fence each go in when
that plugin is seeded, and each renders in the plugin that owns it and shows as
a plain code block in the others. So after all three runs, one Person note
answers three questions: which trips this person was on, which orders are
theirs, and what they cost.

That append is the only edit any seeder makes to a note that already exists. It
is counted separately in the preview and named separately in the modal, because
a note somebody else wrote is a different thing from a note nobody has yet.

### An evening meal in a day note

NODAtrail's Wednesday day note carries an evening entry linking
`[[Tom Yum Gai]]`, which is one of CULItrail's meals. Seed NODAtrail alone and
that wikilink dangles. Seed CULItrail into the same vault and it resolves, and
the day note and the meal plan are two views over one set of files.

### A trip's money in the ledger

Two of NODAtrail's journal postings name `[[Rovos Rail 2026]]`, which is one of
APERtrail's trips: a split across two expense accounts for the legs, and the
card purchase that paid for them. Travel money reaching a double-entry ledger
with no travel plugin involved in the arithmetic.

Those two wikilinks are the only ones in the whole set that are meant to point
outside their own plugin. Each plugin's suite names them explicitly and asserts
that every other link resolves within what that plugin seeds, so a link that
dangles by mistake is still a failing test.

### Settings adopted from a sibling's `data.json`

A vault that has already told one plugin where its CRM folders are should not
have to tell the second one again. On a **fresh install only**, CULItrail reads
`apertrail`'s `data.json` off the vault's config folder, and NODAtrail reads
both siblings', adopting the folder paths, type values and property names each
recognises. Nothing else is adopted: a folder path changes where a plugin looks,
and a behaviour toggle would change what it does, which nobody asked for.

It reads a **file**, not a plugin. The sibling does not have to be installed,
enabled or present, and a missing or unparseable file falls through to ordinary
defaults exactly as a genuinely fresh install would.

This is the one demonstration you have to look for rather than see. Install the
three in the order above, then open NODAtrail's settings: its CRM folders are
already right, and nothing typed them.

## Undoing it

Delete the folders. Nothing outside the vault is touched, no plugin keeps a
record of what it seeded, and the seeders are idempotent: run one again on a
vault you have half-cleared and it writes back what is missing and leaves what
is there.

The one thing to know before deleting is that the sample notes are ordinary
notes. If you have edited one, or built on it, deleting the folder deletes that
too. There is no separate sample mode to switch off.

## Why it is built this way

The obvious design was one shared generator producing a combined vault, and the
licence boundary rules it out. CULItrail is GPL because it carries inherited
Recipe Box code; APERtrail and NODAtrail are PolyForm Noncommercial. A program
that combined the three would combine the licences, and a repository-level
script importing all three would be exactly that program.

So there is no combined generator, and the interaction is not produced by
anything. It is produced by three separate plugins each writing its own notes
into one folder and each reading what the others left. That is the same
arrangement the plugins use at runtime, which makes the sample vault an honest
demonstration rather than a staged one: if the seeded vault shows a Person note
answering to three plugins, it is because three plugins really can share a note.

The one piece the three do share is the arithmetic of deciding what to write:
`planSampleVault()` in `trail-core`, which answers "is this vault empty enough"
and "which of these notes is already here" and writes nothing at all. Behaviour
three plugins need is a contract, and a contract belongs in the core. The
content does not: a sample note is product material in one product's voice, and
it stays in the plugin that ships it.
