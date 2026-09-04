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

## [1.0.0] - 2026-09-04

The first public release. Nothing in a vault changes: the note formats,
property names and folders are the ones 0.1.0 read and wrote, and a vault built
against the private builds is a vault this release reads.

### Added

- **The calendar import writes a task for each meeting that has gone from the
  export and is still in your notes.** One per meeting, under the focus heading
  of the day you ran the import, due that day, naming the meeting and linking
  the day it sits on.

  **What this puts in a vault:** new task lines in one day note per import,
  written the way the capture dialog writes a task, so they edit, sort and tick
  like any other. Nothing else is touched and **nothing is ever removed** -- the
  "no longer in the export" list has always been one somebody acts on by hand
  and it still is. This only makes sure the list is still in front of you
  tomorrow.

  Re-importing the same range writes no second copy: a task naming that day and
  that meeting already under the heading is left alone, ticked or not. So
  ticking one off does not bring it back on the next import, and a month import
  run twice does not double its reminders.

  A checkbox that deleted the line on tick was built first and dropped. It is a
  button that takes lines out of a vault on one press, and a reminder does the
  cheaper half of the same job.

  The button counts the reminders as well as the meetings, so an import where
  everything is already in your notes and one meeting has gone still offers
  itself. Counting only the lines to add left it disabled in exactly the case
  the reminder exists for.

- **The week splits each day into Vormittag, Mittag and Nachmittag.** The bands
  were argued against when the week listed tasks, and rightly: a task carries
  `due` or `scheduled`, both of which are days, so a time axis over tasks was
  drawn furniture. A meeting carries a clock. The same shape that was dishonest
  about tasks is exactly right about appointments.

  **All three bands on every day, whether or not anything is in them.** That is
  what makes seven columns a timetable rather than seven lists: nine o'clock on
  Monday sits level with nine o'clock on Tuesday, and an empty afternoon is a
  fact about the week worth seeing.

  A meeting is placed by when it **starts**, so 10:00-14:00 is a morning meeting
  that ran long rather than an afternoon one. A meeting with no time at all sits
  above the bands rather than being guessed into one -- a bullet with no clock is
  allowed, and putting it under Vormittag would be the view inventing a time the
  note does not claim.

- **`weekLunchStart` and `weekLunchEnd`** set where the bands divide. Clearing
  both splits the day in two rather than piling everything into one band, which
  needs no code: past the start is past the end when there is no window.

- **`weekWorkdaysOnly` shows Monday to Friday.** Saturday and Sunday are not
  drawn as columns; one muted line under the grid says what falls on them --
  "Sa: 1 Zahlung   So: 1 Aufgabe". A bill due on a Saturday that simply
  vanished from the view somebody checks on Friday would be the setting costing
  more than it saves. Off by default: a working week is a preference about
  somebody's job, not a default about calendars.

  Monday to Friday is fixed rather than configurable, which is a limit worth
  naming: somebody working Sunday to Thursday gets the wrong five days, and the
  full week is one click away.

### Fixed

- **The calendar import wrote the wrong time for any event stated in UTC or in
  another zone.** It copied the clock digits out of the `.ics` and ignored what
  the file said about them. An `.ics` states a time three ways and only one of
  them can be copied: `20260911T060000Z` is an **instant**, so a 06:00Z meeting
  belonged in a Zurich note at 08:00; `TZID=America/New_York:...T080000` is that
  zone's wall clock, not ours; only a floating time means "this clock, wherever
  you are". A late instant landed on the wrong **day** as well, since 23:00 UTC
  is one in the morning here.

  The error followed daylight saving -- two hours in summer, one in winter --
  which is why it never looked like an offset. In one real export of about 2,800
  timed events, a third were affected, and 06:00 reads as a plausible early
  meeting rather than as a fault.

  **What this means for a vault:** every meeting imported before this is in your
  notes at whatever clock the file happened to state, and fixing the reader does
  not fix them. Re-importing makes it worse, not better: a corrected line derives
  a different key, so the import offers it as a change and leaves the old line
  where it is, and you end up holding both. **Run "Repair imported meeting times"
  first.**

  The zone is the one the machine is set to. Importing the same file on a machine
  set elsewhere writes different times.

