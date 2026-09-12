# Changelog

All notable changes to NODAtrail are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**What counts as a breaking change here is what happens to a vault**, not what
happens to a signature. Renaming a default property name, changing a `type:`
value, or changing what a reader will accept out of a note somebody already has
is breaking, because nothing migrates a vault automatically and a property no
note carries is not an error. See
[Data model](docs/design/data-model.md) for the note formats this promise covers.

`npm version` runs `sync-version.js`, which copies `package.json`'s version into
`manifest.json`, so the two cannot drift.

## [Unreleased]