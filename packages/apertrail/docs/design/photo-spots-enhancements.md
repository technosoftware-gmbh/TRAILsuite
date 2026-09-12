# Enhancing photo spots: the mockup gap, translation, and what to change next

> **Status: every step in §6, A to G, is built.** `docs/design/photo-spots.md`
> is why the feature is shaped the way it is, `docs/features/travel.md` is
> what the code does today, and this document is why the next round changed
> what it changed. Where it disagrees with either of those about the present
> tense, they are right and this one has drifted.

> **What shipped, against §6's own order.** A: the two health checks the
> design promised (plus a third for a missing timezone), the website link,
> the capture count in the block's heading, motif coordinates, distinct
> icons for main and secondary. B: one locale registry, English as the typed
> base with partial community tables, sixteen compass tokens. C: the day
> band moved to `shared/sun-band.ts` and drawn in the sun panel with ticks
> and a legend, the light chip palette, the zone readout. D: light badges on
> a photo spot stop, the `motif` sub-key on a stop, the prefill explaining
> itself. E: plural forms via `Intl.PluralRules`, a clock-format setting, a
> units setting, logical CSS properties, a language setting. F: ticking a
> motif off from the shot list, the next-light line, named-season buttons,
> and conflicts compared across every pair in a day rather than neighbours
> only. G: the single-spot field sheet, written beside its note as one
> self-contained HTML file.

> **What changed on the way.** Two things worth knowing before reading a
> section as if it were the code. §5.1's timezone rule is coarser than
> proposed: it compares a longitude's solar offset against the device's
> STANDARD offset, with a 90-minute threshold, because anything tighter
> warns on every note in a Spanish vault and anything looser stays quiet
> about a British spot in a Swiss one. And §2.9's prefill sentence went into
> the stop editor rather than onto the itinerary row, for the reason that
> section gives. §4.6 proposed the export as a PDF and it ships as HTML: a
> PDF would mean bundling a renderer for a page this simple, and an HTML
> file prints from any browser and survives being copied onto a phone.

> **Where the comparison comes from.** Three sources were read against each
> other: the design document, `docs/design/photo-spots-mockup.html`, and the
> shipped source under `src/places/`, `src/trips/`, `src/ui/` and
> `src/lang/`. Every gap below names the file it was found in, so a claim
> that has gone stale can be checked in one step rather than re-derived.

## 0. The short version

The feature is built. All eight phases of the design's build order shipped,
and the data model, the writer, the block, the solar module, the itinerary
integration, the facets and the dashboard tile are all real. What is left
is not model work. It is three different things:

1. **Presentation.** The mockup renders light as colour and shape; the
   plugin renders it as text. The gap is a day band, a chip palette and
   about a dozen small readouts, and none of it needs a new property.
2. **Translation.** English is the base language and the mechanism is
   sound, but a language currently exists in three lists that disagree,
   a partial translation cannot be shipped at all, plurals are an English
   suffix, the compass is composed letter by letter in a way that is wrong
   in Chinese, and the clock is hardcoded to 24 hours.
3. **Two things the design promised and the code does not do.** The two
   photo-spot health checks from §8 are absent, and a stop cannot say which
   motif it is for, which makes the golden-hour prefill quietly wrong for
   every trip that goes for the secondary motif.

§6 turns all of it into an order.

## 1. What already matches, so the gaps are credible

Worth stating plainly, because the list below is long and could read as if
little works. Shipped and correct today: motif cards ordered main first with
role, bearing, lens and season on the header; light chips resolved to clock
times per window and per motif coordinates; a light-relation badge computed
at the middle of the first requested window; gear chips with an icon table
and a verbatim fallback; the technique tip box; samples grouped by motif
with the lightbox wired through `renderImageCard()`; the logistics band with
its transit rows; the sun panel with a date stepper and an honest polar-day
answer; full editing of motifs and samples with one write path through
`updatePhotoSpotNote()`; the itinerary sun band; golden-hour prefill; the
schedule conflict warning; the shot list; five photo-spot gallery facets;
the dashboard section and the fifth stats tile.

The model is not the problem. Everything below is about what the UI says.

