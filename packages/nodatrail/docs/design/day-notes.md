# The day note, and retiring the navigation block

**Written 28 August 2026, before any code.** It changes what gets written into
period notes, which is the class of change this repository treats as expensive:
a vault is somebody's records, and a bad write is discovered months later.

**This records the design as it was argued, not the code as it stands.** Where
the two diverged the code won, and the sections added afterwards say so; read
`architecture.md` and `data-model.md` for what the plugin does today.

Two changes that arrived in one conversation and are one change in practice.
The navigation block exists because moving between periods was a thing you did
by clicking links in a note. The plan view does that now, and is about to do it
better. Once it does, the block is 365 pairs of links a year that nobody reads.

And the reason for wanting to move around less is the reason for the second
half: **writing a day by hand should stop being writing markdown by hand.**

---

## Part 1: retiring the navigation block

### What it is now

`plan/nav-block.ts` builds two lines at the top of every period note:

```
⏮️[[2026|Yearly]] > [[2026-Q3|Quarterly]] > [[2026-07|Monthly]] > [[2026-W30|Weekly]]⏭️

⬅️[[2026-07-20|Juli 20, 2026]] < Juli 21, 2026 > [[2026-07-22|Juli 22, 2026]]➡️
```

It is generated, idempotent, and never touches anything below itself. **87 of
the vault's 110 plan notes carry one**, in two spacings: the day notes have no
space around the arrows and the week, month and year notes have one.

### What replaces it

Nothing in the note. The plan view already has the five level tabs, a Today
button and previous/next, which is every movement the block offered except
jumping several periods at once. Part 2 adds that.

### The rule: strip on write, never in a sweep

Generation stops. The writer that used to rebuild a block **removes** one
instead, so a note is cleaned the next time NODAtrail writes to it and never
before. Nothing rewrites 87 notes at once, and a block left in a note nobody
touches is inert markdown whose links still work.

This is the same rule the block already followed for its own spacing: the two
shapes were never reconciled in a sweep, and a note picked the current one up
when it was next written.

**The finder is the part worth keeping.** The writer already knows how to
recognise a block by its shape at the top of the body, in both spacings, and
the tests pin that. The change is what it does having found one, not how it
finds it. It survives as `stripNavigationBlock`, which is what the name became
once rebuilding stopped being one of the things it could do.

**One hazard, and it is real.** The week notes were migrated with a `---` on the
line after the block:

```
⬅️ [[2026-W27|Week 27]] < Week 28 > [[2026-W29|Week 29]] ➡️

---

**Week 28, Juli 2026**
```

That rule belongs to the migrated content, not to the block, and the stripper
must not take it. It leaves a horizontal rule at the top of those notes, which
is somebody's formatting rather than our leftover. **The stripper removes the
block's own lines and the blank lines around them, and stops.**

---

## Part 2: a period picker

One control in the plan view's toolbar: a native date input. **Pick any date and
the view jumps to the period containing it, at whatever level is selected.**

One control covers all five levels, which is why it is a date rather than the
five different pickers a month, a quarter and an ISO week would otherwise need.
A quarter has no native input and an ISO week's does not agree with the calendar
year at a boundary, which is exactly the trap `{GGGG}` exists to avoid; a date
has neither problem because `startOfPeriod` already answers "which week is this
date in".

Native, so it is the iPad's own date wheel on the iPad.

---

## Part 3: the day note

### The shape, worked

```markdown
## 🎯 Fokus

- [ ] Q3-Budget fertigstellen [[Q3 Finanzen]] ⏫ 📅 2026-08-29
- [ ] Abo im Fitnessstudio prüfen [[Gesundheit]]

## 📅 Termine

- 👥 10:00 Sync mit Marketing [[Kampagne Herbst]]
    - 📝 Launch verschiebt sich um eine Woche.
    - [ ] Am Montag beim Design nachfassen 📅 2026-08-31

## 🧠 Gedanken

- 💡 Gemeinsames Template für Kundeneinstieg bauen.
- 📝 Artikel über KI-Produktivität gelesen.
```

Compare it against the sketch this came from. Three differences, each deliberate.

**The links are wikilinks, not `[Project: Q3 Financials]`.** The note holds
`[[Q3 Finanzen]]`, and it is a project because *that note* says `type: project`.
Obsidian resolves it, backlinks show the day, renaming the project fixes every
day note that named it, and the core's task parser already extracts links off a
line. `[Project: X]` would be a format nothing else in the vault understands and
would put the word `Project` into logic as a literal, which is the one thing
this repository's conventions rule out. **The view still shows a chip reading
`Projekt: Q3 Finanzen`** -- it resolves the link and reads the type, which is
what "identified by folder and type together" means.

