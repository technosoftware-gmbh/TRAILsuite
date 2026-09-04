# PARA

Four kinds of note and one archive, with a fifth layer this suite's reference
vault added and the book does not have.

## The five layers

**An area** is something you maintain rather than finish: health, finances, the
house. It has an image, an icon and a priority, and deliberately no status. The
moment an area has a status it is a project.

**A goal** is an outcome inside an area. `Mein Körpergewicht ist auf 100kg
gesunken!` is a goal; `Gesundheit` is the area it serves. A goal has a status, a
deadline, and the days it was reached and closed. **The status decides whether a
goal is finished and the dates record when.** It used to be the other way round,
with a typed date overruling the dropdown; under eight status values that would
mean a goal marked `review` reading as done because somebody had already noted
the day the work stopped.

**A project** is a piece of work with an end, advancing one or more goals. Its
**area is derived through its goals** and never written into the note, so moving
a goal to another area re-files every project under it. A project that serves no
goal can name an area directly, and an explicit value always wins.

**A project is a folder**, named after it, holding the note plus its `_resources`
image and any `_documents` it collects. At a hundred projects a year a flat
folder stops being browsable, and a folder per project means archiving moves the
work and its papers together instead of leaving the papers behind. A grouping
folder you made by hand keeps working: readers match a folder and everything
beneath it.

**A resource** is reference material. It is deliberately thin: a note that
demands eight properties before it can be filed is a note nobody files.

**The archive** is a folder, not a flag.

## The status vocabulary

Goals and projects share one set of eight, in the order work passes through
them:

`backlog`, `planned`, `ongoing`, `blocked`, `done`, `review`, `closed`,
`removed`.

Everything new is written as **backlog**: written down, not yet decided on.
`done` is the work finished, `review` is it being accepted, `closed` is the end
of it. Only `closed` and `removed` count as finished.

**Four older words are read and never written.** A note saying `paused` reads as
`blocked`, `completed` and `achieved` read as `done`, and `dropped` reads as
`removed`. That is what let eight values arrive without rewriting anybody's
notes: a note converts when you next save it from a form, and not before.

## The dates

Five, and each says a different thing: `created` when the note was made,
`deadline` when the work must be finished, `done` when it was, `closed` when it
was accepted, and `archived` when it was filed away.

**Setting a status fills the date it is the record of and shows it to be
corrected**, rather than writing it silently. The day of the action and the day
of the record routinely differ: a project finished on Friday has its status moved
on Monday. `created` can be corrected on the creation form for the same reason,
because a note is routinely written after the thing it records began; once the
note exists it is shown but no longer editable.

## The summary

A PARA note can open with a short statement of what it is about: a `---` rule
under the frontmatter, then a `> [!SUMMARY]+` callout. Every creation form offers
it, and the three edit forms read it back.

It is body text rather than a property, because a summary runs to several lines
and wants to be read where the note is read. **It is the only thing a PARA dialog
writes into a note's body**, and the write is narrow: the block's own lines and
nothing else, and nothing at all when the text has not changed.

> **Goals are optional.** They are not one of PARA's four letters. Leave the
> Goals folder setting blank and the layer disappears: a blank folder matches
> nothing, which is the same rule that makes every unconfigured setting fail
> safe. Projects then name their area directly.

## The picture a project falls back to

At a hundred projects a year the work arrives in families, and a family usually
wants one picture. Naming fifteen notes by hand is fifteen edits and a sixteenth
to forget, so there is a convention instead.

Put a picture in the projects folder's own image subfolder --
`3 Projekte/_resources/` by default -- and name it `Default`. Every project with
no picture of its own shows it. Put a prefix in front of the word and it claims
that family only: `CN-Default.jpg` is the picture for every project whose title
starts with `CN-`.

**The longest matching prefix wins.** With `Default` and `CN-Default` both
present, `CN-1097838` takes the second: the more specific claim is the one
somebody made on purpose.

**Nothing is written into the note.** The fallback is worked out every time a card is
drawn, so renaming the file re-points every project at once and a note that never
mentioned a picture still does not. That is the whole point: writing it back
would turn one convention into fifteen copies of an answer.

**A project that names a picture the vault cannot find does not fall back.** It
shows the missing panel instead, with what the note named. A wrong path is a
fault worth seeing, and quietly showing the family default would hide it behind
something that looks deliberate.

The word is `projectDefaultImageName`, a setting, because it is a name in your
vault. Leaving it blank switches the convention off.

## Archiving

