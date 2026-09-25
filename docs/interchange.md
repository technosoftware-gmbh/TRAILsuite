# The interchange format

The standalone app imports a vault once. It does not read markdown: it reads
the files described here, which the plugins write from the same readers they use
inside Obsidian. The types are `trail-core`'s (`packages/core/src/interchange/`);
this page is for the reader on the other side.

## Running it

```
./scripts/export-interchange.sh /path/to/Vault /path/to/out
```

Read-only. The out folder is refused when it sits inside the vault. The plugins'
saved settings are read from the vault's own configuration folder, so a German
vault's folders are found where it keeps them; a folder setting that names a
folder the vault does not have is reported on stderr, since that is the usual
reason a whole family comes out empty.

## The files

| File | Written by | Holds |
|---|---|---|
| `vault.json` | NODAtrail's run, for the core | Every markdown note, raw: path, title, parsed frontmatter, body |
| `apertrail.json` | APERtrail | The travel families, parsed |
| `nodatrail.json` | NODAtrail | The PARA, money and ledger families, parsed |
| `report.md`, `report.json` | NODAtrail's run | What was recognised, what was carried raw only, what does not add up |

A CULItrail file written from its own repository goes in the same folder and is
counted by the report like the others.

Every file starts with the same header:

```json
{ "format": "trail-interchange", "version": 1, "source": "apertrail",
  "sourceVersion": "1.4.0", "generatedAt": "2026-09-25T10:43:00.000Z" }
```

A reader refuses a `format` it does not know and a `version` it does not know.
A field misread in a one-way import is a value lost for good.

## Notes and records

**The path is the key.** Vault-relative, `/`-separated, NFC-normalised (macOS
stores names decomposed; Obsidian and this format do not). Every record names
the note it came from by path, and every note is in `vault.json` exactly once.

A section file is `families`, a map from family name to a list of entries:

```json
{ "path": "Trips/Aargau Weekend/Aargau Weekend.md",
  "record": { "title": "Aargau Weekend", "departure": "2026-10-17T09:12",
              "country": { "ref": "Places/Countries/Switzerland.md" }, "...": "..." } }
```

- **`{ "ref": path }` is a pointer to another note's record.** The plugins
  resolve links between notes (a stop's city, a city's country, a trip's
  extensions) and hand over the result, so the app never resolves a title. The
  title the note itself wrote sits beside it (`countryTitle`), so an
  unresolved link is `"country": null` with the title still present.
- **`null` means absent.** A key is never dropped for having no value.
- **Derived values are included as the plugin shows them**: a trip's effective
  status, a place's `visited`. The note's own claim is in `vault.json`, raw.
- **Money stays as the notes hold it.** Amounts per currency, never summed
  across currencies; a total over unpriced lines is `null`, not zero.

## The families in version 1

| Source | Families |
|---|---|
| apertrail | `trip`, `booking`, `country`, `state`, `city`, `place` (with `kind`), `vehicle`, `excursion` |
| nodatrail | `area`, `goal`, `project`, `resource`, `purchase`, `bill`, `recurring`, `account`, `journal`, `budget` |

Not parsed yet, and carried raw in `vault.json`: periodic notes (days, weeks,
months, quarters, years), tasks inside notes, CRM people and companies, and
CULItrail's notes. Attachments (pictures, PDFs) are not exported in version 1;
a record or a body names them by path.

## The report

The report is the spike's first exit criterion made mechanical: every note is
either claimed by a family or listed as carried raw, and three checks must come
out zero:

- a note claimed by two families,
- a record for a note the vault does not hold,
- a `ref` to a note the vault does not hold.

It prints counts and folder names only, never a note's content, so it can be
pasted anywhere.
