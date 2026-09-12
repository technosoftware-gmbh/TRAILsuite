#!/usr/bin/env bash
#
# Assembles the upload-ready knowledge bundle for the TRAILsuite Claude Project.
#
# **The numbering runs 00 to 12 with no gaps, and that is the second answer to
# the same question.** 07 and 12 were CULItrail's `CLAUDE.md` and data model, and
# when CULItrail moved to its own repository in September 2026 the numbers were
# first left as gaps: a Project upload replaces a file of the same name and
# merely sits beside one of a different name, so renumbering turns two files
# somebody has to delete by hand into fourteen. The renumbering was done anyway,
# in September 2026, and done completely -- the Project holds thirteen files,
# 00 to 12, and none of the old names survive beside them. Closing the gaps a
# second time would mean paying that cost a second time for nothing, so **this
# script follows the Project rather than the other way round.** The file names
# below are the whole of the agreement; if one of them changes again, the old
# name has to be deleted from the Project by hand, because nothing here can
# reach it.
#
# `02-licenses.md` is spelled the American way. The prose inside it is not, and
# neither is anything else in this repository. It is spelled that way because
# that is the name the Project already holds, which is the only consideration
# that applies to a file name here.
#
# Two kinds of file go in. The repository's own documents are copied at the
# moment this runs, so the bundle is never a fork of them: re-run it and upload
# again rather than editing a copy. **The copies are not committed**, and the
# reason is the failure this script exists to prevent: for a while they were
# committed under `docs/claude-project/knowledge/`, which made them a fork after
# all, and the fork is what let the Project answer with a data model from before
# excursions existed while the repository's own copy was current. Only the two
# authored files -- the orientation and the ledger notes -- live in
# `docs/claude-project/knowledge/`, and `claude-project-bundle/` is gitignored.
#
# The orientation file records which of the copied documents have fallen behind
# the code. When that changes, edit it -- it is the one file here whose accuracy
# nothing else can check.
#
# **The Project holds these at its root, not under a `knowledge/` prefix.** The
# prefix was the layout until September 2026 and the reasoning for it still
# stands in the abstract: a file uploaded to one path does not replace a copy
# held at the other, it sits beside it, and the Project then has two documents
# disagreeing about the same thing with no way to tell which is older. That is
# exactly why the path is not a preference to be re-argued. **Upload each file
# at the path the Project already holds it**, which is the bare name, and the
# closing message says so.
set -euo pipefail

start=$(date +%s)
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="${1:-$root/claude-project-bundle}"
src="$root/docs/claude-project"

# Every source, checked before anything is copied and before the output
# directory is cleared.
#
# `set -e` already stops on the first missing file, and that is how this script
# broke and stayed broken: an authored file was renamed, the run died on
# `cp: cannot stat ... 09-ledger-and-money.md`, and the bundle was assembled by
# hand from then on while the Project drifted a release behind. One `cp` failing
# reads as a typo. A list of what is missing reads as what it is, which is that
# the script and the repository no longer agree about a name.
missing=()
for source in \
  "$src/project-instructions.md" \
  "$src/README.md" \
  "$src/knowledge/00-orientation.md" \
  "$src/knowledge/08-ledger-and-money.md" \
  "$root/README.md" \
  "$root/NOTICE.md" \
  "$root/docs/architecture.md" \
  "$root/docs/user-guide.md" \
  "$root/docs/ui-conventions.md" \
  "$root/docs/settings.md" \
  "$root/packages/core/CLAUDE.md" \
  "$root/packages/nodatrail/CLAUDE.md" \
  "$root/packages/apertrail/CLAUDE.md" \
  "$root/packages/apertrail/docs/design/data-model.md" \
  "$root/packages/nodatrail/docs/design/data-model.md"
do
  [ -f "$source" ] || missing+=("${source#$root/}")
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "This script and the repository disagree about ${#missing[@]} name(s):" >&2
  printf '  %s\n' "${missing[@]}" >&2
  echo >&2
  echo "Nothing was written. Either the file moved and the list above needs" >&2
  echo "updating, or it was deleted and its entry here has to go with it." >&2
  exit 1
fi

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
cp "$root/NOTICE.md"                       "$out/knowledge/02-licenses.md"
cp "$root/docs/architecture.md"            "$out/knowledge/03-architecture.md"
cp "$root/docs/user-guide.md"              "$out/knowledge/04-user-guide.md"
cp "$root/packages/core/CLAUDE.md"         "$out/knowledge/05-core.md"
cp "$root/packages/nodatrail/CLAUDE.md"    "$out/knowledge/06-nodatrail.md"
cp "$root/packages/apertrail/CLAUDE.md"    "$out/knowledge/07-apertrail.md"
cp "$src/knowledge/08-ledger-and-money.md" "$out/knowledge/08-ledger-and-money.md"

# The suite-wide documents that have no other home, and the two data models.
#
# A note format outlives every view built over it, so a data model is worth the
# bytes. A settings *reference* is not: it is the list that goes stale fastest,
# and `docs/settings.md` carries the model and says where each full list lives.
# The same reasoning keeps `features/`, `templates/` and `usage.md` out: they are
# product and installation detail rather than design reasoning.
cp "$root/docs/ui-conventions.md"                        "$out/knowledge/09-ui-conventions.md"
cp "$root/docs/settings.md"                              "$out/knowledge/10-settings.md"
cp "$root/packages/apertrail/docs/design/data-model.md"  "$out/knowledge/11-apertrail-data-model.md"
cp "$root/packages/nodatrail/docs/design/data-model.md"  "$out/knowledge/12-nodatrail-data-model.md"

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
echo "at the bare names above: 00-orientation.md and so on, at the Project"
echo "root, which is where the Project already holds them."
echo "A file uploaded to a different path does NOT replace the one held at"
echo "this one. It sits beside it, and the two then disagree silently, so"
echo "match the paths the Project shows rather than choosing a layout."
echo
echo "Paste $out/project-instructions.md into the custom instructions box."
