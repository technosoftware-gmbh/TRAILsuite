# The trip document

**Written and built 30 August 2026.** A trip note held nearly everything a
printed trip document needs and could say none of it. This is the design for
the four fields that were missing, for the folder a trip now has, and for the
sheet all of it is for. Everything here is built.

## Where this came from

A tour operator's PDF for a rail journey through South Africa and Namibia, five
A4 pages, brought as "at the end I will be able to create a HTML or PDF like
this". Its structure, in order:

| The document | Where APERtrail holds it |
|---|---|
| Title | The note's own name |
| Subtitle, `Zugreise in Suedafrika` | **Nothing. Built now.** |
| A photograph across the top | **Nothing. Built now.** |
| `Hoehepunkte dieser Reise`, ten bullets | **Nothing. Built now.** |
| `Reise im Ueberblick`, two paragraphs of prose | **Nothing. Built now.** |
| `Reiseverlauf`, twelve numbered days | `stops`, and the `travel-itinerary` block |
| Prices, included and not included | `budget`, and the booking notes |
| A gallery of photographs | **Nothing. Built now.** |

**Two thirds of the document was already in the note.** What was missing was
everything a trip *says about itself* as against everything that happens on it,
which is why the four arrived as one piece of work rather than four.

## The four fields

| Property | Setting | Shape |
|---|---|---|
| `subtitle` | `tripSubtitleProperty` | string |
| `image` | `imageProperty` | a vault path, a wikilink or a URL |
| `highlights` | `tripHighlightsProperty` | a list of lines |
| `gallery` | `tripGalleryProperty` | a list of `{image, caption}` |

Plus the overview, which is **body text rather than a property**: a `---` rule
and a `> [!SUMMARY]+` callout at the top of the note.

### Why highlights are a list and the overview is not

A highlight is one line, ten of them are an ordered list, and a list of strings
is what that is. Prose is different: several paragraphs in a YAML scalar is
where quoting and line breaks get awkward, and it would be read where nobody
reads it. The form takes the highlights as a box of lines, because ten of them
typed as ten rows is ten clicks nobody wants and a line and an entry are the
same thing.

### `image` was the one name a vault could not change

It was read as a **hardcoded `image` key** by the gallery card and by nothing
else, and `data-model.md` classed it with `icon` and `color` as cosmetic and
hand-edited. That made it the only vault-facing name in this plugin that was not
a setting, and it is why a trip's picture could only ever be typed into the
frontmatter by hand.

It is `imageProperty` now, and it serves every entity card rather than trips
alone -- a country and a photo spot were reading the same literal.

**This changes what a save does to a note.** `image` is in `tripManagedKeys()`,
so the writer rewrites it like every other owned key: a hand-written value
survives a save through the form, because the form loads it and writes it back,
and a save driven by an input that does not carry it removes it. `icon` and
`color` stay cosmetic and untouched, because they still have no field.
`write-trip.test.ts` states both halves.

### The overview block, and where it lives

The arrangement -- rule, blank line, `SUMMARY` callout -- is the one NODAtrail's
PARA notes carry. One vault holds both plugins and a summary that looked
different depending on which plugin wrote the note would be two conventions for
one idea.

It was written down **twice**, in `nodatrail/src/para/summary.ts` and in
`apertrail/src/trips/trip-summary.ts`. By this repository's own promotion rule
that settles the design question: *a note format belongs in the core whatever
the number of readers*, and this is a statement about a file.

**Promoted 30 August 2026**, to `trail-core`'s `markdown/summary-block.ts`,
beside the generic callout reader both were already built on. What held it up
was licensing rather than design -- both plugins are PolyForm Noncommercial and
the core is MIT, so moving the block relicenses that code -- and the copyright holder granted
it: *"The summary could go into the core, that's only a small part."*
`packages/core/NOTICE.md` records the check that let it move: neither copy
descends from CULItrail, so neither can carry Recipe Box lineage.

`write-trip-summary.ts` keeps the half that needs an `App`, and NODAtrail's
`para/summary-file.ts` keeps its own. Those two are what each plugin *does*
with the format, which is not shared and should not be.

## The sheet

**Built 30 August 2026.** The third export, beside the photo spot field sheet
and the trip cost sheet, and on the same paper: all three go through
`shared/print-sheet.ts`, so two of them printed on the same day look like they
came from the same plugin. `trips/export-trip-document.ts` is the pure builder
and `trips/ui/export-trip-document.ts` is its App-bound half, which is the
arrangement both other sheets already have.

