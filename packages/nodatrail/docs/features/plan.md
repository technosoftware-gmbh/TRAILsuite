# Plan

Five levels of periodic note, what falls inside each, and the dialog that writes
into a day without you writing markdown.

## The five levels

| Level | Title | Path |
|---|---|---|
| Day | `2026-08-22` | `0 Plan/1 Daily/2026/2026-08-22.md` |
| Week | `2026-W34` | `0 Plan/2 Weekly/2026/2026-W34.md` |
| Month | `2026-08` | `0 Plan/3 Monthly/2026/2026-08.md` |
| Quarter | `2026-Q3` | `0 Plan/4 Quarterly/2026/2026-Q3.md` |
| Year | `2026` | `0 Plan/5 Yearly/2026.md` |

Each path is a template with tokens: `{YYYY}` `{MM}` `{DD}` `{GGGG}` `{WW}`
`{Q}`. A week uses `{GGGG}` and `{WW}`, the **ISO week-year** and week number,
which is not the same as the calendar year: the last days of December often
belong to week 1 of the following year, and a week note filed under `{YYYY}`
would be filed under a year nobody looks in.

The settings page states the tokens beside the rows. Every link between two
period notes resolves by **title**, not by path, so a template that produced a
title the level's own formatter would not is a template whose notes cannot find
each other -- which is the reason to change a path template carefully rather
than often.

## The navigation block is gone

Period notes used to open with two generated lines: the chain upwards, then the
siblings either side. They were written because there was no other way to get
from a Tuesday to its week.

The Plan view is that way now, and it moves between any two periods at any level
without a note having to carry links to its neighbours. So the block became
scaffolding, and it was retired: **nothing writes one any more.** The 87 notes
in the reference vault that carried one had it stripped, 423 lines removed and
not one line of anybody's own text touched.

*Remove navigation block* takes an old block off the note you are looking at, for
a vault that still has some. It removes the block's own lines and the blank lines
around them and stops at the first line that is neither, so everything below is
left exactly as it was.

## Opening a period

*Open today*, *Open this week*, *Open this month*, *Open this quarter*, *Open
this year*. Each opens the note and creates it if it is not there. A new note
gets its frontmatter and nothing else: there is no body template, because what
goes into a period note is your business and a plugin that seeded headings would
be seeding them into 365 notes a year.

That is also why the capture dialog below writes a heading only when the first
entry needs one.

A note that was already there is handed back untouched, which is what makes
*Open today* safe to run at any hour.

## The rollup

The Plan view shows what falls in the period: the tasks due or scheduled in it,
the goals and projects whose deadline lands in it, and every purchase, bill and
projected recurring cost dated inside it.

**Nothing of this is written into the note.** A rollup written into a period
note is a rollup that is wrong the next morning. The same thing is available
inside a note as a block:

````
```nod-period
```
````

which reads the period from the note's own title.

## Writing into a day without writing markdown

*Add to day* is the second ribbon icon and a command. It captures one thing into
a day note: a **task**, a **meeting**, a **note** or an **idea**.

The dialog asks for the kind, the text, and optionally the project or area it is
about, which it writes as a link so the project's own view can find it. A meeting
takes a time range, what was said, and what follows from it; each follow-up
becomes a task line of its own.

It writes under three headings, which appear the first time an entry needs one:

| Heading | What lands there |
|---|---|
| `## 🎯 Focus` | Tasks |
| `## 📅 Schedule` | Meetings, with their times |
| `## 🧠 Thoughts` | Notes and ideas |

All three are settings, and a blank one means the translated default. **A heading
is recognised in either language and written in the current one**, so switching
Obsidian's language does not orphan what is already in a note.

**An entry is dated with the note it is written into, and only on capture.**
Writing a task into today's note gives it today; editing that task later does not
re-date it, and text that already names a date wins over the row's date field.
The dialog can edit and delete what it wrote, and refuses rather than guessing
when the line has changed underneath it or says more than the dialog can put back.

**Moving what did not get done.** A task can be moved to another day or pushed to
the next week, month, quarter or year. Moving it to a day sets the plan (`⏳`);
moving it to a period sets the deadline (`📅`) and clears the plan. That is what
lets a deadline survive being replanned twice in one week: the day you decided to
do something and the day it has to be finished are different facts.

## Tasks

NODAtrail reads checkbox lines in the Obsidian Tasks format from the folders you
configured, which default to Plan, Areas, Goals and Projects. Deliberately not
the whole vault: a shopping list inside a meal note is not a life task.

Ticking a box in a NODAtrail view rewrites that one line, adds the done date if
it has none, and changes nothing else on it. NODAtrail is a reader of that
format that can tick a box; recurrence, dependencies and the query language stay
with the Tasks plugin.