## 2. The mockup gap

Nine items, in the order they cost the reader something.

### 2.1 The sun panel has numbers but no shape

The mockup draws the day as a gradient band with hour ticks and a legend,
then puts the numbers underneath. `renderSunPanel()` in
`src/places/ui/photo-spot-block.ts` draws only the numbers: a grid of seven
label-and-value cells. The difference is not decoration. A band answers
"how long is the good light and how far into the evening does it sit"
without reading a single figure, which is the question you ask while
deciding whether a spot fits a day.

The band already exists in this codebase. `sunBandSegments()` in
`src/trips/trip-light.ts` produces exactly the four-bucket segmentation the
mockup draws, and `.apt-itinerary-sunband` already styles it.

**Proposal.** Move `sunBandSegments()` and its `SunBandKind` out of
`src/trips/`. It needs no Obsidian `App` and it is not a trip concept: it
is a function of a place, a date and this plugin's own light vocabulary. By
the rule in `CLAUDE.md` that puts App-free helpers with no module of their
own in `src/shared/`, it belongs in `src/shared/sun-band.ts`, imported by
both blocks. Then render the band above the existing grid, with hour ticks
at 04, 08, 12, 16, 20 and a four-entry legend, and a "now" marker when the
shown date is today. Rename the CSS to `.apt-sunband` and keep
`.apt-itinerary-sunband` as a wrapper for the itinerary's thinner variant.

Cost: one file move, about forty lines of rendering, five CSS rules, four
translation keys (the legend). No new setting, no new property.

### 2.2 The itinerary's photo-spot stops carry no light badges

This is the largest visual gap and the one that matters most for
positioning. In the mockup a photo-spot stop row carries a light chip with
the resolved time, a relation badge and the lens. In
`src/trips/ui/itinerary-block.ts` there is nothing of the sort: a photo-spot
stop renders exactly like a restaurant. An itinerary that looks like every
other itinerary until you open a note is not a photography planner, whatever
the tagline says.

**Proposal.** When a stop's target is a photo spot, render a badge row from
the motif the stop is for (the main motif today, the named one once §4.1
lands): the light chip with its clock range on that day, the relation badge
for the motif's bearing, and the lens. All three already have renderers in
the photo-spot block; the work is extracting them into
`src/places/ui/light-badges.ts` so both blocks draw the same pill rather
than two that drift.

### 2.3 Light chips are typographically flat

The mockup colours a chip by light family (blue for the blue hours, gold for
golden hour, sunrise and sunset, neutral for day, overcast and night) and
sets the time in bold tabular numerals inside it. The block draws every chip
with the same `sun` icon and one accent border, and puts the time in the
same text node as the label.

The icon repeated nine times down a card is noise; the colour is what the
eye is actually reading for. The vocabulary is fixed, so a family map cannot
drift out of step with the values.

**Proposal.** A `LIGHT_FAMILY` record over the nine window values,
`apt-photo-spot-light-chip--blue|--gold|--neutral` in the stylesheet, drop
the icon, and put the time in its own span with
`font-variant-numeric: tabular-nums`.

While there: a `night` chip currently renders as a single time, because
`lightWindowRange()` correctly returns a null end for it, and the renderer
treats "no end" the same as "an instant". "Night 22:14" reads as a moment.
It should read as "Night from 22:14", which is one key.

### 2.4 The sun panel does not say where or in which zone it computes

The mockup prints `Europe/Zurich · 46.9899, 6.9293` in the panel header. The
block prints the date and the stepper and nothing else. This is a
correctness problem wearing a cosmetic disguise, and §5.1 is about it.

### 2.5 The motif header hides its coordinates

The mockup's meta row is role, coordinates, bearing with compass point,
lens, season. `renderMotifMeta()` renders everything but the coordinates.
For a motif with its own `geoLocation` they are what you paste into a map
app on the morning of, and the card is where you are already looking.

**Proposal.** Show them only when the motif carries its own pair. When it
does not, the coordinates are the note's, and the anchor line at the foot of
the card already says so.

### 2.6 The block never says how far along you are

