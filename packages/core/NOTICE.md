# Notice

Copyright (c) 2026 Technosoftware GmbH (<https://technosoftware.com>).

`trail-core` is licensed **MIT**, deliberately more permissive than the three
plugins that consume it: CULItrail is GPL-3.0-or-later, and APERtrail and
NODAtrail are both PolyForm Noncommercial 1.0.0.

That direction works: a GPL plugin may consume an MIT library freely. The
reverse would not. A GPL core would bind any future standalone application to
GPL as well, and GPL is in practice incompatible with the iOS App Store, which
is one of the platforms this package exists to keep reachable.

**Nothing in this package descends from third-party code.** In particular it
carries no part of **Recipe Box** by Arcane Tech / AdamArcane
(https://github.com/AdamArcane/obsidian-recipebox, GPL-3.0-or-later), which
CULItrail's recipe half is built on and which CULItrail's own `NOTICE.md` records.
That code is why CULItrail is GPL and must stay GPL, and it is why every file
adopted into this package has to be confirmed as originally written before it is
moved. A file whose lineage cannot be established stays where it is.

## Adopted files

Each file moved into this package from a plugin is listed here with the check
that let it move.

- `document/invoice.ts` and `obsidian/render-invoice.ts`, from CULItrail
  (`src/ui/invoice/`), moved when the delivery note became a second consumer.
  Written for this repository against `docs/design/invoice-view.md`; Recipe Box
  has no order, invoice or document concept of any kind, so there is nothing of
  it to inherit. The `culi-` class names they write are kept deliberately: the
  stylesheet that carries those rules ships in every CULItrail vault, and
  renaming them would rewrite a file on disk for no visible gain.
- `markdown/summary-block.ts`, from **NODAtrail** (`src/para/summary.ts`) and
  **APERtrail** (`src/trips/trip-summary.ts`), which held the same format twice.
  Both are PolyForm Noncommercial and both are Technosoftware GmbH's own, which
  makes the relicensing to MIT the copyright holder's to grant; Technosoftware
  GmbH granted it on 30 August 2026. Neither descends from CULItrail and therefore neither
  can carry Recipe Box lineage, which is the check that matters here: the block
  was written for NODAtrail's PARA notes in August 2026 against a shape already
  in the author's own vault, and reproduced for APERtrail's trips two days before
  the move.