**A starred task is a high-priority task.** The sketch's `⭐️` becomes `⏫`, the
Obsidian Tasks priority marker the core already reads and sorts by. The view can
draw a star. Inventing a second way to say "this one matters" would mean a task
the plan view's urgency sort could not see.

**There is no `# Friday, August 28, 2026` heading.** The note is called
`2026-08-28` and Obsidian shows that as the title. An H1 repeating it is a line
to scroll past. The day's long name belongs on screen, where the plan view
already prints it.

### Headings appear when something needs them

**No template is written into a day note.** `write-period.ts` deliberately
writes frontmatter and nothing else, on the grounds that a plugin seeding
headings is a plugin seeding headings into 365 notes a year that somebody then
deletes. That rule stands.

Instead a heading is created by the first entry that belongs under it. A day
where you only wrote down two ideas has one heading. A day you never opened has
none and is two lines long, exactly as today.

Appending finds the heading, inserts after the last line of its section, and
creates the heading at the end of the note if it is not there. It never touches
the frontmatter and never reorders what is already in the note, which matters
because 105 of the 110 existing plan notes have migrated content in them.

### What is the core's and what is NODAtrail's

**The checkbox line is the core's**, because it is the Obsidian Tasks format and
the core already reads it. `parseTaskLine` reads a line; nothing composes one,
because until now the only write was ticking a box. A `composeTaskLine` belongs
next to the reader: the format is a statement about a file, which is the
promotion test that does not care how many consumers there are.

**The three body markers are NODAtrail's**, and settings rather than literals:

| Setting | Default | What it marks |
|---|---|---|
| `dayMeetingMarker` | `👥` | A meeting or appointment |
| `dayNoteMarker` | `📝` | Something that happened, or was said |
| `dayIdeaMarker` | `💡` | Something to think about later |

**The three headings are settings too, and blank means the translated default.**

| Setting | Blank falls back to |
|---|---|
| `dayFocusHeading` | `t('day.headings.focus')` -- `## 🎯 Fokus` / `## 🎯 Focus` |
| `dayScheduleHeading` | `t('day.headings.schedule')` |
| `dayNotesHeading` | `t('day.headings.notes')` |

Blank rather than a German string in `DEFAULT_SETTINGS`, for the reason the
chart of accounts already taught us: a default baked into the settings object is
one language, and the vault that gets the wrong one has no indication why. Put
the default in the translation tables and it follows the vault's own language,
and setting the field takes it over for good.

**`day-body.ts` stays in NODAtrail**, alongside `nav-block.ts`, which is the
closest precedent: a pure text transform over a note body, no `obsidian` import,
and it lives here. If CULItrail or APERtrail ever want to append to a day note,
that is the two-consumer test and the day to move it.

### The dialog

One dialog, from a command and the ribbon. Four kinds, and **the kind decides
the section** -- nothing asks you which heading you meant.

| Kind | Section | Written as |
|---|---|---|
| Aufgabe | Fokus | `- [ ] text [[link]] ⏫ 📅 date` |
| Termin | Termine | `- 👥 HH:mm text [[link]]` |
| Notiz | Gedanken | `- 📝 text` |
| Idee | Gedanken | `- 💡 text` |

A task offers the text, a project or area, a due date and a star. A meeting
offers a time, the text, a project or area, **and two multi-line boxes**: what
was said, and what follows from it. Each line of the first becomes an indented
`📝`, each line of the second an indented `- [ ]`.

That is what produces the sketch's nested meeting without anything having to
parse the note back to find out which meeting a note belongs under. **A meeting
is captured as one thing, because that is how a meeting happens.**

The project and area picker is one dropdown over the live PARA notes, not two:
the note it points at says which it is.

**The date defaults to today and can be changed**, so yesterday evening's
meeting still goes in yesterday's note. The note is created if it does not
exist, and **is not opened afterwards** -- the same call made for bookings, for
the same reason: a dialog that opens a note is a dialog you close twice.

### What is read back

**The checkbox lines, which the plan view already reads and ticks.** Tasks
written into today's note appear in the plan view's day tab and can be ticked
there, because `readTasks` scans the plan folders and `0 Planung` is already in
`taskFolders`. That works the day this ships, with no new parser.

**Meetings, notes and ideas are written and not parsed back.** They are markdown
you read in the note. This is the line worth holding for now: a parser for the
body format is a parser that can mangle a note you also edited by hand, and the
format has to survive a few weeks of real use before anything depends on reading
it.

---

## What this is not