The format decision was already recorded, in `photo-spots-enhancements.md`: a
PDF would mean bundling a renderer for a page this simple, and **an HTML file
prints from any browser and survives being copied onto a phone**. The tour
operator's document is a PDF because it was emailed to strangers; this one is
printed by the person who wrote it.

It is reached from the itinerary block's **Trip document** button and from the
command palette. The button came second and should not have: both other sheets
have one, and the first export run after this shipped produced the *cost* sheet,
because that was the button that was there. **A command with no button is a
feature somebody has to be told about.**

It assembles in the order of the table at the top of this document, which is
the order the reference document uses and the order somebody reads a trip in.
Every section a trip says nothing about is omitted rather than printed empty,
which is the same rule the other two sheets follow.

**It prints the plan, not the bookings.** That is the difference between this
document and the cost sheet that lands beside it: a brochure states a price and
a cost sheet states what has been spent against it. Printing the ledger here
would have made this a second cost sheet that happened to have pictures.

The plan is the budget **and the itinerary's own estimates**, which is a
correction. It printed the budget alone at first, so the first real trip -- one
whose money is entirely in a leg's estimate -- got no cost section at all while
the block above it showed 2.420 CHF. The cost sheet has included estimates all
along, with a comment saying a sheet that left them out "would print a smaller
trip than the screen shows". An estimate is a price, not a spend; it belongs.
Only in the trip's own currency, because converting here would be arithmetic
the reader cannot check.

### Transport and stays are their own sections

The Reiseverlauf is **the trip itself, day one to the last day**, which is what
a brochure describes and what somebody decides on. Flights are the other thing:
settled later, and once concrete the outbound one usually leaves the day
*before* day one and the return lands the day after the last.

Folding them into the days would either invent a day 0 in the middle of the
brochure or file a flight under a day it does not happen on. So each leg says
the days it spans, and a note under the heading explains what a day outside the
trip means -- shown only when one is used, because a note that explains nothing
is noise.

**The first export of a real trip printed no flight at all.** The document read
`stops` and nothing else, while the itinerary block draws three bands. It also
meant the document opened at "Tag 2", because nothing was a *stop* on day one
-- the flight was.

**Days are numbered only where they are dated.** `groupStopsByDay` puts the
stops before the first dated one into a leading group of their own, and calling
that group "Day 1" would shift every real day of the trip by one. It prints
unnumbered, which is what it is.

### One defect this uncovered

`export-photo-spot.ts` has shipped since its first commit with **two broken
rules in its own stylesheet**: a stray `}` and an orphaned `border-bottom` at
the top of `STYLE`, left behind when `h2` was extracted into
`shared/print-sheet.ts`, and a `table.logi th` whose selector line had gone,
leaving its declarations to be swallowed by the rule above. A browser recovers
silently from both, so the sheet merely printed plainer than it was written to,
and a full documentation audit read past it twice.

Both are fixed, and `export-trip-document.test.ts` now checks the stylesheet of
**all three** sheets for balanced braces and for declarations standing outside
any rule. Each check was confirmed against the real defect by putting it back.

### Three more the second real trip found

**31 August 2026**, on a nearly finished twelve-day Rovos Rail itinerary. All
three are the same shape as the first: the document is where a note stops being
a note and starts being a page, and nothing before that point notices.

**The costs section priced the first thing in a category and nothing after it.**
Two flights, and only the outward fare printed; the cost sheet beside it had
both, which is what made it look like the document had lost one rather than
never added it. The loop asked whether a category was already in the map it was
itself filling, so the first `transport` estimate landed, made the key present,
and every later one was dropped on the next line. Underneath was an accumulator
adding into that same key -- correct code standing where it could never run,
which is this codebase's most frequent defect and the third time it has been
written down.

The fix is one line. Having somewhere to test it is the rest: the logic lived
inside `ui/export-trip-document.ts`, which imports `obsidian` at module level,
so no test could reach it however obvious the bug. It is
`trips/costs/planned-total.ts` now, pure, with the Rovos trip's own frontmatter
as a case that runs the whole chain -- parse, price, total -- rather than the
one function. Restoring the defect turns five of those tests red.