- **"Repair imported meeting times", a new command, corrects what the old reader
  wrote.** It reads the archived `.ics` files kept beside your day notes, works
  out which lines it mis-wrote by reading each export twice -- once the old way
  and once the right way -- and shows you the list before touching anything.

  **What it puts in a vault:** it rewrites the clock on a line **in place** and
  changes nothing else. Not a delete, not an append: the entry is recomposed from
  what the note holds, so the attendance marker, the project link, the notes
  indented under it and the follow-ups all survive. It refuses a line that two
  others on the day are indistinguishable from, and one that says more than the
  dialog can compose back.

  A corrected line is **moved to where its new time belongs** in the note. A
  rewrite in place would leave it in the slot its old time earned, which reads
  as a day listed out of order. Only lines this command moves are reordered;
  anything you arranged by hand stays where you put it, and an entry with no
  time keeps its place.

  **A line whose day changes is reported and not moved**, because moving one
  means deleting it from one note and adding it to another. The preview names
  both notes and leaves it to you.

### Changed

- **The week and the month are calendars now: they show meetings.** Each day
  lists the meetings written under its daily note's schedule heading, with the
  time first, and one muted line beneath counting everything else --
  "3 Aufgaben · 1 Frist · 1 Zahlung".

  They listed the tasks, deadlines and payments in full, and a month of a real
  vault answered that: a cell read
  `20260801_MUSTERVERSICHERUNG AG_1000000002`, twelve of them on one Monday,
  and the calendar had become a list of invoice filenames with dates attached.
  The count says which days are loaded, which is the question a month is asked;
  the day view has the detail, which is where it is acted on.

  **A month of schedules costs nothing extra to read.** The day view's own note
  said a week of meetings "wants a cache rather than seven more reads". That was
  measuring the wrong thing: `readTasks()` already reads every note under
  `taskFolders` on every render -- 139 in the vault this was written against --
  and the daily-note folder is one of them, so those day notes are already being
  opened on the same pass.

- **The day is split.** Termine and Aufgaben side by side and given the width,
  because those two are what a day is: what you have to attend and what you have
  to do. Gedanken, Fristen and Geld sit beneath them in narrower panels -- what
  the day contains rather than what it asks of you.

  Every row keeps its actions, which is the whole reason the day exists as
  something other than a bigger calendar cell.

- **A quiet day in the week is blank rather than labelled.** It said NOTHING,
  and repeated down a week that was mostly quiet, the label was louder than the
  days that had something on them.

### Added

- **The day uses the width it has.** Its sections sit side by side rather than
  stacked -- appointments, tasks, deadlines, money -- as a grid of whatever
  fits: three or four panels on a desktop, two on a tablet, one in a side pane,
  with no breakpoint guessing where the line is.

  **The sections themselves are unchanged**, which is the point. Every row
  keeps the checkbox, the move, the close-with-a-reason, the edit, the archive,
  the mark-paid and the open-document -- all the things a week column cannot
  hold. The day is where a period is worked through, so its rows stay complete.

  A row's title wraps here where everywhere else it truncates. `.nod-row-title`
  forces `nowrap` because a row is normally the width of a view and an ellipsis
  is the exception; in a panel a third that wide it is the rule, and "Meine
  Cardiofi..." identifies nothing. Vertical space is free in this layout, so
  the title takes the second line it needs.

### Removed

- **Quarterly and yearly are no longer tabs in the plan view**, which now
  offers Daily, Weekly and Monthly. A quarter of tasks is a list nobody reads,
  and two tabs passed over on the way to Monthly cost more attention than the
  view they lead to is worth.

  **Nothing else about them changed.** Quarterly and yearly notes keep their
  paths, their type values, their folders, their settings rows and their
  Open-this-quarter and Open-this-year commands. The levels were removed from a
  tab strip, not from the plugin: taking them out properly would mean it no
  longer understanding notes that already exist in the vault.