The mockup's note header reads "1 of 2 motifs captured". The block's Motifs
heading says only "Motifs". The count already exists: `capturedMotifCount()`
feeds `dashboard.capturedCount` on the gallery and dashboard cards through
`src/ui/dashboard/travel-entity-meta.ts`.

**Proposal.** Put the same phrase in the Motifs heading. Zero new logic and
zero new keys; it is one call moved.

### 2.7 The website is not a link

`logisticsRows()` returns the website as a plain string and the renderer
draws it into a `div`. Every other row in that band is text you read; this
one is a thing you click. `src/shared/short-url.ts` already exists for
exactly the display half of this.

### 2.8 Main and secondary motifs look nearly alike

The mockup gives them different icons and tones. The block calls
`setIcon(..., 'camera')` for both and distinguishes them by a border colour
and the role chip. On a note with four motifs the main one should be
findable at a glance.

**Proposal.** Keep `camera` for the main motif, use `aperture` for
secondary, and let the existing `--main` border carry the rest.

### 2.9 The prefill is silent

`applyGoldenHourPrefill()` writes `from` and `to` into a new stop and says
nothing. The mockup prints a line under the row naming the light window the
time came from and stating that it is overwritable.

A time that appeared by itself and happens to be wrong is worse than no
time. A time that explains itself is a feature.

**Proposal, and a deliberate departure from the mockup.** Put the sentence
in the stop editor at the moment the prefill happens, not on the itinerary
row. Nothing in the note records that a time was prefilled, so an itinerary
line would be a permanent caption for a one-time event, and it would have to
be re-derived on every render to be printed at all. The modal is where the
edit is happening and where the person can still disagree with it.

## 3. Internationalization

The goal, stated so the proposals can be measured against it: **English is
the base language, every user-facing string is translatable, adding a
language is a contribution rather than a code change, and nothing that gets
written into a user's note is ever localized.** The last clause already
holds and §3.9 only asks that the UI say so.

### 3.1 A language exists in three lists that disagree

In `src/lang/I18nManager.ts` a locale is declared in
`initializeSupportedLocales()` (thirteen entries), again in
`getTranslationsFromFile()`'s map (two entries), and a third time in
`getAvailableLocales()`'s hardcoded `['en', 'de']`. The first list promises
Arabic, Japanese and Russian that do not exist. The third repeats the second
by hand, so a contributor who adds `es.ts` and wires it into the import map
gets a locale that loads and never appears in the list of available ones.

**Proposal.** One `LOCALES` array in `src/lang/translations/index.ts`, each
entry `{ code, nativeName, direction, table }`, and derive all three current
lists from it. "Supported but unshipped" then stops being a state that can
exist: a locale is supported when its table is in the array. The fallback
branch in `setLocale()` that handles an empty table becomes dead code and
can go.

### 3.2 A complete translation must not be the price of any translation

`tests/translation-keys.test.ts` requires every key to be present in both
tables. That is the right rule for two first-party locales and the wrong one
for the tenth community locale: a Spanish contributor who covers eighty
percent of the UI either ships nothing or breaks the build. `t()` already
falls back to English key by key, so a partial table degrades gracefully at
runtime; only the test forbids it.

**Proposal.** Type `en.ts` as the source of truth
(`export type Translations = typeof enTranslations`), type every other table
as a deep-partial of it, keep the strict both-tables check for `en` and `de`
as first-party locales, and report coverage as a percentage for the rest
instead of failing.

Worth revisiting at the same time: that test's own doc comment rejects a
typed key union as too expensive to regenerate. With `en.ts` as the base
type the union is `typeof` and costs nothing to maintain, and it would catch
the misplaced-key bug the test was written for at compile time. The static
scan still earns its place for the template-literal call sites, which no
type can see.

### 3.3 Pluralization is an English suffix

`en.ts` carries `'{count} note{plural} need attention'` and
`'Click again to apply {count} change{plural}'`, and elsewhere
`'{count} people'` and `'{count} stops'` with no singular form at all. The
suffix trick is English-only; it is already wrong in German
(Notiz/Notizen), and it is unusable in Russian, Polish or Arabic, where the
plural categories run from three to six.

