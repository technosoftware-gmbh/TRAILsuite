# Note templates

A starting shape for each of the twelve entity types, plus a trip-planning note. These are **templates, not a schema**. APERtrail reads whatever frontmatter is there and treats anything absent as unset, so a note carrying three of these fields works exactly as well as one carrying all of them.

They deliberately include more than the plugin writes. Every creation modal writes the type property, a `created` stamp and the fields it collected, and nothing else, because a note full of empty keys is harder to read than a note with three. The cosmetic fields below (`image`, `icon`, `color`, `summary`) are here for hand-editing or for your own Templater templates to fill in.

Property names shown are the English defaults. Every one of them is a [setting](../design/settings-reference.md), so if your notes already use different names, change the settings rather than the notes. Three names are fixed and not configurable: `accommodationType`, `accommodationStatus` and `fnbType`. The ten travel `type:` **values** are fixed too, but the two CRM ones are not: `person` and `company` are whatever `personTypeValue` and `companyTypeValue` hold, because those folders are usually ones your vault already had. A photo spot's light windows, motif roles and accessibility values are fixed too, but those are property *values* rather than names.

Two conventions worth keeping when you adapt these:

- **Write datetimes quoted.** An unquoted `2026-02-13T09:00` becomes a native `Date` in Obsidian's YAML parser, which loses the time. `"2026-02-13T09:00"` round-trips intact.
- **Omit what you do not have.** An absent key is unset. An empty key is indistinguishable from a deliberate blank six months later.

| Template | For |
|---|---|
| [Trip](Template%20-%20Trip.md) | One journey, the only entity with real structure |
| [Booking](Template%20-%20Booking.md) | One purchase that belongs to a trip, and the confirmation behind it |
| [Country](Template%20-%20Country.md) | Top of the geographic hierarchy |
| [State](Template%20-%20State.md) | Optional first-level division |
| [City](Template%20-%20City.md) | A city or town |
| [Accommodation](Template%20-%20Accommodation.md) | Somewhere you stayed |
| [FnB](Template%20-%20FnB.md) | Restaurant, cafe, bar, pub, fast food |
| [Landmark](Template%20-%20Landmark.md) | A point of interest |
| [Location](Template%20-%20Location.md) | Anything that is none of the above three |
| [Photo Spot](Template%20-%20Photo%20Spot.md) | Somewhere you go to make a specific picture |
| [Person](Template%20-%20Person.md) | Somebody you travel with |
| [Company](Template%20-%20Company.md) | An organization behind the places you visit |

The last file in this folder is not a template. [Trip Planning](Trip%20Planning.md) is the top-level structure note: the folder tree the twelve templates are filed into, and the one page to read first if you are laying a vault out rather than filling a note in.

These describe the note shape the current reader and writer actually handle. Where a template and the code disagree, the code is right and the template is the bug.