- **The week and the month are drawn as days.** A week is seven columns with
  today outlined and the days behind you dimmed; a month is a calendar grid,
  weeks down and weekdays across, with the ISO week number in the gutter
  because that is what this plugin titles its weekly notes by. A cell shows two
  entries and counts the rest. Day, quarter and year keep the three stacked
  sections: a quarter of days would be ninety-two columns.

  **A money entry in a cell says the company, not the note's title.** The
  sections have room for the title with the company under it; a cell is a
  seventh of a month, and a title that is a filename --
  `20260801_MUSTERVERSICHERUNG AG_1000000002` -- ellipsises to
  `20260801_AQ...` and identifies nothing. Where a record has no company the
  title still wins: something specific truncated beats a blank.

  **No morning/afternoon bands, and that is the data being honest.** A task
  carries `due` or `scheduled`, both of which are days, so there is nothing on
  a line that could place it at an hour. Bands drawn over items that cannot
  fill them would be a grid pretending to know something it does not. The
  column is instead a list in one fixed order -- tasks, deadlines, money --
  which is the same order the sections appear in.

  **These are for seeing, not for doing.** A row in the stacked sections
  carries every action it has in the view it belongs to: tick, move, close with
  a reason, edit, archive, mark paid, open the document. None of that survives
  a column two hundred pixels wide, so a cell here is a line of text that opens
  its note. The week is what is coming; the day is where it is worked through.

- **The plan view leads with the period rather than with the word "Plan".** A
  small kicker, then the period's own name at display size, then the date jump
  and the Open button. The tab strip above already says which view this is.

### Changed

- **The test suite runs in a timezone that has daylight saving.** It ran in
  UTC, where the one date bug that actually bites cannot happen: a day stepped
  by adding 86_400_000 ms repeats 25 October and skips the day after it, and
  under UTC that code passes clean. Verified by breaking `eachDay()` on purpose
  -- the case fails now and did not before. Half this package is calendar
  arithmetic, so the suite should not be run somewhere the calendar is simple.


- **A note can name its own icon, and every row and card now draws it.** Put
  `icon: heart-pulse` on an area, a bill, a company, a budget or a journal and
  that is what stands at the front of its row, in place of the icon for its
  type. A list of forty bills is forty identical receipts; the icon has
  stopped telling you anything and is only occupying the space where something
  useful could go.

  **Lucide names and emoji both work.** A value shaped like a Lucide name
  (`receipt`, `building-2`) goes to Obsidian's icon set; anything else is drawn
  as text, which is how `🧾` renders. The shape is what decides, not a list of
  the two thousand names Obsidian ships, so nothing here needs updating when
  Lucide adds one. A name that turns out not to exist leaves an empty slot --
  the same thing Obsidian does everywhere else.

  **Nothing is written.** NODAtrail reads a note's icon and shows it; it never
  sets one. Editing and archiving go through `processFrontMatter`, which
  leaves properties no form shows exactly as they were, so an icon put there
  by hand or by another plugin survives everything this one does.

  The setting is `iconProperty`, on the property-keys page under the shared
  section, and it is not new -- see below.

### Fixed

- **`iconProperty` finally does what its name says.** It has been a setting
  since PARA shipped and nothing has ever rendered it: `para/parse.ts` read it
  into a record field no view asked for, and `para/write.ts` carried a branch
  for it that only `create.ts` could reach, where it was hard-coded to `null`.
  A setting, a parser field and a writer branch, all reachable, all pointless.

  The parse-and-write half is gone rather than fixed. An icon is a property any
  note can carry, not a field of a goal, so it is read where a row is drawn
  instead -- one place, every note type, including the ones added later.
  Threading it through `BillProperties`, `PurchaseProperties` and the rest
  would have been six parallel changes in `trail-core` to say one thing.

### Changed

- **The plan view's due-in-this-period and money rows say what their own views
  say, and do what they do.** A project showed the word "Project" where PARA
  shows its status, and neither section offered any action at all -- so seeing
  something in a week and acting on it were two different views.

  A goal or a project now carries **its type and its status**, the completed
  tone, the archived chip, and **edit and archive**. The type stays because this
  section mixes goals with projects, which PARA's does not. A bill carries **its
  status as a chip**, overdue in the warning tone, and **open the document, mark
  paid and edit**; a purchase takes the document and the edit; a recurring cost
  the edit alone, having no receipt of its own.

  Each action is drawn only where its opener was supplied rather than drawn and
  left inert -- a button that does nothing reads as broken rather than absent --
  so a caller with nowhere to open a dialog still gets rows it can read.

