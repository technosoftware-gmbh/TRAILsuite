# The TRAILsuite Claude Project

A Project on claude.ai that starts every conversation already knowing this
repository: the three packages, the boundary, the promotion rules, the house
conventions, what is being sold, and the ledger model that no other document
here covers.

It is for the conversations that happen away from the code. Design arguments,
"where should this live", "what did we decide about X and why". Claude Code
reads the `CLAUDE.md` files directly and needs none of this.

## Setting it up

```
./scripts/claude-project-bundle.sh
```

That writes `claude-project-bundle/` at the repository root, which is
gitignored. Then, on claude.ai:

1. Create a Project called **TRAILsuite**.
2. Paste `claude-project-bundle/project-instructions.md` into the custom
   instructions box, everything below the horizontal rule.
3. Upload the thirteen files in `claude-project-bundle/knowledge/` as Project
   knowledge.

**Coming from an earlier bundle:** delete `knowledge/07-culitrail.md` and
`knowledge/12-culitrail-data-model.md` from the Project by hand. CULItrail moved
to its own repository and those two numbers are now gaps. Everything else keeps
its name and is replaced in place by the upload, which is exactly why the gaps
were left rather than closed up.

## Keeping it current

Re-run the script and re-upload after anything substantial lands. Eleven of the
thirteen knowledge files are copies taken at the moment the script runs, so
the bundle is never a fork of the repository's documents: re-run it rather than
editing a copy, or the two will disagree and the Project will be the one that is
wrong.

**What the bundle carries, and what it points at.** The rule is that it carries
what outlives a release and points at what does not. The `data-model.md` files
are in, because a note format outlives every view ever built over it and the
notes in a vault go on holding to it. The `settings-reference.md` files are
out: a list of keys is the thing that goes stale fastest, and
`docs/settings.md` carries the model and names where each full list lives. The
per-plugin `features/`, `templates/`, `usage.md` and `architecture.md` trees are
out for the same reason, being product and installation detail rather than
design reasoning.

That rule was written after finding the cost of the alternative: for months the
Project had a complete frontmatter reference for the two smaller plugins and
none at all for the largest, because `docs/architecture.md` deferred NODAtrail's
note types to a document the bundle did not carry. **A deferral reads as
coverage while the Project holds nothing.**

**Upload them under a `knowledge/` prefix**, which is where the Project holds
them: `knowledge/00-orientation.md` and so on. A file uploaded to the Project
root does not replace the copy under `knowledge/`. It sits beside it, and the
Project then holds two documents that disagree with no way to tell which is
older. The bundle script says so as it finishes.

Two files are authored and live in `docs/claude-project/knowledge/`:

- `00-orientation.md` maps the bundle and records **which copied documents have
  fallen behind the code**. That last part is the reason this Project is worth
  more than uploading the repository wholesale, and it is the one file whose
  accuracy nothing else can check. When you fix a stale document, delete its
  entry here. When you notice a new divergence, add one.
- `09-ledger-and-money.md` covers the double-entry model, the journal format,
  the statement import and the bill and order matching. `docs/architecture.md`
  predates all of it.

Both are also worth reading on their own: between them they are the shortest
accurate description of the finance side that exists.

## Why the instructions say what they say

The custom instructions are short on purpose and spend most of their length on
two things: the package boundary and what is being sold. Both are invisible in
any individual file. The boundary is the constraint a helpful suggestion
violates most naturally ("just import it from the other plugin"), and the
commercial position is the reason the contributor agreement exists at all and
the thing a contributor is most entitled to be told plainly. Everything else in
this repository is recoverable by reading it.

**And one line that is not about this repository at all**: a passing
source-reading test is evidence only once somebody has broken it on purpose. It
is in the instructions because five of these tests have been unable to fail at
some point, and the most recent was broken by a rename in a package that did not
contain it.