- **Not a calendar.** A meeting line carries a time and nothing reads it. If
  agenda-like behaviour is wanted, that is a later feature and probably wants
  the meeting to be parsed back first.
- **Not a template plugin.** No note is seeded. Headings arrive with content.
- **Not a change to the task format.** Every line written here is one Obsidian
  Tasks and the core already agree about.
- **Not a migration.** Nothing rewrites an existing note except by removing a
  navigation block from one it was going to write to anyway.

---

## Order of work

1. **Done.** Retire the navigation block: strip instead of rebuild, rewrite its
   tests. The 87 existing blocks were swept in one pass after all, by
   `scripts/strip-nav-blocks.mjs`: 423 deletions and no insertions, every
   deleted line a nav line or a blank one.
2. **Done.** The period picker in the plan view.
3. **Done.** `day-body.ts`, the pure append-under-a-heading transform.
4. **Done.** `composeTaskLine` in the core, beside the parser.
5. **Done.** The six settings, their rows on the Folders page, and the keys.
6. **Done.** `add-to-day.ts` and its dialog, the command, the ribbon icon and a
   button in the plan view's toolbar.
7. **Done.** A task written by the dialog is a Tasks-format checkbox under
   `0 Planung`, which `readTasks` already scans, so the plan view finds and
   ticks it with no new code.

Steps 1, 3 and 6 are the ones that write into somebody's notes.

### What the first day of use changed

**A meeting is a span, not an instant.** The dialog asks Von and Bis and writes
`11:00-12:00` as one word, with no spaces around the dash, so a reader sees
where the time ends and the subject begins and a parser has one token rather
than three. Either half alone is written as it is: an end with no start is a
deadline, and refusing it would lose it.

**The reading half of "tasks now, the rest later" was wrong, and is now done.**
The design deferred parsing the body, and the reasoning was about *writing*: a
parser that can mangle a note somebody also edited by hand. That still holds and
nothing new writes. But the first real day produced a note whose whole midday
was a meeting, and a day view that listed the one task and silently omitted the
two hours the day was actually spent in. **Reading is safe where writing is
not**, so `read-schedule.ts` reads the schedule section for display only and the
plan view's day tab shows it above everything else. A line it cannot make sense
of is skipped rather than guessed at, and a checkbox is never read as a meeting
-- the follow-ups under a meeting are tasks, `readTasks` already finds them, and
picking them up twice would list each one in two sections of one view.

Day level only. A week's schedule is seven notes read on every render of a view
somebody leaves open; if it turns out to be wanted it wants a cache, not seven
more reads.

**One heading is written, every heading is recognised.** The design said a blank
setting means the translated default, and that was right and incomplete.
NODAtrail follows Obsidian's language, so the language can change under a note
-- and `## 🎯 Fokus` would then not find `## 🎯 Focus`, and would write a second
heading beside the first, quietly, in a file somebody keeps records in.
`headingsFor` therefore returns a list: the first is written when none is there,
and every language's default is accepted when one is. A configured heading leads
without replacing the defaults, so filling the setting in still finds the notes
written before it was filled in. `tAll` in the I18n manager is the one call that
answers "every language's spelling of this key", and it exists for this and
should be used for nothing on screen.

### Editing an entry, and the rule that makes it safe

The design deferred writing to the body and was right to. What it did not have
was a way to write to it safely, and this is that:

**An entry is offered for editing only when the plugin can reproduce its line
exactly.** Every candidate is parsed into a draft, the draft composed back into
a line, and the two compared. Equal means the dialog holds everything the line
says and can rewrite it losing nothing. Different means the line carries
something with no field behind it, and the entry is shown, is not offered for
editing, and opens the note instead.

So `- 👥 11:00 Sync [[A]] [[B]]` is read-only: the dialog has one context field
and would drop the second link. `- 👥 11:00 PMQ #arbeit` is editable, because
the tag rides along inside the text and survives the round trip. The rule is
about what the round trip loses, not about what looks unusual.

That is conservative on purpose, and it is what lets the dialog re-render an
entry at all. The core's task module refuses to re-render a line, and rightly:
its write is a side effect of ticking a box. Here the write *is* what somebody
asked for, so re-rendering is correct -- but only for a line that re-renders to
itself.

**The span is re-checked against the file before it is written to.** Line
numbers come from a render that may be minutes old, and a note edited in
Obsidian meanwhile has moved them. Writing to a remembered index would overwrite
whatever had taken that line, so the note is read again, the lines compared, and
a mismatch refuses rather than guesses.

**A meeting deletes with its children**, because they were captured as one thing
and a note left under nothing is an orphan nobody can place. And an edit that
changes the kind is a delete followed by an append, in that order: a failure
between the two leaves the entry missing, which somebody notices, rather than
duplicated, which they do not.