- **A multi-line box in a dialog is now the size of the thing it is for.** It
  was a small square: a textarea at `width: 100%` is 100% of Obsidian's control
  column, which does not grow, so the box stayed square however tall it was
  told to be, and a long description squeezed it further by taking the rest of
  the row. The control now takes the room and the description is held to a
  column beside it. Affects the close-a-task comment and the day-note box.

- **The row actions in the PARA and Plan views are icons**: edit, archive and
  unarchive, move, and close with a comment. Four words beside every project and
  every task was more text than most of the projects and tasks, and the label
  does not disappear -- it becomes the tooltip and the accessible name, so a
  hover and a screen reader both still say what the button does. The Ledger and
  Dashboard keep words, because their actions appear once or twice in a view
  rather than on every row.

  Close-a-task is a speech bubble rather than a second tick: the checkbox beside
  it already means done, and two check marks on one row would ask somebody to
  work out which is which. Archive and unarchive are two icons rather than one
  that changes meaning.

  The area heading's own Edit is icon-only for the same reason: PARA draws one
  header per area, so the word appeared five or ten times down a screen whose
  rows had just stopped using it. A section that appears once in a view keeps
  its word, which is why that is a flag on `section()` rather than its new
  behaviour -- the Ledger's and the Dashboard's section actions are unchanged.

- **A task can be closed with a comment**, from a second action beside the
  checkbox in the plan view. Ticking stays exactly as fast as it was: most tasks
  close without anything worth saying, and a dialog in front of every one would
  tax the fifty that need nothing to serve the two that do. The dialog also
  chooses between done and cancelled, and offers any comment already there for
  editing rather than replacing it blind.

  The comment is written as indented lines under the task and the line itself is
  only ticked, so nothing else that reads that line is disturbed. Ticking and
  commenting are one read and one write, through the single writer every task
  edit in the plugin goes through.

- **A purchase can arrive in more than one box.** A sparse `deliveries:` list on
  the purchase note records each consignment: the day it came, the lines that
  were in it, and a tracking note. **Record a delivery** on the purchase editor
  offers what is still outstanding rather than what was ordered, every line
  ticked, because the common case by a distance is the last box.

  **The delivered / partly / ordered status is now derived and no longer
  written.** It is a fact about the lines and the consignments, and a written
  status can only disagree with them. `returned` and `cancelled` are decisions
  rather than observations and stay in the note, winning over anything the
  boxes say. **Nothing is migrated**: a purchase carrying no `deliveries:` is
  every purchase written before this existed, and its written status goes on
  being believed until the day a consignment is recorded against it.

  On the purchase rather than as notes of its own, which is the opposite of the
  answer CULItrail's meal deliveries give -- a supplier's box can settle two
  orders at once, and a parcel settles the order it was sent for. Six new
  property-name settings, all with rows on the Property keys page.

- **A project dashboard**, reached from the Life dashboard's toolbar or the
  palette. Every project as the same card the strips use, in the same status
  groups the PARA view folds, under four filters: area, goal, status and a search
  over the name. The other two project views answer "what am I working on" and
  "what is under this goal"; at a hundred projects a year neither answers "where
  is that project". The area filter resolves through the goals rather than
  reading the property, so a project filed the normal way is not silently
  dropped. Search is a substring rather than fuzzy, so `CN-97` finds nothing
  instead of finding `CN-1097838`. Filters, search and fold state reset when the
  view closes, and the archive is behind the same switch the PARA view has.

### Changed

- **`numberLocale` is now `displayLocale`, and covers dates as well as money.**
  The dates beside a figure went on following the machine, so one ledger could
  show `1'309.98` on a row and the date next to it in another country's order.
  It is trail-core's `DISPLAY_CONTRACT` now, shared with the other two plugins,
  and its default is **empty (follow the computer)** where this plugin used to
  ship `de-CH` on its own -- which is why APERtrail printed `4.298,00 CHF` in
  the same vault where this printed `4'298.00`. **A saved `numberLocale` is
  carried across on load**, so a vault that took the old Swiss default keeps it
  and nothing is redrawn without being asked.

