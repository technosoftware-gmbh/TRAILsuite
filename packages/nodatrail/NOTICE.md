# NOTICE

NODAtrail
Copyright (c) 2026 Technosoftware GmbH, Switzerland (<https://technosoftware.com>)

Licensed under the PolyForm Noncommercial License 1.0.0. See `LICENSE`.

## Lineage

**This is a clean-room implementation.** It carries no code from Recipe Box,
and none from CULItrail, which is GPL-3.0-or-later and cannot flow into a
PolyForm package. Where a mechanism here matches one in CULItrail, notably the
one-time settings adoption from a sibling plugin's `data.json`, the approach was
followed and the code was written fresh. That distinction is the whole reason
the two packages can be licensed differently.

The build and lint configuration, and the PolyForm licence text itself, come
from APERtrail, which is under the same licence and the same copyright.

## Shared code

Everything under `trail-core` (`packages/core`) is MIT and flows in freely. The
money formats NODAtrail reads and writes live there rather than here, for the
reason `packages/core/CLAUDE.md` gives: a note format is an agreement about a
file rather than one plugin's model of it.

## Marks

TRAILsuite, NODAtrail, APERtrail, CULItrail and TRAILcore are product names of
Technosoftware GmbH. A licence to use this package is not a licence to use the
marks or the artwork in `images/`. See the repository's `NOTICE.md`.
