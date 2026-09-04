# Settings across the suite

**Status: written 26 August 2026, measured against the source the same day.**
This is the settings *model*: the rules all three plugins follow, and why each
one exists. The full list of every key and its default is per plugin, in
`packages/<plugin>/docs/design/settings-reference.md`, because a vault only ever
configures the plugins it installed and because a list of keys goes stale faster
than anything else in this repository.

---

## 1. Nearly every vault-facing name is a setting

**Every frontmatter property name, every field name inside a nested structure,
and every `type:` value is a setting with a sensible default, never a bare
literal in logic.** A vault whose notes already use other names never has to
rename anything on disk.

The rule holds even for a property nothing reads back. CULItrail's `kjProperty`
is written by the manual-entry flow and read by nothing, and it still gets a
name, because the rule is about naming a property rather than about keeping one.
A property with nothing of its own to say is one to delete instead:
`defaultServingSizeProperty` had a name too and was removed outright, because it
was written from the same weight as `servingSizeProperty` and so could never
state anything that one did not.

Three deliberate exceptions exist, all in APERtrail and all subtype specific:
`accommodationType`, `accommodationStatus` and `fnbType` are read at literal
names. CULItrail and NODAtrail have none.

## 2. What is not a setting

Fixed vocabulary, because the code keys off the exact strings. Renaming a
property is a vault's business; renaming these would be renaming the code's own
words.

Weekday keys and meal slots, travel statuses, the ten travel entity types,
booking categories and statuses, cost units, motif roles, accessibility values,
light windows, account kinds, bill and recurring statuses, and the task checkbox
characters. `docs/architecture.md` section 7 lists them, and each plugin's
`data-model.md` lists its own.

**Property values are a different question from property names.** Names are
always configurable; a vocabulary the code branches on is not. Adding a value to
one of those lists is a data-model change, not a setting.

A `type:` value sits on the naming side of that line, not the vocabulary side,
with one asymmetry worth knowing: **CULItrail and NODAtrail make every `type:`
value a setting; APERtrail makes the ten travel ones literals and the two CRM
ones settings.** The reason is ownership. APERtrail's travel folders are folders
it invented, so it may spell their types; the CRM folders are usually ones the
vault already had, spelled its own way. CULItrail has no folder it can claim was
always its own.

## 3. Naming

- **Keys carry no plugin prefix.** `mealsFolder`, `tripsFolder`, `areasFolder`,
  not `culiMealsFolder`. Which area a setting belongs to is expressed by the
  settings page's grouping, not by the key.
- **A prefix that does appear is a note-type qualifier, not a module one.**
  NODAtrail's `purchase*`, `bill*`, `recurring*` and `budget*` exist because four
  note types each carry a `company` and an `amount`, and one key cannot name all
  four.
- **A sub-key inside a list entry is a `*Field`**, and a property of a note is a
  `*Property`. That distinction is load-bearing for section 8.
- **Settings that always travel together get one field, not several.**
  CULItrail's `gallerySavedState` is the worked example: nine gallery filter and
  sort values as one persisted object rather than nine top-level keys.

## 4. Localised defaults, and how folders derive

**Folder names are seeded per locale at first load, not baked in.** A German
vault gets `Essen/Mahlzeiten` where an English one gets `Eating/Meals`. Only the
**name** is localised; the shape is not, which is what lets two plugins in one
German vault resolve the same folder from the same key.

**Sub-folders derive from a module root**, so moving a root moves everything
under it while any single sub-folder can still be repointed on its own. A
sub-folder setting added in a later release falls under the vault's **saved**
root rather than the pristine default, because the saved root is the vault
owner's answer to "where does this module live" and it applies to folders that
did not exist when they answered.

**NODAtrail's seeding prefers a folder the vault already has.** Where a
localised default is absent and the English one is present, it seeds the English
one. Without that rule a German-language install into an English-foldered vault
would find nothing while looking perfectly configured. The other two do not do
this yet, and it belongs in them as well; `docs/architecture.md` section 12
records it.

That rule is also what makes changing a localised default safe. When
`financeFolderName` became `Finanzen` in German, no existing vault moved: a
saved value wins outright, and a vault still on the default finds its existing
`Finance/` and keeps it.

## 5. The property-name lock

All three ship `unlockPropertyNames`, default `false`. **Every settings row that
names a property, a field or a type value is read-only until that switch is
turned on**, and the switch sits at the top of the page that carries such rows.

