# Changelog

All notable changes to APERtrail are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this plugin uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

**What counts as a breaking change here is what happens to a vault**, not what
happens to a signature. Renaming a default property name, changing one of the
nine fixed travel `type:` values, or changing what a reader will accept out of a
note somebody already has is breaking, because nothing migrates a vault
automatically. The two code-block languages already written into people's notes,
`travel-itinerary` and `travel-related-trips`, are data rather than internal
naming and do not get renamed. See
[Data model](docs/design/data-model.md) for the note formats this promise covers.

## [Unreleased]

### Fixed

- **A cabin, a place, a person or a photo spot whose name is spelled with a
  differently normalized umlaut on the two sides now matches.** macOS writes an
  umlaut two ways: a name typed into a rename box tends to be decomposed, a name
  pasted off an operator's page is composed, and the two compare unequal. Every
  name comparison in the plugin now goes through `trail-core`'s `caseFold()`,
  which composes before it lowers. The case this was most likely to bite is the
  one the plugin already has a health check for: a leg's `variants` naming a
  cabin the ship's catalogue also lists, where the only symptom of a mismatch is
  a description that quietly does not appear.