- **The summary block moved into `trail-core`.** The format -- a `---` rule
  and a `> [!SUMMARY]+` callout as one span -- was written down twice, here and
  in APERtrail, and a note format belongs in the core whatever the number of
  readers. It is `markdown/summary-block.ts` there; `para/summary-file.ts`
  keeps the half that needs an `App`. Nothing about a note changes: the same
  block is read and written, byte for byte.
- **The dashboard strips wrap at six cards instead of scrolling sideways.** One
  scrolling row suited four areas and broke down at fifteen projects, where
  everything past the third was behind a gesture. Narrow panes drop to four
  columns and then to two rather than shrinking the cards past useful.
- **An area card says its priority as a word, like every other card.** It
  printed the raw number, so a dropdown offering `Hoch` produced a card saying
  `Priorität 2`. Left over from before priority had names rather than a reason
  for areas to read differently from the two strips beside them.
- **Goals and projects are ordered by priority, then deadline, then title**, and
  each card now shows the first two under its name. Saying nothing sorts after
  saying something, so an undated goal sits below one due on Friday. A card
  ordered by something it does not display looks shuffled, which is why the pair
  arrived together. A project card no longer falls back to naming its goals: the
  goal is one strip above it.

### Added

- **A picture a project falls back to.** A file in the projects folder's image
  subfolder named `Default` is shown for every project with none of its own, and
  a prefix in front of the word narrows it to a family: `CN-Default` is the
  picture for every project whose title starts with `CN-`, and the longest
  matching prefix wins. The work arrives in families, and fifteen company
  projects wanting one picture was fifteen notes to edit and a sixteenth to
  forget. **Nothing is written into a note**, so renaming the file re-points
  every project at once. The word is `projectDefaultImageName`, a setting;
  leaving it blank switches the convention off.

### Fixed

- **The test tree is type-checked**, by `npm run typecheck` and therefore by
  `build` and `check`. It found four fixtures describing shapes a note cannot
  be in: bills and recurring costs missing `account`, `paidFrom`, `lines` and
  `direction`; five still setting a `documentPath` renamed to `documentPaths`
  when a note could carry several; goals and projects missing the `closed` the
  eight PARA statuses added; postings missing the `entryLine` that says which
  entry they belong to. A day-entry draft was still passing `important: false`,
  which the four named priority levels replaced, and never passing a priority
  at all. None of them broke a test, which is the point.
- **A card tells a missing picture apart from no picture at all.** Both drew the
  same empty panel, so a note naming an attachment the vault could not find was
  indistinguishable from a note nobody had chosen a picture for, and the only way
  to tell was to run the health check. Reported from a real vault, where an
  attachment that had not finished syncing read as an empty project. A named
  picture that will not resolve, or that resolves and will not decode, now draws
  its own panel carrying the value the note holds. **A broken value does not fall
  back to the family default**, deliberately: that would hide the fault behind
  something that looks chosen.

### Added

- **A calendar file can be imported into the day notes.** A command and a
  button on the plan view open a preview: pick an `.ics`, pick a range, see
  every line with what would happen to it, press the button. Nothing is written
  until it is pressed. An export routinely holds a year of events, most of them
  already in the notes, and an import that wrote first and explained afterwards
  is one nobody runs a second time.

  **The line it writes is the line the capture dialog writes**, composed by
  `entryLines` from the same draft. That is not tidiness: re-importing
  recognises a meeting by its day, time and text rather than by a marker in the
  note, and that only works while an imported meeting and a typed one are the
  same thing.

  **The range is applied to occurrences, not to the series.** A standup whose
  `DTSTART` is two years old belongs in next week; testing the series' start
  would import nothing, and recurring meetings are most of a working week.

  **An occurrence that starts inside the range is imported whole**, so a
  holiday beginning on 28 September writes into October. The preview says which
  days it will touch rather than the range it was given, because the obvious
  mental model of a range is that nothing happens outside it.

  **The importer never removes a line.** It lists what an earlier export
  offered on a day in this range and no longer does, and says whether the line
  is still in the note; deleting is a person's job. An import that could delete
  is an import that owns the section, and it does not.