**Proposal.** Let a translation value be either a string or an object of
CLDR plural categories, and have `t()` select with
`new Intl.PluralRules(locale).select(count)` when the interpolations carry a
`count`. About fifteen lines in `I18nManager`, and it deletes the `{plural}`
placeholder from the tables rather than translating it.

### 3.4 The compass is composed letter by letter

`localizedCompass()` in the photo-spot block splits `SSW` into characters
and translates each one against `photoSpot.compass.N|E|S|W`. It is a neat
trick, it works for German (O for Ost), and it is wrong in any language
whose compass words are not letter-composable or are composed in a different
order. Chinese writes southwest as 西南, west first; Japanese as 南西. No
per-letter table can produce either.

**Proposal.** Translate the sixteen points as whole tokens
(`photoSpot.compass.SSW` and its fifteen siblings). Sixteen short strings
per locale is not a burden, and it is the only shape that can be right
everywhere. Keep the four-letter table as the fallback for a locale that has
not filled the sixteen in, which makes this change free for German.

### 3.5 The clock is hardcoded to 24 hours

`formatClock()` in `trail-core` passes `hour12: false`. That is right for
de-CH and wrong for most of the anglophone world, which is a strange default
in a plugin whose base language is English.

**Proposal.** Drop the flag and let `Intl` decide from the locale, with an
explicit setting for people who want 24-hour times regardless. One
consequence to plan for: the sun panel's columns stop being uniform width
once "5:12 AM" and "22:14" can appear in the same grid, so the cells need
`tabular-nums` and a min-width.

### 3.6 Distance is metric only

`formatDistance()` is metres and kilometres with no imperial branch, and it
lives in the core, so both plugins inherit it. A photographer in the United
States reading "8.9 km SSW of the anchor" is being asked to do arithmetic on
a card whose whole point is that it answers a question instantly.

**Proposal.** A `units: 'metric' | 'imperial'` setting, defaulted from the
locale on first run and thereafter the user's, passed into the formatter.
The core's own comment already draws this seam by saying a caller with a
different convention should format `distanceKm` itself.

### 3.7 RTL is declared and does not exist

`isRTL()` is implemented, Arabic and Hebrew are listed as supported, and
nothing consumes either: `styles.css` has ten physical `left`/`right` rules
and zero uses of `inline-start`/`inline-end`.

**Proposal.** Convert those ten rules to logical properties, which is a
small and unambiguously correct change, and only then keep `ar` and `he` in
the registry. Promising RTL in a locale list while the stylesheet cannot do
it is the kind of thing that gets discovered by the first person who tries.

### 3.8 There is no way to override the language

The locale follows Obsidian's, which is the right default and a poor
only-option. A vault owner who runs Obsidian in English and keeps a German
vault gets English folder names on first run, and folder names are written
into the vault rather than displayed.

**Proposal.** A language setting whose default is "follow Obsidian",
sitting next to Vault setup rather than among the display switches, because
its most consequential effect is on `getLocalizedFolderDefaults()`. One
ordering trap: it has to be resolved before the first-run defaults are, not
after, or the first vault gets folders in the detected language and the
setting appears not to work.

### 3.9 What is never translated should be visible in the UI

The nine light windows, the four accessibility values, the seven transit
modes, the two motif roles and the nine `type:` literals stay English
identifiers in the note; only their labels are translated. The design argues
this at length and the code does it correctly. What is missing is one line
on the Property keys page saying so, because the natural instinct of
somebody tidying a German vault by hand is to "fix" `golden-hour-evening`,
and nothing on screen warns them that it would make the note unreadable to
the same vault in English.

## 4. Design changes beyond the mockup

### 4.1 A stop should be able to name a motif

The mockup's stop row reads "Neuchâtel (Neuenburg) · Pavillon des Bains" and
prefills from that motif's light. The model cannot express it: a stop
carries `place`, `from`, `to`, `note` and `rating`, and nothing else.

The consequence is live today and silent. `goldenHourPrefill()` always uses
the main motif, so a trip that goes to a spot for its secondary motif gets
the main motif's light window filled in, and nothing on screen says which
motif produced the time. The Neuchâtel example in the design is exactly this
case: the two motifs want opposite ends of the day.