The day is not offered while editing. Moving an entry to another day is a
different operation from correcting one, and one date field doing both turns a
mistyped digit into a silently moved entry.

### Moving a task to another day

What did not happen today has to go somewhere, and a weekly review is reading
what the week holds and putting each thing on a day. Both are the same
operation, and neither of them moves a line.

**A task's period is decided by its date, not by the note it is in.**
`readTasks` scans every plan folder and `tasksInPeriod` filters by date, so a
task written in Monday's note and dated Friday already shows in Friday and in
that week. Deferring is therefore a date change, and there is nothing to cut out
of one file and splice into another -- which is the write most likely to lose
something, and the one a meeting's follow-up would suffer most from.

The notes stay a record of when something was written down. A task deferred five
times still has one line in one note.

**The date that places the task is the date that moves.** `isInPeriod` used
`due ?? scheduled` inline; that rule is now `placingField` in the core and
`isInPeriod` is written in terms of it, so the two cannot disagree about which
date it is. They must not: moving the other one would be a button that reports
success and changes nothing, for the commonest task there is -- one with a due
date. A task with no date at all gains a due date, because an undated task falls
in no period and deferring one has to give it somewhere to land.

The write is surgical, like every other write to a task line. The field is
removed wherever it was and re-appended at the end, which is where the Tasks
plugin puts its dated fields; the text, the tags, the links, the priority and
the recurrence are untouched. Rebuilding the line from parsed fields would
normalise somebody's writing every time they deferred something.

**Every menu entry is a concrete date rather than a phrase**, worked out once,
so a Monday and a Sunday cannot disagree about what "next week" meant. Today is
never offered: deferring to the day something is already on writes the same date
back and reports success. From the week level the seven days of **the week on
screen** are offered too, which is the weekly review; taking them from the week
containing today would file everything in the past whenever the review is done
in advance.

### An entry in a day's note is that day's

A follow-up written under a meeting had no date, and a task added without
filling the date field in had none either. **An undated task falls in no period
at all** -- `placingDay` returns null and every view filters by date -- so both
were invisible in the plan view the moment they were saved, could not be ticked
from it, and could not be moved. A follow-up is the worse of the two: it is
typed into a box with no date field anywhere near it, so there was no way to
give it one.

So an entry is dated with the note it is written into, unless it says otherwise.

**Only on capture.** `entryLines` takes the day as an optional argument, and it
is passed when the dialog writes a new entry and omitted everywhere else --
composing an entry back to check it round-trips, and rewriting one after an
edit. Two things follow, and both matter:

- A follow-up written before this rule existed still reproduces exactly, so its
  meeting stays editable. Passing the day there would have made every meeting in
  the vault read-only, for a reason nobody could have seen.
- Nothing already in a note is dated behind somebody's back. Editing a meeting
  changes what the dialog was asked to change and nothing else.

And a follow-up that already names a day keeps it. One moved to next week comes
back through this function when its meeting is next edited, and a second date
appended to it would leave one line saying two different things -- after which
it would never round-trip again, and the meeting would silently stop being
editable.

### A deadline and a plan are different facts

The workflow this was built for, in the author's words: Monday morning, look at the
week's meetings and the week's work and create all of it. Every morning, decide
what can be done that day. What is unfinished, move to another day -- or, if it
plainly cannot happen this week, to next week. The same one level up on the
first of the month.

That workflow separates two things the plugin had conflated. **"Must be finished
this week" is a deadline. "I will do it Tuesday" is a plan.** With one date
doing both, every move overwrote the deadline, and after the first move nothing
remembered that the week was ever the limit.

Obsidian Tasks already has both fields and the core already reads both. So:

- `📅` **due** is the deadline. `isOverdue` reads it and nothing else.
- `⏳` **scheduled** is the plan, and **it is what places a task**.

`placingField` therefore prefers scheduled over due. It used to be the other way
round; that was a convention rather than a decision, arriving with the initial
import with no recorded reason, and only a task carrying *both* dates can tell
the difference -- of which the vault had none on the day it changed.

A task due Sunday and planned for Tuesday shows on Tuesday, and goes overdue
after Sunday. Both are true at once, which is the point.

**The Move menu does one of two things.** A day sets the plan and leaves the
deadline. A period sets the deadline to that period's **last** day and clears
the plan -- because "I cannot do this one this week" means the week is the new
limit and no day has been chosen yet, and leaving the old plan would keep the
task sitting on the day somebody has just said they cannot do it on. A period
already ended is not offered: pushing a task into last week is a typo, not a
plan.