*Archive this note* moves an area, goal, project or resource into
`6 Archive/<Category>/<Year>/` and stamps `archived:` with the day. The year
folder is `archiveYearFolders`, on by default, and it exists because an archive
that only ever grows is one nobody opens twice. A project moves as a folder, with
its image and its documents, and an `image:` that pointed inside the folder is
rewritten to follow it. Its `type` does not
change, so it is still the same note. The active lists stop showing it because
they read a different folder, which is why nothing in the plugin needs a special
case for an archived note and no view can forget to apply one.

*Move this note out of the archive* puts it back and removes the stamp.

Both are a command you run, on one note, having looked at it. Nothing here moves
a file on a schedule or in bulk. Both refuse rather than overwrite when something
already sits at the destination.

## The PARA view

Areas, sorted by priority, each showing the goals in it, the projects under
those, and how many resources it holds. A project reaching an area through no
goal of its own is listed directly under the area.

**Projects are grouped by status, and each group folds.** The order is attention
order rather than the lifecycle order the dropdown offers -- ongoing, planned,
backlog, then blocked, done, review, closed, removed -- and the first three open
by themselves. With a hundred projects a year the finished ones outnumber the
live ones within a quarter, so a view that opened everything would bury the
fifteen that matter. A status nothing is in is not a group at all, so a header
always has something behind it and the count on a shut one is an answer rather
than a zero.

A project with open tasks carries the count, and clicking it lists them where
they stand. For a job that collects tasks from several meetings that is the only
way to see it: the tasks themselves are scattered across as many day notes as
there were meetings. Goals whose area does not exist are gathered at the bottom
rather than hidden, which is the failure this view exists to make visible.

The toolbar's archive switch shows the archived notes alongside the live ones,
each marked. It is a switch rather than a separate view because an archived note
is the same note in a different folder, and giving it its own screen would
suggest otherwise.

## The dashboard strips

Areas, then the goals under them, then the projects under those, as picture
cards. **Six to a row, wrapping onto the next.** They used to be one row that
scrolled sideways, which suited four areas and broke down at fifteen projects:
everything past the third was behind a gesture, and a dashboard is meant to be
read rather than paged through. In a narrow pane the count drops to four and
then to two, so the cards stay legible instead of shrinking past useful.

Goals and projects are ordered by **priority, then deadline, then title**, and
each card shows the first two under its name. An area card shows its priority
the same way; it has no deadline, so that is all it shows. Priority is the claim somebody
made about what matters; the deadline breaks the tie, because among things that
matter equally the one due first is the one to look at. Both fall back the same
way -- saying nothing sorts after saying something -- so an undated goal sits
below one due on Friday rather than above it.

Showing the two facts the cards are sorted by is deliberate: a card ordered by
something it does not display is a card that looks shuffled.

The strips hold the **ongoing and planned** notes only. A backlog is not what a
dashboard is for, and the PARA view is where every status is.

## The project dashboard

Three views answer three different questions about a project, which is why there
are three. The Life dashboard's strip answers **what am I working on** and holds
the ongoing and planned ones. The PARA view answers **what is under this goal**
and puts a project where its goal is. The project dashboard answers **where is
that project**, which at a hundred a year is the one the other two cannot.

Reached from the Life dashboard's toolbar, or *Projekte* in the palette. It shows
every project as the same card, in the same status groups the PARA view folds,
under four filters:

| Filter | What it does |
|---|---|
| **Bereich** | The area, resolved through the goals rather than read off the note |
| **Ziel** | One goal |
| **Status** | One of the eight |
| **Name** | Part of a project's title, ignoring case |

**A blank filter asks nothing.** That is the opposite of the rule every setting
here keeps, where a blank folder matches nothing so an unconfigured plugin fails
safe. A filter is not a setting: one nobody has touched has to show everything,
or opening the view would show an empty screen.

The four narrow **together**, so an area and a status both set means projects in
that area and in that status. Search is a substring rather than a fuzzy match:
`1097` finds `CN-1097838` and `CN-97` finds nothing, because a fuzzy rule would
return both and leave you checking which you got.

The archive switch works as it does in the PARA view, and **nothing is
remembered**. Filters, search and fold state all reset when the view closes, for
the reason the Life dashboard's area filter does: a filter that survived a
restart is a view that silently shows a third of your projects, and the first
symptom is a project you are certain you created.

## The block

````
```nod-projects
```
````

In an area note it lists everything that lands in that area. In a goal note it
lists what advances that goal. It reads the note's own title, so a block copied
into another note answers about that one rather than about the one it came from.