**Proposal.** A `stopMotifField` sub-key setting (default `motif`), free
text, matched by name against the target spot's motifs, with an unmatched
value kept and shown rather than dropped, the same rule an unresolved stop
link already follows. The stop editor offers a dropdown of the target's
motif names only when the target is a photo spot. The prefill and the badge
row of §2.2 both read it. It also makes the shot list honest per trip: the
trip can say which picture it is for.

### 4.2 Captured should be reachable from the itinerary

The capture toggle exists only in the spot's own note. The moment you know
you got the shot is the evening of the day you took it, and the note open in
front of you then is the trip.

**Proposal.** Make the shot list rows toggles. It writes `captured` and
`capturedOn` into the spot note, not into the trip, so the rule against
writing derived values into a second note is untouched: this is not a
derived value, it is a direct edit of the field's owner, made from a
different screen.

While there, fix a smaller thing: the toggle stamps today. Ticked off from
the shot list of a day that has already passed, it should stamp that day.

### 4.3 The block's answer to "when" is below the fold

The five sections follow the printed page's order: motifs, samples, sun,
logistics. In the field, the sun panel is what the note is opened for, and
on a spot with four motifs it is a long scroll away.

**Proposal.** Not a reorder, which would make the note read worse on a
desktop. A one-line summary directly under the Motifs heading: the next
light window this spot's main motif asks for, with its clock range, in the
spot's own zone. Same data, one line, no scroll.

### 4.4 Season, open question 1, can now be closed

The design left months-versus-named-seasons open until real spots existed.
They do. The rendering already collapses consecutive months into a range
("May - Aug"), which is the readable half of what named seasons offered.

**Proposal.** Keep months in the note, keep the range rendering, and add
named-season buttons to the motif editor that write months. The question
closes without touching a single stored value, which is what makes it cheap
to have deferred.

### 4.5 The two health checks the design promised

`docs/design/photo-spots.md` §8 specifies two photo-spot checks, both
warnings: more than one motif with `role: main`, and a sample whose `motif`
matches no motif on the note. Neither exists; `src/vault/health/` mentions
neither motifs nor samples. The second one is the one that bites, because
`photoSpotView()` renders an unmatched sample under "Other samples", which
looks deliberate rather than like a typo in a name.

### 4.6 What a photography product still lacks, briefly

A map is still out of scope and photo spots make its absence louder, not
quieter. Moon phase and Milky Way position are the same arithmetic with a
separate vocabulary, and they are a real use case rather than a nice idea.
EXIF import for samples would fill `exposure` from the file that is already
in the vault.

The one worth doing first is the **field-ready export of a single spot**.
The design cites exporting a spot as a PDF as part of its argument for the
`apt-` prefix, and nothing implements it. It needs no new data, it turns the
note back into the printed double page the whole feature was derived from,
and it is the only item on this list that is useful with the screen off.

## 5. Risks and correctness

### 5.1 The timezone fallback is silent

The block computes `spot.timezone ?? undefined` and `formatClock()` falls
back to the device zone when the zone is absent or unparseable. A spot in
Iceland created from a template with no `timezone:` renders Zurich times
that look entirely plausible, and nothing on screen admits which zone
produced them. This is the bug the design itself named: "the plugin says
golden hour is at 03:40" and nothing else.

**Proposal.** Two parts. Print the zone and coordinates in the panel header
(§2.4), labelled as the device zone when the note carries none. And add a
health-check warning for a photo spot that has coordinates but no
`timezone:` and whose longitude implies a different UTC offset than the
device's current one, so a vault used entirely at home never sees it and a
vault with spots abroad sees it exactly where it matters.

### 5.2 The conflict rule only ever compares neighbours

`scheduleConflicts()` compares each stop against `i - 1`. Two stops that
both want the evening golden hour with a third stop between them are never
compared, and the design's §6.3 rule is about overlapping light windows
rather than about adjacency. The check also requires both stops to carry
clock times on the same date, which is correct (there is no claim to check
otherwise) and worth stating in the docs, because a trip planned in day
granularity will silently never warn.

