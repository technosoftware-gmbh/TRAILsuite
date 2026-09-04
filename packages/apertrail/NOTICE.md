# NOTICE

APERtrail
Copyright (c) 2026 Technosoftware GmbH, Switzerland (<https://technosoftware.com>)

Licensed under the PolyForm Noncommercial License 1.0.0. See `LICENSE`.

## Lineage

**This package was written independently.** It carries no code from Recipe Box
and none from CULItrail, which is GPL-3.0-or-later and cannot flow into a
PolyForm package. It must not be given any: a single file copied across would
relicense this package as a whole without anybody meaning it to, which is what
`tests/licence-boundary.test.ts` at the repository root exists to prevent.

The build and lint configuration, and the PolyForm licence text, are shared with
NODAtrail, which is under the same licence and the same copyright.

## Shared code

Everything under `trail-core` (`packages/core`) is MIT and flows in freely.

Movement in the other direction has happened once and is recorded in
`packages/core/NOTICE.md`: the callout-block reader that both this package and
NODAtrail carried was adopted into the core and relicensed to MIT. Both copies
were Technosoftware GmbH's own and neither descends from CULItrail, so the
relicensing was the copyright holder's to grant. That check comes first every
time, and a file whose lineage cannot be established stays where it is.

## Marks

TRAILsuite, APERtrail, CULItrail, NODAtrail and TRAILcore are product names of
Technosoftware GmbH. A licence to use this package is not a licence to use the
marks or the artwork in `images/`. See the repository's `NOTICE.md`.
