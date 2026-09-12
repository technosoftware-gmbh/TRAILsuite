# Prospects

One self-contained page about one note, on the same paper as the trip document
and the two cost sheets. It started as the ship's brochure (see
[vehicles.md](vehicles.md)) and became the page every note with a card in the
gallery can print.

## One page, seven subjects

A Vehicle, the five place types, a City, a State and a Country. Not a Booking:
it has no picture, is not a place, and its evidence belongs in the trip's costs
block. Not a Person either -- a page about somebody, printed from their address
and their tags, is not a thing this plugin should make.

**The order is an operator's own**: what it is, what it looks like, what the
note says about it, the categories you choose between, the facts in a grey box,
the rest of the pictures. Then the section no operator's brochure could carry:
**the trips of your own that went there.** That last section is what makes the
sheet yours rather than theirs, and it is the same section whether the subject
is a ship, a hotel or a country.

**Everything above the facts box is one builder.** The five subjects differ in
the grey box and in one middle section; the rest was identical, and a second
copy of two hundred lines of markup is how two pages drift apart in the padding
first and in the meaning second.

`cabins` is that middle section and only a Vehicle fills it in today. It is a
list of categories with a picture and some words each, which is a shape a
hotel's room types would fit without changing a line of the markup.

## What each subject puts in the box

Only what the note carries. A row saying "Rating: --" would be stating an
absence, which is the one thing an omitted row cannot get wrong.

| Subject | Facts |
|---|---|
| Vehicle | Built, refurbished, capacity, length, tonnage, website, deck plan |
| Accommodation | Kind, status, address, rating, where, coordinates, visited, last visit, website |
| Food & Beverage | Kind, address, rating, where, coordinates, visited, last visit, website |
| Landmark, Location, Photo spot | Address, rating, where, coordinates, visited, last visit, website |
| City | Where, coordinates, visited, last visit |
| State | Country, capital, its cities |
| Country | Capital, its states |

A photo spot keeps its **field sheet** as well: times, motifs, bearings, gear
and the capture boxes to tick. The two do not overlap -- the prospect is what
the place is, the field sheet is what to do when you get there.

## Which trips count

Three different questions, and the difference is the point.

- **A vehicle's** are the trips with a leg aboard her.
- **A place's** are the trips that stopped there.
- **A region's** are the trips that named it or stopped anywhere inside it.
  No trip names a State at all, and a Country is named in frontmatter rather
  than stopped at, so the question is asked of the names underneath: a State
  passes its cities, a Country its own name and every city in its states.

## Where it is reached from

**The related-trips block**, which is the one block all seven note types
render. A Vehicle has no editor of its own, a Country has no block that would
otherwise exist, and note 18 records what happens to an export with no button:
the trip document shipped without one and it showed the same afternoon.

The command is **one** -- *Export this note as a prospect* -- rather than
seven. It works out what the note in front of you is, the way the other export
commands already do. Its id is still `export-vehicle-brochure`, because a
command id is what a user's own hotkey points at and renaming it would silently
unbind theirs.

## Editing what it prints

**The Cover dialog**, from the button beside Prospekt on the related-trips
block or from *Edit the cover of this note*. Three fields for the seven
subjects: `description:` as one line, the hero `image:`, and the `gallery:` as
rows with a thumbnail, a caption, a picker, an upload button and up/down.

A trip keeps its own. Its editor already holds these three among twenty others,
and a trip is the one note somebody edits as a whole.

**It owns those three keys and clears them before it writes**, which is what
makes removing the last gallery row remove the property rather than leave an
empty list behind. That is a change of stance: the vehicle editor deliberately
excluded `image` and `gallery` from its managed keys, on the grounds that an
editor which cleared what it did not put there would delete a picture nobody
asked it to touch. The argument ends where an editor exists whose whole job is
those keys. It owns nothing else -- a ship's cabins, a place's rating, anything
hand-added, all untouched.

`description` is written by the cabins dialog too. Two editors writing one
property is fine where they write the same thing; it would not be if either
derived it.

The gallery rows themselves are `ui/components/gallery-field.ts`, lifted out of
the Trip editor when this became its second caller.

## What the note has to carry

Nothing. Every section omits itself when the note says nothing, and a note with
only a title prints a title.

`image:` and `gallery:` are read from every one of these types now
(`vault/read-media.ts`), where before only a Trip and a Vehicle parsed them and
everything else reached into frontmatter at the moment it wanted a picture.
That is why a place could carry a gallery nothing would ever look at -- and why
the health check could not tell you when one pointed at a file that had gone.
It can now.

The prose comes from the note's own `> [!SUMMARY]` block, the same one a trip
has always printed on its document. It sits beside `description:` rather than
instead of it: the property is the line an operator would put under the name,
and the summary is what the note's owner wrote. A note with one, the other,
both or neither prints exactly what it has.
