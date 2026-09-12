# Templates

One per note type, for a vault that would rather start from a template than from
a form. Every property is the shipped default; rename any of them in the
settings and rename it here to match.

Drop these into your Templates folder and point Obsidian's own template plugin
at it. NODAtrail does not read this folder and does not know it exists.

- [Area](Template%20-%20Area.md)
- [Goal](Template%20-%20Goal.md)
- [Project](Template%20-%20Project.md)
- [Resource](Template%20-%20Resource.md)
- [Purchase](Template%20-%20Purchase.md)
- [Bill](Template%20-%20Bill.md)
- [Recurring cost](Template%20-%20Recurring.md)
- [Budget](Template%20-%20Budget.md)
- [Period note](Template%20-%20Period.md)
- [Account](Template%20-%20Account.md)
- [Journal](Template%20-%20Journal.md)

Every one of these opens with a `---` rule and a `> [!SUMMARY]+` callout where
the note type carries one, which is the shape the creation forms write. Delete
the block if you would rather not have one; nothing requires it.

A note created from a template gets no `created` stamp, because NODAtrail only
stamps notes it creates itself. That is deliberate: the plugin cannot know when
a hand-written note was started, and a wrong creation date is worse than none.