**And capture works at any level, decided by the date field.** Name a day and
the entry goes into that day's note. Leave it empty and it goes into the note of
the period the view was showing, dated with that period's last day. Monday
morning produces both at once: the meetings are on days, and the week's work is
not on one yet. At day level the field still defaults to today, so the command
and the ribbon are unchanged.

### A job is a project

A task arrives in a Friday meeting: check this next week. The work happens over
the following week, gathers a note of its own, and comes back to the next Friday
meeting -- which produces two more tasks for the same job, and tasks for three
other jobs besides.

**That is a project**, in the sense PARA means: a series of tasks with an
outcome and an end. The instinct that a project is a long-term thing is worth
naming as the thing it is -- in PARA the long-term container is an *area*, and
projects are supposed to be short. A vault whose only two projects run to 2027
makes the opposite look like the rule.

The real complication is not duration. It is that a life vault has no work area
and no work goal, and **a project derives its area through its goals**, so a
work project would land in the PARA view's orphan section. The data model
already carries the escape hatch and the reason for it: the optional `area:`
override "exists for a project that serves no goal". So one area for work, and
`area:` on each job. No new note type, no new folder, no new status vocabulary
-- and the capture dialog, the wikilink on a task line and the PARA view all
work on it already.

Two things did have to be built, and both were missing whatever a job is called.

**Nothing showed a project's open tasks.** The core's parser has always pulled
the `[[links]]` off a task line and nothing grouped by them, so a job collecting
tasks from four meetings had them scattered across four day notes with no way to
ask what was left. `project-tasks.ts` is that grouping: recomputed on every
render, written nowhere, and the count on a project row opens the list under it.

**The context picker could not create.** A job that came out of a meeting an
hour ago has no project note, and leaving the dialog to write one loses
everything typed so far. It now has the same plus button the invoice form's
company picker has, and for the same reason.

### What follows from a meeting is a list, not a paragraph

Fifteen projects run in parallel in the vault this was built for. Every one that
moved during the week gets discussed on the Friday, so one meeting yields half a
dozen tasks across half a dozen projects -- and the meeting's own context field
holds exactly one.

It worked before by typing `[[Projekt]]` into a text box, which worked by
accident: the typed text was passed through verbatim. That is typing markdown
into a dialog whose whole purpose is that nobody has to.

Each follow-up is now a row: **text, its own project, its own date.** The date
is optional and a blank one takes the meeting's day, so the common case is still
two fields; the point of the third is that "check this next week" is learned in
the meeting, and setting it there is one field rather than a Move on Monday.

**The project carries over from the row above**, because one project discussed
once produces three things, and re-picking it each time is three dropdowns for
one decision. Nothing else carries: not the text, and not the date, because two
tasks for one project routinely have different deadlines and a date copied
silently is a date nobody chose.

**A follow-up read back out of a note is one text field, whole.** Links and date
markers included, because keeping the remainder intact is what makes the round
trip exact -- and the round trip is what decides whether the meeting may be
edited at all. So editing an existing follow-up is coarser than typing a new
one, and it is coarser in the direction that cannot lose anything.

Which produced the one real bug here: text that already names a day now wins
over the row's date field. Appending the row's marker to text that had one would
have left a line saying two different things, after which it would never
round-trip again and its meeting would silently stop being editable.

### Three things the implementation did not anticipate

**The section-end rule needed stating.** A section ends at the next heading of
the same level or shallower; a deeper one belongs to it. `### Vormittag` under
`## Termine` is part of Termine, and an entry added afterwards goes after it
rather than in front of it. Getting that backwards puts a line above a
subsection it belonged under, which reads as a reordering of somebody's note.

**The frontmatter has to be split off before the body transform.**
`appendUnderHeading` knows nothing about frontmatter, so handing it a whole file
would let a property whose value begins with `#` match as a heading, and would
put an entry inside the frontmatter block. `removeNavigation` already did this
correctly and the first draft of the dialog did not.

**The `---` under the old blocks stayed, and the reason changed.** The design
said it was the week notes' migrated formatting. It is more than that: the
migrated notes use `---` as a section separator throughout, sixteen of them in
one monthly note, so the one under the block is that same style rule. 83 notes
now open with a horizontal rule, which is the correct outcome and looks like a
leftover, so it is written down here.

## Separately: a typo in this vault's settings

`weeklyPath` reads `0 Planung/2 Wöchentlichl/...`, with a stray `l`. The vault
has `2 Wöchentlich/` with 60 notes and `2 Wöchentlichl/` with one, `2026-W01.md`,
written through the typo. Not a code defect -- the setting says what it says --
but worth fixing the setting and moving that one note before anything else
writes a weekly.
