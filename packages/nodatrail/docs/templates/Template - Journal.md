---
type: journal
---

# YYYY-MM

```noda-journal
```

One note per month, titled `YYYY-MM`, holding every posting for that month in
one block. Postings do not get a note each: a couple of thousand a year would
make every folder listing and the metadata cache useless for the sake of a note
holding one line.

The fence language is `noda-journal`, not `nod-`. It is the one block in this
plugin that does not take the plugin's prefix, because the parser is
`trail-core`'s and the name is the one it already knows.

A line is pipe separated: date, debit account number, credit account number,
amount with its currency, free text, and an optional reference to the bill or
purchase it settles.

```noda-journal
2026-08-04 | 4000 | 1005 | CHF 105.84 | TomTasty | 33698
```

A split is a header line plus indented legs, with the side the legs fill left
blank on the header. Here the credit is 2010 and each leg supplies its own
debit, and the legs must sum to the header:

```noda-journal
2026-08-11 |  | 2010 | CHF 881.25 | Cornercard | 2112644264
    4008 | 101.79 | Sollzinsen aus der vorhergehenden Rechnung
    4000 | 105.84 | TomTasty #32940
```

When the two accounts are kept in different currencies, write both figures. A
rate is written on the posting that used it or it is not known, because
inventing one later is inventing history:

```noda-journal
2026-07-11 | 1001 | 1005 | EUR 200.00 = CHF 189.60 | Bargeld Ferien
```

Numbers are read tolerantly: `1'234.50`, `1,234.50` and `1234,50` all mean the
same. Nothing in the parser throws, so one mistyped line is reported with its
line number and the rest of the month still reads.
