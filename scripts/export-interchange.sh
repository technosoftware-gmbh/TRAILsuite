#!/usr/bin/env bash
#
# Exports a vault to the interchange format, for the standalone app's importer.
#
# Reads the vault and writes nothing into it: the out folder is refused when it
# sits inside the vault. Writes into the out folder:
#
#   apertrail.json   APERtrail's note families, parsed
#   nodatrail.json   NODAtrail's note families, parsed
#   vault.json       every note in the vault, raw
#   report.md/.json  what was recognised, what was carried raw only, and
#                    anything that does not add up
#
# APERtrail runs first because NODAtrail's run writes the report over every
# section file already in the folder. A CULItrail file dropped in beforehand
# is counted too.
#
# Usage:  ./scripts/export-interchange.sh /path/to/Vault /path/to/out
set -euo pipefail

VAULT="${1:?usage: export-interchange.sh /path/to/Vault /path/to/out}"
OUT="${2:?usage: export-interchange.sh /path/to/Vault /path/to/out}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT"
npm run --silent core
npm run --silent interchange --workspace packages/apertrail -- "$VAULT" "$OUT"
npm run --silent interchange --workspace packages/nodatrail -- "$VAULT" "$OUT" --manifest