- **A meeting line can say what you answered.** An invitation carries your own
  `PARTSTAT`, and one real year of a working calendar reads 712 accepted, 486
  declined, 328 never answered and 45 tentative. Written with one marker they
  all look like meetings you are attending, and a day claiming you are in four
  rooms at once is a day nobody trusts.

  **This adds three marker values a schedule line may begin with**, which is a
  note format change in the sense this file means: a line reading
  `- 🚫 13:30-14:30 PTM incl. Change Board` is what a declined meeting looks
  like from now on. Declined meetings are still written, not filtered -- the
  hour is still booked by something, and a day without it reads as freer than
  it is -- and the week draws them struck through.

  The answer is read per occurrence rather than per series. A standing meeting
  is one `RRULE` and a scatter of `RECURRENCE-ID` overrides, and in the
  calendar this was built against one series reads `NEEDS-ACTION` as a series
  and `DECLINED` on twelve particular Thursdays.

- **`dayMeetingTentativeMarker`, `dayMeetingUnansweredMarker` and
  `dayMeetingDeclinedMarker`**, defaulting to ❓, ✉️ and 🚫. `dayMeetingMarker`
  covers accepted and covers a meeting written down by hand, because to a
  reader those are one thing: it is on, and you are going. Clearing one means
  "do not distinguish these", not "write these unmarked".

- **Whether you are attending is a field in the day-entry dialog.** Two reasons
  that are one: an entry composed without it comes back marked as accepted,
  stops reproducing its own line and goes read-only -- and the meeting you
  declined is exactly the one you later want to edit. And because the marker is
  deliberately not part of the derived key, an answer given after the import
  never reaches the note by importing again. Changing it is a person's job, and
  this is where they do it.

- **The imported file is kept, and it is the importer's whole memory.** Copied
  beside the day notes it fed and named for the range, exactly as
  `archiveStatement` keeps a bank statement. The alternative was a record of
  written keys in `data.json`, and it was the wrong answer: it would have been
  the first thing this plugin remembers rather than recomputes, in a plugin
  whose own archive refuses to. Replaying a file cannot drift from the notes it
  describes; a list can.

  What replay recovers is what an earlier export **offered**, not what the
  importer **wrote** -- a line already in the note was offered and skipped, and
  afterwards nothing tells them apart. A meeting that was in an old export, was
  also typed by hand, and has since gone from the calendar is therefore listed
  as gone. A meeting never in any export is in no archived file either, so it
  can never be reported as having disappeared from one, which is the guarantee
  that mattered.

### Changed

- **The week's columns stand the same height.** Every band gets the same number
  of rows on every day, and the number is that week's busiest day, capped at
  six. Not a constant, which would leave four blank rows under a quiet week's
  afternoons; not the busiest day uncapped, which would let one bad Thursday
  set the height of the screen. What does not fit is counted in a row of its
  own, so a band showing "+2 weitere" shows one fewer meeting -- the price of
  the columns agreeing, paid where it can be seen.

  The untimed meetings above the bands get the same treatment, and the summary
  footnote is drawn even when it says nothing: a day with no payments was
  otherwise a line shorter than the four beside it.

- **The day draws its meetings the way the week does**, in the same bands with
  the same markers. It went through the generic row kit, which strips a marker
  along with everything else it does not know about, so a declined meeting read
  in the day exactly like one you were going to -- in the view you look at
  before walking into a room. The two now share one renderer; only the space
  differs, since a day has no neighbouring columns to line up with.

- **A meeting clicked in the week or the month opens the editor** rather than
  the note. Seeing a meeting in the week is what makes somebody want to move or
  rename it, and sending them to another screen is sending them away from the
  thing they were looking at. The line's position is read at the click and
  never held: a week holds seven notes' worth of positions and a month
  thirty-one, and any of them can go stale while the view sits open. It
  declines, and opens the note, when the line cannot be told from another on
  the same day or says something the dialog has no field for.

