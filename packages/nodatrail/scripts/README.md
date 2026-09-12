# Scripts

One-off tools, kept because they are worth running again rather than because
anything in the plugin calls them. Nothing here ships in `main.js`.

## Drafting bill notes from a folder of invoices

Two steps, deliberately separate: the first reads and reports, the second
writes. Looking at the report before writing anything is the point.

```
python3 scripts/extract-bills.py "/path/to/Vault/1 Areas/6 Finanzen/Rechnungen" 2026
python3 scripts/write-bills.py    "/path/to/Vault"
```

`extract-bills.py` runs `pdftotext` over every PDF in the folder, keeps the ones
whose date falls in the year given, and writes `~/work/bills.json` plus a
coverage summary. `write-bills.py` turns that into one bill note per invoice
under `Finance/Bills`.

### What it will and will not read

**An amount comes from one of two places, or from nowhere.** First the Swiss QR
payment part, whose layout is standardised and whose figure therefore means what
it says. Failing that, a line naming the invoice's own total (`Gesamtbetrag`,
`Rechnungsbetrag`, `Total zu Ihren Lasten`) **where every such line agrees**;
several different values means the phrase caught something else too, and then no
amount is the right answer.

Bare `Total` is deliberately not among them. An earlier version took the largest
figure on any line saying `Total` and a spot check against eight real documents
had it wrong four times: a credit card statement has a total per card and a
total of instalments, a telecom bill totals each category of call, and none of
those is what is owed.

**Nothing is guessed into a number.** Over the 182 invoices this was written
against, 106 of the 136 dated 2026 got an amount and 30 did not. A blank is a
field somebody fills in; a wrong figure is one they have to notice first.

### Re-running it

Safe. The titles are computed from the invoices alone rather than from what is
already in the folder, so a second run overwrites the same 136 notes rather than
writing a second set beside them. It also lists any note in the folder this run
did not want, so a rename in the source folder is visible rather than silent.

Pass `--force` to overwrite notes that already exist. Without it, existing notes
are left alone and only missing ones are written, which is what you want after
adding a few new invoices.

**It never sets `paidDate`.** Whether a bill has been paid is not something a
filename or a PDF reliably says, and a plugin that guessed would be guessing
about money.

## Refiling notes after a subfolder change

```
python3 scripts/refile-notes.py "/path/to/Vault"           # says what it would do
python3 scripts/refile-notes.py "/path/to/Vault" --apply   # does it
```

Moves existing bills, purchases, budgets and recurring costs into the
subfolders the settings now describe. Needed only after changing one of those
templates, and only for tidiness: every reader looks through the whole module
folder, so nothing is broken while notes sit in the old place.

It refuses to move a note onto an existing one and reports every such case, and
it never moves a note out of the module folder it found it in.
