# Installation

APERtrail is not distributed through the Obsidian community plugin directory. It is built from source and installed by hand.

## Requirements

- Obsidian **1.12.0** or later (`manifest.json`'s `minAppVersion`)
- Node.js for building from source, any version compatible with the pinned `devDependencies` in `package.json` (TypeScript 5.9, esbuild 0.28, Vitest 4)

## Build and copy in

1. Clone or download the [TRAILsuite repository](https://github.com/technosoftware-gmbh/TRAILsuite);
   APERtrail is `packages/apertrail` in it.

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
   npm run build --workspace packages/apertrail
   ```

   This runs `tsc --project tsconfig.check.json` (typecheck) and then a production esbuild pass (`esbuild.config.mjs`). The output is `packages/apertrail/main.js`, alongside the `manifest.json` and `styles.css` that are already there.

   A bare `npm run build` at the repository root builds every package instead, which is fine but slower. Note that it does not order them: `packages/core` is visited after `packages/culitrail`, so a tree whose `packages/core/dist/` is missing or stale fails the typecheck with `Cannot find module 'trail-core'`. Run `npm run build --workspace packages/core` first, or `npm install` again, and the core is rebuilt.

4. Copy the three built files into your vault. The suite ships a script that does it for both plugins at once:

   ```bash
   ./scripts/install-into-vault.sh /path/to/Vault
   ```

   By hand, it is the same three files into `<your vault>/.obsidian/plugins/apertrail/`, which you create if it does not exist:

   - `main.js`
   - `manifest.json`
   - `styles.css`

5. In Obsidian, open **Settings -> Community plugins**, turn **Restricted mode** off, and enable **APERtrail**.

For iterating on the plugin itself, `npm run dev --workspace packages/apertrail` runs esbuild in watch mode and rebuilds `main.js` on every source change. Point Obsidian at the same `.obsidian/plugins/apertrail/` folder (or symlink `packages/apertrail` into it) and reload the plugin after each rebuild. See [Testing & development](design/testing-and-development.md) for the rest of the scripts.

## Try it with the sample vault

`APERtrail-Sample` is a small English-language Obsidian vault built on exactly the default folder structure, with trips, a Country / State / City tree, place notes, photo spots, people and a company already in it. It is the fastest way to see the plugin doing something rather than staring at an empty dashboard.

1. Open `APERtrail-Sample` in Obsidian (**Open folder as vault**).
2. Create `.obsidian/plugins/apertrail/` inside it and copy `main.js`, `manifest.json` and `styles.css` in, exactly as above.
3. Enable APERtrail under **Settings -> Community plugins**.

There is nothing to configure. The default folder settings already point at the right places, because this layout is the one they are named for:

```
Trips/
Places/
  Countries/ States/ Cities/
  Accommodation/ Food & Beverages/ Landmarks/ Locations/ Photo Spots/
CRM/
  People/ Companies/
```

[Sample vault](design/sample-vault.md) describes how the vault is built and what the plugin reads from each part of it.

## First launch

APERtrail scaffolds nothing. On a fresh install the dashboard is empty until you create a Country and go from there, and the configured folders are not created on disk until the first note is written into one.

The defaults put `Trips`, `Places` and `CRM` at the vault root, the same three modules the sample vault uses. If you would rather keep them together somewhere else, set the **Common parent folder** setting once (for example `4 Resources/Travel`) and all three move as a unit, sub-folders included. The folder defaults are also locale-aware, so a German-locale vault starts at `Reisen` / `Orte` rather than an English tree sitting next to an already-translated vault.

Every folder is a setting, and each module moves independently: change a module root and its sub-folders follow, or repoint one sub-folder on its own if your vault organizes only that one differently. `tests/settings.test.ts` covers this derivation, including the case of a sub-folder setting added after a vault had already relocated its tree.

## Uninstalling

Removing APERtrail does not touch your notes. Every trip, country, city and place is a normal Markdown file with YAML frontmatter, readable and editable with or without the plugin. The only thing outside your notes is the settings file at `.obsidian/plugins/apertrail/data.json`, which holds configuration only, no travel data.