- **The day view says whether it is today**, with the accent frame the week
  column and the month cell already carried, on all of its panels rather than
  one. Its two top panels are the same height, and the schedule heading is
  "Termine" rather than "Termine heute" -- that heading was written when the
  day view only ever showed today, and the date picker beside it has shown any
  day for some time.

### Fixed

- **A double space in a meeting's text made the entry read-only for ever.**
  `parseScheduleLine` collapses whitespace as it reads, so a line carrying two
  spaces could never compose back to itself, `reproduces` returned false, and
  both the day and the week refused to edit it. Reported as one meeting that
  opened the note instead of the dialog; the views were obeying the rule
  correctly and the line should never have been written.

  Fixed at both ends. Lines this plugin writes now collapse runs of spaces in
  the text a person or a file supplied -- never in a wikilink, where a note
  title may hold two spaces legitimately and rewriting one breaks the link. And
  `reproduces` compares a run of spaces *inside* a line as one, which is what
  reaches the lines already in a vault. Leading indentation says which meeting
  a child belongs to and two trailing spaces are a hard break; both are content
  and both are still refused.

## [0.1.0] - unreleased

The first version. Feature work stops here while the sibling plugin catches up;
what follows is fixes and the documentation that describes them. Not published
to Obsidian's community plugin directory; builds are distributed by
Technosoftware GmbH for internal and customer vault use.

### Added

- **PARA.** Area, Goal, Project and Resource notes, read and written where the
  vault already had them and defined where it did not. A goal's area and a
  project's goals are links, and a project's area is derived through its goals
  rather than written, so moving a goal re-files everything under it.
- **One status vocabulary of eight** for goals and projects: `backlog`,
  `planned`, `ongoing`, `blocked`, `done`, `review`, `closed`, `removed`.
  Everything new starts in the backlog. Setting a status fills the date it is the
  record of and shows it to be corrected rather than writing it silently, because
  the day of the action and the day of the record routinely differ.
- **Five dates on a goal or project**: created, deadline, done, closed and
  archived. Created is correctable while the note is being made, because a note
  is routinely written after the thing it records began.
- **A project is a folder**, named after it, holding its image and its documents,
  and archiving moves the folder whole. At a hundred projects a year a flat
  folder stops being browsable. An `image:` pointing inside a folder that moves
  is rewritten to follow it.
- **Archiving from the row**, into `6 Archive/<Category>/<Year>/`, with the
  archive sub-folder names as settings so a German vault archives into German
  folders. `type` does not change; the active lists stop showing a note because
  they read a different folder.
- **A summary block on every PARA note**: a `---` rule and a `> [!SUMMARY]+`
  callout, offered by all four creation forms and editable on three of them. It
  is the only body text a PARA dialog writes, and it writes the block's own lines
  and nothing else.
- **Images and priorities on areas, goals and projects.** An image picked from
  the vault is referenced; one picked from the machine is filed into the note's
  `_resources`. Priority is four named levels stored as the number that also
  orders them.
- **Plan.** Day, week, month, quarter and year notes, created on request and
  never on a schedule, with a rollup of everything that falls in the period.
  Nothing derived is written into the note.
- **Capture into a day without writing markdown.** *Add to day* writes a task, a
  meeting, a note or an idea under the right heading, links it to a project or
  area, and turns a meeting's follow-ups into task lines of their own. Headings
  are recognised in either language and written in the current one. An entry is
  dated with the note it is written into, and only on capture.
- **Editing and deleting a day entry**, but only one the dialog can reproduce
  exactly. A line saying more than the dialog can write back is left alone and
  says so, rather than being silently flattened.
- **Moving a task that did not get done** to another day or on to the next week,
  month, quarter or year. A day sets the plan, a period sets the deadline and
  clears the plan, which is what lets a deadline survive being replanned twice in
  one week.
- **Tasks.** Checkbox lines in the Obsidian Tasks format, read out of the
  configured folders and gathered into the views. Ticking one rewrites that one
  line and changes nothing else on it.
- **Finance.** Purchases, bills linked to the documents already in the vault,
  recurring costs projected forward and never written as bills, and budgets.