**A blank line in a note vanished.** A day's paragraph, a stop's note and the
overview are somebody's prose and may be two paragraphs; YAML kept the break,
the parser kept it, the editor's textarea showed it, and HTML collapsed the
newline to a space. `white-space: pre-line` on all three, rather than splitting
on blank lines into separate elements: the field holds one piece of writing, and
deciding where its paragraphs are is not the renderer's business. The itinerary
block had the same gap and got the same three rules.

### What the printer does to the page

Four more, from printing the finished Rovos trip to PDF and looking at it. They
belong together because they share a cause and a blind spot: **the sheet states
a page it does not get**, and none of them is visible in the markup or on
screen. It renders correctly in a browser window and comes apart on paper.

- **The hero picture was 80px narrower than everything else.** A browser gives
  a figure the default margin `1em 40px`. The gallery's figures have always
  reset it; the hero never did, so the largest picture on the sheet was the one
  element not aligned to the text. Two picture contexts, one of them right,
  which is exactly the arrangement that hides an omission.
- **A section heading could be stranded at the foot of a page.** The gallery's
  did, on a seven-page trip: a heading naming a section the reader cannot see.
  This one took two attempts, and the first is the more useful half. See below.
- **The gallery fell to two columns.** `@page` takes 12mm a side of A4, and a
  printer driver takes its own margin on top, so a 190mm body is a body nobody
  has measured. Three 59mm figures need 183mm and did not fit. A column is a
  share of the row now: three across whatever the row turns out to be.
- **The overview split across a page break.** A day may move on its own -- it is
  a unit -- but a paragraph the reader is midway through is not. Kept whole,
  which costs white space at the foot of the page it no longer fits on and buys
  a first page that is the title, the picture and the highlights: a cover.

#### The heading fix that only looked like one

`break-after: avoid` on `h2` says exactly the right thing. It shipped, and the
next real PDF stranded the overview's heading anyway.

The declaration is one an engine is free to ignore, and the engines disagree
about it. Headless Chromium honours it -- the same trip rendered there kept the
heading with its section at every page margin from 0 to 20mm, which is what
made this look fixed. The PDF that showed the defect was printed by **Safari**,
and WebKit does not implement `break-after: avoid`.

**The same PDF proves what WebKit does implement.** The overview stayed whole,
no day split across a page, and no gallery figure was cut in half -- every one
of those is `break-inside: avoid`, the one fragmentation property with
universal support. So the fix is built on that instead: `section()` wraps the
heading and the first block under it in one `.section-head` box, which no
engine may split. A structure a renderer cannot decline, rather than a request
it may refuse.

**Only the first block.** Wrapping a whole section would put all eleven days of
an itinerary in one unbreakable box, which is a box taller than the page --
resolved by breaking it anyway, back where we started, and with the itinerary
starting on a fresh page for nothing. One block is always small enough to move,
and moving it is the whole of what is needed.

The lesson is in the test, which is the part worth keeping. The original
asserted that the rule was present in the stylesheet, and passed the entire
time the defect was live: **a test that checks a declaration exists cannot tell
a rule that works from a rule nobody reads.** It now asserts the markup -- every
heading inside a wrapper, the wrapper carrying the property, and the wrapper
closing before the second block.

The tests assert these in the stylesheet rather than in a rendering, which is
the honest limit of them: they can say a rule is present and cannot say the page
looks right. That is why the fixes were verified by rendering the real trip with
the built stylesheet and reading the PDF, and why the tests name the symptom
each rule prevents rather than the property it sets.

**A day's paragraph printed in what looked like a different font.** It was the
same face at the body's 11pt and near-black, sitting directly above timed lines
at 9.5pt and muted -- a jump big enough that the eye reads it as a different
typeface rather than a different size. It declared no size at all, so it simply
inherited, which also put it level with the trip overview: the largest prose on
the page, arriving in the middle of day five.

Three prose sizes, in a fixed order: the overview, then a day's paragraph, then
the timed lines. The paragraph introduces the day and the lines are its
schedule, so each is a step quieter than the one above. The itinerary block had
the last two **inverted** -- the paragraph muted and smaller than the lines --
and now matches; a size step carries it there rather than a colour, because a
hand-picked tone between `--text-normal` and `--text-muted` is right in one
theme and wrong in the rest.

The test asserts the order and not the three numbers, so the sheet stays
retunable -- but a rule that declares no size, which is the entire defect,
reads as absent and cannot pass.

**A leg could not say who was flying it.** `carrier:` now holds the airline, the
railway or the train's own name, read by the same wikilink-or-text rule as
`origin` and `destination`, and printed between the direction and the reference
in both the block and the document.

