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