- **Invoices in both directions.** One note type carries a Kreditorenrechnung
  and a Debitorenrechnung; every difference between them is a value rather than a
  shape. `direction` is written only when it is `outgoing`, so every bill written
  before it existed keeps meaning what it always meant.
- **A person may be the other party on a money note**, not only a company, and a
  contact can say through its roles which pickers it belongs in.
- **A note can name more than one document.** An invoice with a reminder and a
  receipt behind it is common enough that one path per note would mean losing two
  of the three.
- **Documents filed beside their note**, in a folder named by a setting. One
  already in the vault is moved and its links follow; one from the computer is
  copied in. Nothing is ever overwritten.
- **A ledger.** Accounts with a derived tree, postings written as lines in a
  journal note per month, balances computed rather than stored, an income
  statement, a balance sheet, and report groups that fold to their totals.
- **One budget, keyed to accounts.** A line is an account, an amount and a
  rhythm; the twelve months are derived. It replaced the area and category budget
  rather than sitting beside it, because two budget systems would be two answers
  to the same question and only one of them counts what actually moved.
- **New account** and **New posting**, for the account you decide you need in
  March and for everything a bank statement never sees: a card invoice, a cash
  payment, a tax assessment, an opening debt. A split is a button away.
- **Bank statement import**, read against two real exports rather than a guess: a
  profile per format, the running balance used as proof that nothing was dropped,
  batched payment lines recognised as splits, a fee column that moves money on its
  own, and transfers resolved to the household's own other account through the
  IBAN on the account note. Assigning an account writes a rule, so the second
  month asks a fraction of what the first did.
- **The handover check.** Before writing anything, the import compares the
  balance the file starts from against what the ledger already says that account
  held the day before. It is the only check that can notice a month never imported
  at all, which no arithmetic inside one file can see.
- **The statement the import came from is kept**, beside the journal notes, and
  replayed so rows that were never posted stay visible.
- **Opening balances for every balance account in one pass**, with the date asked
  once.
- **Marking a bill paid** on a day you confirm rather than on today, writing the
  ledger posting as well as the date. A bill missing either account is not posted
  and says so.
- **The Life dashboard**, built from pictures: areas, goals and projects as
  strips, then what is due, what is owed and where the budget stands.
- **The CRM view**, in the plugin that owns the forms, over the People and
  Companies notes shared with the sibling plugins.
- **Two line editors**, for a purchase's `items` and a budget's `lines`. Those
  are the only two properties NODAtrail reopens a note for, because they are lists
  of maps and Obsidian's own property editor renders one as nested fields with no
  way to add, remove or reorder a row.
- **English and German**, detected from Obsidian's own language setting, with
  locale-seeded folder defaults that prefer a folder the vault already has.
- **Every vault-facing name is a setting**, behind a lock, so a vault that already
  uses other names renames nothing on disk.
- **Check the vault**, which asks the inverse question every reader asks: which
  notes in these folders are not what the folder says they should be. It also
  reports the money faults arithmetic can see, and fixes only a note's type and an
  old stamp shape, and only when asked.

### Still read, no longer written

Carried deliberately rather than left over. Each is covered by a test that fails
if support is dropped:

- **Four older status words.** `paused` reads as `blocked`, `completed` and
  `achieved` as `done`, `dropped` as `removed`. That is what let eight values
  arrive without rewriting anybody's notes.
- **Three older stamp shapes**, `'[[2026-07-14]]'`, `2026-07-25 - 04:50 pm` and a
  bare `2026-07-14`, alongside the one this plugin writes. A note converts the
  first time NODAtrail writes to it and never before.
- **The period-note navigation block.** It is no longer written; *Remove
  navigation block* takes an old one off a note that still has one. The 87 notes
  in the reference vault that carried one had it stripped, 423 lines removed and
  no line of anybody's own text touched.

### Removed before release

- **The document scan.** *Find bills without notes* scanned the vault for
  documents no note pointed at, together with a guesser that read a date, a vendor
  and a reference off a filename. It was the right tool while a backlog of PDFs
  was being filed by hand and the wrong shape once every document enters through
  the invoice form. Its `billDocumentFolders` setting went with it.
