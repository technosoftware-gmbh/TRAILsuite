# Installation

> **Status: built.** The plugin builds and runs. It is not in Obsidian's
> community catalogue, so installation is manual.

CULItrail is not distributed through the Obsidian community plugin
directory. It is built from source and installed by hand.

## Requirements

- Obsidian **1.12.0** or later (`manifest.json`'s `minAppVersion`)
- Node.js for building from source, any version compatible with the pinned
  `devDependencies` in `package.json` (TypeScript 5.9, esbuild 0.28,
  Vitest 4)
- `trail-core`, which `package.json` depends on as `"trail-core": "*"` and npm
  workspaces resolves to `packages/core` in this repository. It is the shared
  layer CULItrail and APERtrail both read dates, frontmatter, wikilinks, plan
  lines and the reheating merge out of, and it is installed with the rest of
  the suite rather than separately.

## Build and copy in

1. Clone or download the [TRAILsuite repository](https://github.com/technosoftware-gmbh/TRAILsuite),
   which carries `packages/core` alongside this package.

   ```bash
   git clone https://github.com/technosoftware-gmbh/TRAILsuite.git
   cd TRAILsuite
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build a production bundle:

   ```bash
   npm run build --workspace packages/culitrail
   ```

   This runs `tsc --project tsconfig.check.json` (typecheck), then a
   production esbuild pass, then lint. The output is
   `packages/culitrail/main.js`, alongside the `manifest.json` and
   `styles.css` that are already there.

   A bare `npm run build` at the repository root builds every package
   instead, which is fine but slower. It visits the packages in whatever order
   npm resolves the workspace graph, and that order puts a plugin ahead of
   `core`, so if `packages/core/dist/` is missing or stale the typecheck fails
   with `Cannot find module 'trail-core'`. Run
   `npm run build --workspace packages/core` first, or `npm install` again, and
   the core is rebuilt.

4. Copy the three built files into your vault. The suite ships a script that
   does it for both plugins at once:

   ```bash
   ./scripts/install-into-vault.sh /path/to/Vault
   ```

   By hand, it is the same three files into
   `<your vault>/.obsidian/plugins/culitrail/`, which you create if it does
   not exist:

   - `main.js`
   - `manifest.json`
   - `styles.css`

5. In Obsidian, open **Settings -> Community plugins**, turn
   **Restricted mode** off, and enable **CULItrail**.

For iterating on the plugin itself,
`npm run dev --workspace packages/culitrail` runs esbuild in watch mode and
rebuilds `main.js` on every source change. Point Obsidian at the same
`.obsidian/plugins/culitrail/` folder, or symlink `packages/culitrail` into
it, and reload the plugin after each rebuild. See
[Testing & development](design/testing-and-development.md) for the rest of
the scripts.

## Try it with the sample notes

**Create the sample notes**, in the command palette, writes fifteen
English-language notes into the vault you have open: meals, two weeks of meal
plans for two people, three orders, and the people and company behind them. It
is the fastest way to see the plugin doing something rather than staring at an
empty dashboard. See [Sample vault](design/sample-vault.md) for what each note
is there to demonstrate.

It shows you what it would write before it writes anything, and it **refuses
outright** if any of those folders already holds a note it did not put there,
naming the note and the folder. A note that is already there is skipped rather
than overwritten. The one edit it makes to an existing note is appending the
`culi-related-orders` block to a contact note another plugin created, which is
what lets one Person note answer to both.

There is nothing to configure afterwards. The default folder settings already
point at the right places, because this layout is the one they are named for:

```
Eating/
  Meals/ Meal Plans/ Orders/
CRM/
  People/ Companies/
```

## First launch

**CULItrail creates no folders on a fresh install.** A plugin that made three
folders in a vault that may already have its own would be guessing, and every
reader here treats a missing folder as one holding nothing. The dashboard is
empty until you write or make a meal, and the folders appear as notes are
written into them.

The defaults put `Eating` and `CRM` at the vault root. If you would rather
keep them somewhere else, set the **Root folder** setting once (for
example `4 Resources/Eating`) and both move as a unit, sub-folders
included. Any single sub-folder can also be repointed on its own if your
vault organizes only that one differently.

The folder defaults are locale-aware, so a German-locale vault starts at
`Essen/Mahlzeiten` and `CRM/Personen` rather than an English tree sitting next
to an already-translated vault.

### If APERtrail is already installed

On a fresh install only, CULItrail reads
`.obsidian/plugins/apertrail/data.json` and adopts only the contact-related
settings from it: the common parent and CRM folders, the People and Companies
folders, the type property name, the two type values, the two tag properties
and the person tag filter.

Nothing else is adopted. Adopting a folder only changes where the plugin
looks; adopting a behaviour toggle would change what it does.

If APERtrail is not present, or its file is missing or unreadable, this is
silently a no-op and CULItrail starts from its own defaults, exactly as a
genuinely fresh vault would. What was adopted is shown in the status block
under **Vault setup**, beside the count of what each folder and type value
currently matches, because "why does this say Personen when I never typed that"
is the question that block exists to answer.

## Uninstalling

Removing CULItrail does not touch your notes. Every meal, meal plan and
order is a normal Markdown file with YAML frontmatter, readable and editable
with or without the plugin.

The only thing outside your notes is `.obsidian/plugins/culitrail/data.json`.
That holds configuration plus one mirror: the in-memory copy of the meal-plan
entries described in
[Data model](design/data-model.md#what-is-stored-outside-notes). The notes it
mirrors are authoritative, so losing it loses nothing except which person and
which week the views were last showing.