**Proposal.** Compare every pair within a day rather than consecutive pairs
only, and keep the warning attached to the later stop of each pair. The
design already predicted this piece would need tuning against real trips,
and this is the tuning.

### 5.3 The flat horizon: no change recommended

The sun panel's caveat line is the honest answer and the motif `note` field
is the place a human writes "the sun clears the ridge about forty minutes
after sunrise". A per-motif horizon offset would look like data and would be
a guess. Recommend leaving this exactly as it is, and saying so here so it
does not get reopened every six months.

### 5.4 The block redraws the whole vault on every render

`render()` calls `readTravelBoard()`, which reads every note of every travel
type, to find one place by path. That is consistent with the "nothing is
cached" rule and it is fine at a few hundred notes; at a few thousand, with
a redraw fired on every `metadataCache` change to that file, it is a visible
pause on the capture toggle.

**Proposal.** Not a cache. A narrower read: resolve the file, confirm folder
and type, and parse just that note. The rule that forbids caching does not
require reading everything.

## 6. Suggested order

Each row leaves the plugin shippable, in the same spirit as the original
build order.

| Step | Contents | Why here |
|---|---|---|
| A | §4.5 health checks, §2.7 website link, §2.6 capture count in the heading, §2.5 motif coordinates, §2.8 motif icons | Everything here is small, none of it touches a written value, and two of them are promises already made in the design. Ships in one pass. |
| B | §3.1 one locale registry, §3.2 partial tables plus the typed key union, §3.4 sixteen compass tokens | The translation foundation, before more strings are added by C and D. Doing it after would mean re-touching every table. |
| C | §2.1 the day band (with the move to `src/shared/`), §2.3 the chip palette, §2.4 the zone readout, §5.1 the timezone warning | The sun panel becomes the thing the mockup drew, and the silent-zone bug closes with it. |
| D | §2.2 itinerary light badges, §4.1 the stop motif field, §2.9 the prefill sentence | The trip screen becomes recognisably a photography planner. §4.1 lands with the badges because both read the same field. |
| E | §3.3 plurals, §3.5 clock format, §3.6 units, §3.7 logical properties, §3.8 the language setting | The rest of the localization work, once the registry can carry it. |
| F | §4.2 capture from the shot list, §4.3 the next-light line, §4.4 named-season input, §5.2 the conflict pairs | Refinement over surfaces that already work. |
| G | §4.6 single-spot export | The next feature rather than the next fix, and the one that best repays the model already in place. |

## 7. Deliberately not proposed

- **A map.** Still out of scope for the reasons the design gives. Distance
  and bearing are arithmetic; drawing a map is a dependency.
- **Weather.** Same answer as before. The sun math is offline and stays
  offline.
- **Renaming anything already in a vault.** No fence language, no property
  default, no `type:` literal.
- **Localizing note values.** The fixed vocabularies stay English
  identifiers, permanently.
- **A settings row per sub-key field.** The design's argument holds and
  nineteen more rows would still bury the folders section.

## 8. Documentation and tests these would touch

| File | What |
|---|---|
| `docs/features/travel.md` | The itinerary badge row, the stop `motif` field, the two new health-check warnings, the language and units settings. |
| `docs/design/settings-reference.md` | `stopMotifField`, `units`, the language setting, the clock-format setting. |
| `docs/design/photo-spots.md` | Close open question 1 (§4.4), note that §8's health checks were deferred and are now scheduled. |
| `docs/design/architecture.md` | `src/shared/sun-band.ts`, `src/places/ui/light-badges.ts`, the locale registry. |
| `CLAUDE.md` | The i18n bullet: base language English, partial locale tables with per-key fallback, sixteen compass tokens, plural categories. |
| `tests/translation-keys.test.ts` | Strict for `en` and `de`, coverage report for the rest; the typed key union alongside the scan. |
| New: `tests/sun-band.test.ts` | The segmentation, now that two blocks depend on it. |
| New: `tests/health-photo-spot.test.ts` | Two mains, orphan sample, missing timezone abroad. |
