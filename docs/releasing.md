# Releasing

Four packages ship from this repository on their own versions:
`@technosoftware/trail-core` to npm, and three plugins into Obsidian vaults.
What follows is the whole process. It is short on purpose -- most of the
judgement lives in the changelogs, and this file only says where to apply it.

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
- For the core, a note format is part of the public surface in the strict
  sense, and `CRM_CONTRACT` is stricter still: changing one of its nine values
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

2. **Bump the version** in that package, without letting npm tag it:

   ```sh
   cd packages/<package>
   npm version <patch|minor|major> --no-git-tag-version
   ```

   **`--no-git-tag-version` is the whole point of that line.** Left to itself
   `npm version` writes its own commit and its own tag, and the tag it writes is
   a bare `v2.0.0`. Step 4 then asks for `core-v2.0.0`, so the release ends up
   carrying both: one tag that says which package moved and one that does not,
   on the same commit, in a repository whose entire tag convention exists to
   distinguish four packages. Committing and tagging by hand in step 4 is
   therefore not a second way of doing this step, it is the rest of it.

   `npm version` runs `sync-version.js`, which copies the new version into
   `manifest.json` and stages it, so the plugin manifest and the package cannot
   drift. It also updates the root `package-lock.json`, which belongs in the
   same commit. Obsidian reads the manifest and not the package, so a plugin whose
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

4. **Commit and tag.** The tag names the package, because four packages share
   one repository and a bare `v1.2.0` would not say which one moved. This was
   written as a proposal when no tags existed; it is the observed convention
   now, and `git tag -l` is the authority on it rather than this sentence.

   ```sh
   git commit -am "chore(<package>): release 1.2.0"
   git tag -a nodatrail-v1.2.0 -m "nodatrail 1.2.0"
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

   `core-v*` is not matched by that workflow. The core has no manifest and no
   bundle, and `publish-core.yml` handles it instead.

6. **For the core**, push a `core-v<version>` tag and `publish-core.yml`
   publishes it. No token is involved: the workflow authenticates to npm over
   OIDC as this repository and that file, registered as a trusted publisher on
   the package's npm settings page, and npm attaches a provenance attestation on
   its own.

   **Check the trusted publisher exists before trusting this paragraph.** It
   described the arrangement for two releases during which the arrangement did
   not exist: 1.0.0 and 1.1.0 both went up by hand, the workflow was never
   exercised, and nothing said so until `core-v2.0.0` became the first tag to
   reach it and failed. Whether a published version came from here is a matter
   of record rather than of belief:

   ```sh
   npm view @technosoftware/trail-core@<version> --json
   ```

   A version this workflow published has `_npmUser.name` of `GitHub Actions`
   and an `attestations` key under `dist`. One published by hand has a person's
   name and no attestations. 1.1.0 is the worked example of the second.

   **Tick "Allow `npm publish`" when registering it.** npm's form always allows
   `npm stage publish` and gates direct publishing behind that checkbox, and the
   last step of `publish-core.yml` is a direct `npm publish`. Leave "Environment
   name" empty, because the job declares no `environment:`; filling it in
   requires the workflow to declare a matching one.

   **The failure mode is the reason all of this is written down.** An
   unauthorised publish is answered `404 Not Found - PUT`, not `403`, because
   the registry will not confirm that a package exists to somebody who cannot
   publish it. So a missing or mismatched trusted publisher reads as though the
   package itself is gone, and the log says nothing about OIDC at all. Read that
   404 as "not authorised": the publisher, the workflow filename, the
   environment, or the `npm publish` checkbox.

   **Re-running a failed run is safe**, which is what the `Is this version
   already published` step in the workflow is for. Fix the configuration, hit
   re-run, and a version already on the registry is skipped rather than
   attempted twice.

   **The very first publish of a package cannot work that way**, because a
   trusted publisher is configured on a settings page that does not exist until
   the package does. So the first version goes up by hand, from a clean
   checkout, by somebody logged in to an account with publish rights on the
   `technosoftware` organization:

   ```sh
   npm login
   npm publish --workspace packages/core
   ```

   `publishConfig.access` is `public` in the manifest, because a **scoped**
   package is restricted by default and the failure otherwise is a package
   published privately rather than an error.

   Its `prepare` script builds `dist/`, which `exports` points at, so a publish
   from a clean checkout ships what that checkout builds. Once the first version
   is up, register the trusted publisher **and prove it works on the next
   release** rather than assuming it: an npm version is immutable and a name,
   once taken, stays taken, so the release that discovers the publisher was
   never registered is a release that has already half happened.

## Installing a build into a vault by hand

`./scripts/install-into-vault.sh /path/to/Vault` copies the three files into
`.obsidian/plugins/<plugin>/`. Obsidian does not watch them, so reload the app
or toggle the plugin off and on. A build that is not copied is a change nobody
sees, which has caught people here more than once.
