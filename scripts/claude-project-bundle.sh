#!/usr/bin/env bash
#
# Assembles the upload-ready knowledge bundle for the TRAILsuite Claude Project.
#
# **07 and 12 are deliberately missing.** They were CULItrail's `CLAUDE.md` and
# data model, and CULItrail moved to its own repository in September 2026. The
# numbers are left as gaps rather than closed up, because closing them would
# rename every file after them: a Project upload replaces a file of the same
# name and merely sits beside one of a different name, so renumbering turns two
# files somebody has to delete by hand into fourteen. Delete
# `knowledge/07-culitrail.md` and `knowledge/12-culitrail-data-model.md` from
# the Project once, and every later run replaces the rest in place.
#
# Two kinds of file go in. The repository's own documents are copied at the
# moment this runs, so the bundle is never a fork of them: re-run it and upload
# again rather than editing a copy. The two authored files, the orientation and
# the ledger notes, live in `docs/claude-project/knowledge/` and are copied
# alongside.
#
# The orientation file records which of the copied documents have fallen behind
# the code. When that changes, edit it -- it is the one file here whose accuracy
# nothing else can check.
#
# The Project keeps these under a `knowledge/` prefix, which is the layout the
# closing message asks for. That prefix is not decoration: a file uploaded to the
# Project root does not replace the copy under `knowledge/`, it sits beside it,
# and the Project then has two documents disagreeing about the same thing with no
# way to tell which is older. Normalised 27 August 2026, after exactly that
# happened.
set -euo pipefail

start=$(date +%s)
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="${1:-$root/claude-project-bundle}"
src="$root/docs/claude-project"

# Cleared rather than overwritten, so a file this script no longer produces
# cannot survive into an upload. The sandbox that edits this repository cannot
# unlink files, so the removal is allowed to fail and the check at the end
# reports whatever it left behind: never silently, because a stale knowledge
# file is one the Project answers from.
rm -rf "$out" 2>/dev/null || true
mkdir -p "$out/knowledge"

cp "$src/project-instructions.md" "$out/"
cp "$src/README.md"               "$out/"

cp "$src/knowledge/00-orientation.md"      "$out/knowledge/00-orientation.md"
cp "$root/README.md"                       "$out/knowledge/01-repository.md"
cp "$root/NOTICE.md"                       "$out/knowledge/02-licences.md"
cp "$root/docs/architecture.md"            "$out/knowledge/03-architecture.md"
cp "$root/docs/user-guide.md"              "$out/knowledge/04-user-guide.md"
cp "$root/packages/core/CLAUDE.md"         "$out/knowledge/05-core.md"
cp "$root/packages/nodatrail/CLAUDE.md"    "$out/knowledge/06-nodatrail.md"
cp "$root/packages/apertrail/CLAUDE.md"    "$out/knowledge/08-apertrail.md"
cp "$src/knowledge/09-ledger-and-money.md" "$out/knowledge/09-ledger-and-money.md"

# The suite-wide documents that have no other home, and the two data models.
#
# A note format outlives every view built over it, so a data model is worth the
# bytes. A settings *reference* is not: it is the list that goes stale fastest,
# and `docs/settings.md` carries the model and says where each full list lives.
# The same reasoning keeps `features/`, `templates/` and `usage.md` out: they are
# product and installation detail rather than design reasoning.
cp "$root/docs/ui-conventions.md"                        "$out/knowledge/10-ui-conventions.md"
cp "$root/docs/settings.md"                              "$out/knowledge/11-settings.md"
cp "$root/packages/apertrail/docs/design/data-model.md"  "$out/knowledge/13-apertrail-data-model.md"
cp "$root/packages/nodatrail/docs/design/data-model.md"  "$out/knowledge/14-nodatrail-data-model.md"

echo "bundle at $out"
echo
printf '%-34s %6s  %s\n' FILE LINES BYTES
total=0
for file in "$out/knowledge"/*.md; do
  lines=$(wc -l < "$file" | tr -d ' ')
  bytes=$(wc -c < "$file" | tr -d ' ')
  total=$((total + bytes))
  printf '%-34s %6s  %s\n' "$(basename "$file")" "$lines" "$bytes"
done
echo
echo "$(ls "$out/knowledge" | wc -l | tr -d ' ') knowledge files, ${total} bytes"

# Anything older than this run is a leftover the copies above did not replace.
stale=$(find "$out" -type f ! -newermt "@$start" 2>/dev/null || true)
if [ -n "$stale" ]; then
  echo
  echo "STALE, left from an earlier run and not written by this one:"
  echo "$stale" | sed 's/^/  /'
  echo "Delete these before uploading."
fi

echo
echo "Upload the contents of $out/knowledge as Project knowledge,"
echo "keeping the knowledge/ prefix: knowledge/00-orientation.md and so on."
echo "A file uploaded to the Project root will NOT replace the copy under"
echo "knowledge/. It sits beside it, and the two then disagree silently."
echo
echo "Paste $out/project-instructions.md into the custom instructions box."