The reasoning is that a folder row and a property row look identical on a
settings page and are nothing alike to get wrong. **Repointing a folder** moves
where the plugin looks, and every note is found again the moment it points
somewhere real. **Renaming a property** changes what the plugin asks each note
for, and every note carrying the old name stops answering, with no error
anywhere, because a property no note has is not an error.

**Nothing is migrated**, because a settings row cannot tell a corrected typo
from a vault it is being aimed at.

Each package has a `property-name-lock` test that goes by the shape of the
setting's name rather than by a list, so the next property setting somebody adds
is caught without anybody having to remember it.

## 6. Validation

Each plugin turns raw `data.json` into a typed settings object through
`mergeSettings()`, which **validates each field individually** and fills in the
default for anything missing or of the wrong type, so no corrupt value from a
hand-edited file reaches the UI.

**An empty string is kept rather than replaced where empty is meaningful.** A
blank stamp property means "do not write that stamp", and a blank tag filter
means "everyone". Two guards elsewhere follow the same instinct: a blank folder
list matches nothing rather than the vault root, and a blank type value matches
nothing rather than everything in the folder. **An unconfigured setting fails
safe rather than fails wide.**

## 7. Adoption from a sibling

On a genuinely fresh install a plugin reads a sibling's `data.json` off disk and
adopts the CRM-shaped settings: folders, type values, property names and the tag
filter. CULItrail reads APERtrail's; NODAtrail reads both. **APERtrail adopts
from nobody**, which is deliberate rather than missing: it defined these
defaults first.

Two boundaries make it safe. **It reads a file, not a plugin**, so there is no
`app.plugins.getPlugin()` call, no imported types and no runtime coupling, and
the sibling need not be installed. And **it adopts only names and locations,
never behaviour toggles**. Adoption only ever touches a setting still sitting at
its shipped default, so a value somebody chose is never overwritten.

Because it runs on a fresh install only, **a value configured in one plugin
after another was already installed does not propagate**. That is the usual
reason two plugins disagree about something in a long-lived vault.

The seven CRM defaults the three must agree on are not adopted at all: they are
`trail-core`'s `CRM_CONTRACT`, a frozen constant imported into each plugin's
defaults, with a `crm-contract` test in each that fails on drift. They had
already drifted once, `Person` and `Organisation` on one side against `person`
and `company` on the other, and the symptom of a mismatched type value is an
empty list rather than an error.

## 8. Coverage: which settings get a row

**Measured 26 August 2026. Re-measure rather than trusting the table.**

| | Settings | Vault-facing | Without a settings-page row | `settings-coverage` test |
|---|---|---|---|---|
| CULItrail | 127 | 80 | 0 | yes |
| APERtrail | 132 | 106 | **51** | **no** |
| NODAtrail | 161 | 118 | 0 | yes |

**Every one of APERtrail's fifty-one is a `*Field` sub-key naming a value inside
a list entry**, on a trip's stops, nights and transport legs, on a photo spot's
motifs and samples, and on a booking. Not one is a top-level property of a note.

That is a defensible line: a sub-key is the shape of a value rather than a
property of a note, and fifty-one more rows would cost the page its readability
without answering a question anybody asks. They are real settings, honoured by
the reader, the writer and the validator, and edited in `data.json` on the rare
occasion they need editing at all.

What makes it a divergence rather than a decision is that **APERtrail is the one
package with no `settings-coverage` test**, so the line is held by hand there and
by a test in the other two. NODAtrail's version of that test accepts a setting
with no control *and a stated reason*, which is the shape APERtrail would need.

## 9. Where the full lists are

| Plugin | Reference |
|---|---|
| CULItrail | `packages/culitrail/docs/design/settings-reference.md` |
| APERtrail | `packages/apertrail/docs/design/settings-reference.md` |
| NODAtrail | `packages/nodatrail/docs/design/settings-reference.md` |

Each plugin ships its own because each is independently installable: a vault
that has only APERtrail should not have to read past two other plugins' keys to
find out what it can configure.

## Related

- `docs/architecture.md` section 4 for the settings model in the context of the
  design, section 5 for the CRM contract, section 6 for the frontmatter
  reference, section 7 for the fixed vocabularies, and section 12 for the
  divergences named above.
- `docs/user-guide.md` section 7 for the same ground written for somebody
  configuring a vault rather than building a plugin.
