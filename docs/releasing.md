# Releasing

Four packages ship from this repository on their own versions: `trail-core` to
npm, and three plugins into Obsidian vaults. What follows is the whole process.
It is short on purpose -- most of the judgement lives in the changelogs, and
this file only says where to apply it.

## Before anything

```sh
npm ci          # exactly what package-lock.json says, not what npm can make work
npm run check   # typecheck, lint, and the suite
npm run build   # the three bundles, which are what actually ship
```

CI runs the same four commands on every branch, so a release from a green
branch has already had this done to it. Run them anyway before tagging: the
build is the only thing that proves esbuild can still produce a bundle, and it
is the file people install.

## Deciding the number

**What counts as a breaking change here is what happens to a vault**, not what
happens to a signature. Each package's `CHANGELOG.md` opens by saying so, and
each says it slightly differently because the packages promise different
things. Read the one you are releasing before choosing between a minor and a
major.

The short version:

- Renaming a default property name, changing a `type:` value, or changing what
  a reader will accept out of a note somebody already has is **breaking**.
  Nothing migrates a vault automatically, and a property no note carries is not
  an error -- it is silence, months later.
- Adding a marker, a setting or a section a note may now carry is a **minor**,
  and belongs under `### Added` with the vault consequence spelled out.
- For `trail-core`, a note format is part of the public surface in the strict
  sense, and `CRM_CONTRACT` is stricter still: changing one of its seven values
  breaks two plugins at once and silently, because a type value that no longer
  matches produces an empty list rather than an error.

## The steps

1. **Move `## [Unreleased]` to a version heading** in that package's
   `CHANGELOG.md`, dated, and open a fresh empty `[Unreleased]` above it.

   The empty `[Unreleased]` is not shown to anybody: the What's New panel
   skips it, so the three releases it lists are three actual releases. See
   `whats-new-releases.ts` in any of the three plugins.

   These files are written by hand and that is deliberate. A generator emits
   commit subjects grouped under `feat` and `fix`; it cannot write down why a
   decision was reversed, which is what the entries here are for. `standard-version`
   sat unused in three packages until it was removed, and it is not coming back.

2. **Bump the version** in that package:

   ```sh
   cd packages/<package>
   npm version <patch|minor|major>
   ```

   `npm version` runs `sync-version.js`, which copies the new version into
   `manifest.json` and stages it, so the plugin manifest and the package cannot
   drift. Obsidian reads the manifest and not the package, so a plugin whose
   hook is missing reports the old version to every user who installs it --
   which apertrail's was, until this file was written and somebody checked.
   The core has no manifest and needs no hook.

3. **For a plugin, add the version to `versions.json`** with the
   `minAppVersion` it needs:

   ```json
   { "1.0.0": "1.12.0" }
   ```

   Obsidian reads this file to decide which build to offer somebody on an older
   app. Without it every user is offered the newest build whatever version they
   are running, and a plugin that then calls an API their app does not have
   fails at load with nothing useful said about why. `sync-version.js` does not
   write this file: the version it maps to is a judgement about which API floor
   that release actually needs.

4. **Commit and tag.** No tags exist yet, so this is the proposed convention
   rather than an observed one: the tag names the package, because four
   packages share one repository and a bare `v1.2.0` would not say which one
   moved.

   ```sh
   git tag nodatrail-v1.2.0
   ```

5. **For a plugin, the release makes itself.** Pushing the tag runs
   `.github/workflows/release.yml`, which does `npm ci`, `npm run check` and
   `npm run build` from the tag and attaches `main.js`, `manifest.json` and
   `styles.css` to a release it creates. Those three files are what a vault
   installs; nothing else in the package is needed at runtime.

   It is built there rather than uploaded from a working copy on purpose:
   what somebody uploads by hand is whatever their `packages/<plugin>/` held
   at the time, and that is the one thing nobody can check afterwards. The
   workflow also refuses a tag whose version and `manifest.json` disagree.

   `core-v*` is not matched. The core has no manifest and no bundle.

6. **For `trail-core`**, `npm publish` from `packages/core`. Its `prepare`
   script builds `dist/`, which `exports` points at, so a publish from a clean
   checkout builds what it ships.

## Installing a build into a vault by hand

`./scripts/install-into-vault.sh /path/to/Vault` copies the three files into
`.obsidian/plugins/<plugin>/`. Obsidian does not watch them, so reload the app
or toggle the plugin off and on. A build that is not copied is a change nobody
sees, which has caught people here more than once.