The interesting part is how it shipped broken. `legCarrier`, `legCarrierDesc`
and `legCarrierPlaceholder` were written into both locales and the input they
label was never added to the form, so the setting existed, was read, was
written, was rendered -- and could only be *entered* by typing YAML by hand.
Nothing in the build has an opinion about a string nobody prints.

So `translation-keys.test.ts` now checks the inverse over `modals.tripEditor`:
a label that exists in both locales and is asked for by nothing. That subtree
builds no key at runtime, which is what makes the check exact rather than a
list of exceptions -- and is why it is scoped to that subtree and not run over
the whole table, where seventy-odd keys are reached through helpers that take a
key as an argument. It immediately found ten more labels, left behind when the
itinerary moved out of the trip editor into its own block.

## A folder per trip, and the bookings inside it

**Built 30 August 2026.** A new trip note lives in `Trips/<Trip>/`, and a new
booking for it lives in `Trips/<Trip>/Bookings/`. Everything about one trip is
in one place: the note, its pictures, its bookings, and the sheet when it
exists.

**Nothing moves.** A trip already flat in `Trips/` goes on working exactly where
it is, because folder matching recurses -- a reader given `Trips` finds a note
one level down and one three levels down alike. This is a change to where new
notes are *written* and to nothing else. The reference vault has few flat trips
and no migration was wanted.

**Bookings are read from two folders**, the trips folder and the configured
bookings folder. One rule would have been tidier and would have lost half of
them: a new booking is inside its trip's folder and an older one is in the flat
folder, and a vault that moved the bookings folder outside `Trips/` entirely
would be missed by the trips folder alone. `bookingsFolder` is now where a
booking goes when its trip has no folder of its own, and a read scope besides.

`tripBookingsSubfolder` is the folder name, `Bookings` by default. Blank puts
every booking in the flat folder, for a vault that would rather keep them
together.

### The trap this sprang, and did not

The vault check judges a note by the **longest configured folder** it falls
under -- which is how a booking in `Trips/Bookings` has always been judged as a
booking rather than as a trip note in the wrong place.

A booking at `Trips/Shongololo/Bookings/Rovos.md` falls under the trips folder
and under **no bookings folder at all**, because the configured one is a fixed
path that does not contain it. Every nested booking would have been reported as
a trip note carrying the wrong type, on the first run after this shipped. The
matcher now recognises a booking by the folder it sits in, before the
longest-match rule runs, and `trip-folder.test.ts` says so.

## Where the export lands, and how it travels

**Answered: one self-contained file, in a folder of the trip's own.**

Two ways were open, and this repository had already used the first. One
self-contained file, pictures inlined as downscaled data URLs, copied anywhere
with nothing to keep together -- at the cost of a file of a few megabytes. Or
the HTML beside an images folder: small and sharp, and two things that must
travel together or the page comes up broken, which is exactly the failure the
requirement was about. The author chose the single file: *"no mistake in copying
it"*.

So every picture is read out of the vault, downscaled to **1800px on the long
edge** and written into the page as a JPEG data URL. Wider than the field
sheet's 1400 because this one has a hero picture across the full 190 mm of an
A4 page where that one has 52 mm thumbnails. A picture given as an external URL
is left as the URL: there are no bytes in the vault to inline, and a URL goes
on working wherever the file lands as long as there is a network, which beats
printing nothing.

`tripExportsSubfolder` is the folder name, `Exports` by default, inside the
trip's own folder. Blank writes sheets beside the note; a trip still flat in
`Trips/` owns no folder and gets that behaviour anyway.

**The cost sheet moved with it.** It wrote beside the note and now goes through
the same `tripExportFolder()`, so a trip's renderings are one place rather than
two. The cost is one stale copy for any foldered trip already exported, and the
folder-per-trip change is three days old, so there are approximately none.

The subfolder survives the single-file decision on a different argument than
the one it was proposed under. It was proposed so that copying one folder would
carry the pictures; that reason is gone. What is left is that **everything in
it can be deleted and made again from the note, and nothing else in a trip's
folder can** -- which is worth a folder boundary on its own.

## Open: the same for places

Answered yes, and deliberately not in the same change. Photo spots already
export beside their note and have `samples` pointing at pictures, so they want
the same treatment for the same reason. A place has no `Bookings` equivalent, so
it is the simpler half of what was just done.
