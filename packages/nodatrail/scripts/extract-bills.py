"""
Read what an invoice PDF says, conservatively.

The rule throughout is the plugin's own: a wrong figure is worse than a missing
one. Every field here is either read from a place whose meaning is unambiguous,
or left null for a person to fill in.
"""
import subprocess, re, glob, json, os, sys

FOLDER = sys.argv[1]
YEAR = sys.argv[2] if len(sys.argv) > 2 else None

# A Swiss amount: 1'234.55, 1234.55, 1 234.55. Two decimals required, because a
# number without them is a quantity or a reference far more often than a price.
AMOUNT = r"(\d{1,3}(?:['’ ]\d{3})*[.,]\d{2}|\d+[.,]\d{2})"

def money(text):
    return float(text.replace("'", "").replace("’", "").replace(" ", "").replace(",", "."))

def iso(day, month, year):
    y = int(year)
    if y < 100:
        y += 2000
    d, m = int(day), int(month)
    if not (1 <= m <= 12 and 1 <= d <= 31):
        return None
    return f"{y:04d}-{m:02d}-{d:02d}"

def dates_in(text):
    """Every date in the shapes Swiss invoices use, in the order they appear."""
    found = []
    for m in re.finditer(r"\b(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})\b", text):
        got = iso(m.group(1), m.group(2), m.group(3))
        if got: found.append((m.start(), got))
    for m in re.finditer(r"\b(20\d{2})-(\d{2})-(\d{2})\b", text):
        found.append((m.start(), f"{m.group(1)}-{m.group(2)}-{m.group(3)}"))
    return found

def qr_amount(text):
    """
    The Swiss QR-bill payment part, with its currency.

    Its layout is standardised: a 'Waehrung Betrag' / 'Currency Amount' heading
    with the currency and the figure after it. That makes it the one place in an
    arbitrary invoice where a number's meaning is not a guess, and it is the
    reason this is tried first and trusted absolutely.
    """
    m = re.search(r"(?:W(?:ä|ae)hrung\s+Betrag|Currency\s+Amount)(.{0,120})", text,
                  re.I | re.S)
    if not m: return None, None
    got = re.search(r"\b([A-Z]{3})\s*" + AMOUNT, m.group(1))
    return (money(got.group(2)), got.group(1)) if got else (None, None)

# Words that name the invoice's own total rather than any total.
#
# Deliberately not bare "Total". A spot check against eight real documents had
# the largest-figure-on-a-Total-line rule wrong four times: a credit card
# statement has a total per card and a total of instalments, and a telecom bill
# totals each category of call. Each of those is a Total, and none of them is
# what is owed.
FINAL_TOTAL = r"(gesamtbetrag|rechnungsbetrag|total zu ihren lasten|zu zahlen|endbetrag|" \
              r"total betrag|zahlungsbetrag|invoice total|montant total)"

def labelled_amount(text):
    """
    The figure on a line that names the invoice's total, and only when the
    document agrees with itself.

    Several such lines are common and normal, because a summary repeats the
    figure. Several DIFFERENT values is not: it means the phrase caught
    something else too, and then no amount at all is the right answer.
    """
    values, currency = set(), None
    for line in text.split("\n"):
        low = line.lower()
        if not re.search(FINAL_TOTAL, low): continue
        if re.search(r"(zwischensumme|subtotal|exkl|ohne mwst|mwst-betrag|steuerl)", low):
            continue
        for got in re.finditer(AMOUNT, line):
            values.add(round(money(got.group(1)), 2))
        code = re.search(r"\b(CHF|EUR|USD)\b", line, re.I)
        if code and currency is None: currency = code.group(1).upper()

    if len(values) != 1: return None, None
    return values.pop(), currency

def due_date(text, issue):
    """A date that a phrase explicitly calls a deadline, and nothing else."""
    for m in re.finditer(r"(zahlbar bis|f(?:ä|ae)llig(?:keit)?(?:\s*am)?|zahlungsziel|"
                         r"(?:é|e)ch(?:é|e)ance|payable (?:jusqu|until|by))(.{0,60})",
                         text, re.I | re.S):
        found = dates_in(m.group(2))
        if found:
            candidate = found[0][1]
            if issue is None or candidate >= issue:
                return candidate
    return None

def reference(text, stem):
    m = re.search(r"Referenz(?:nummer)?\s*:?\s*([0-9 ]{10,40})", text, re.I)
    if m: return re.sub(r"\s+", "", m.group(1))
    m = re.search(r"Rechnungs-?\s?(?:nummer|nr\.?)\s*:?\s*([A-Z0-9\-/]{4,30})", text, re.I)
    if m: return m.group(1).strip()
    runs = re.findall(r"\d{6,}", stem)
    return max(runs, key=len) if runs else None

NOT_A_VENDOR = {"qr","rechnung","rechnungen","praemienrechnung","prämienrechnung","quittung",
                "gutschrift","mahnung","beleg","statement","invoice","receipt","scan","doc",
                "img","kopie","copy","bestellung","order"}

def vendor_from_stem(stem):
    for word in re.split(r"[_\-\s]+", stem):
        if re.fullmatch(r"[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9.&']{2,}", word) and word.lower() not in NOT_A_VENDOR:
            return word
    return None

def date_from_stem(stem):
    m = re.search(r"(?:^|[^0-9])(20\d{2})-(\d{2})-(\d{2})(?:[^0-9]|$)", stem)
    if m: return iso(m.group(3), m.group(2), m.group(1))
    m = re.search(r"(?:^|[^0-9])(20\d{2})(\d{2})(\d{2})(?:[^0-9]|$)", stem)
    if m: return iso(m.group(3), m.group(2), m.group(1))
    m = re.search(r"(?:^|[^0-9])(\d{2})(\d{2})(20\d{2})(?:[^0-9]|$)", stem)
    if m: return iso(m.group(1), m.group(2), m.group(3))
    return None

results = []
for path in sorted(glob.glob(os.path.join(FOLDER, "*.pdf")) + glob.glob(os.path.join(FOLDER, "*.PDF"))):
    stem = os.path.splitext(os.path.basename(path))[0]
    try:
        text = subprocess.run(["pdftotext", "-layout", path, "-"],
                              capture_output=True, timeout=25).stdout.decode("utf-8", "replace")
    except Exception:
        text = ""
    has_text = len(text.strip()) >= 200

    issue = date_from_stem(stem)
    if issue is None and has_text:
        # The earliest date on the page, which on an invoice is almost always
        # the invoice date. Only used when the filename says nothing.
        found = dates_in(text)
        issue = min((d for _, d in found), default=None)

    amount, currency, source = None, None, None
    if has_text:
        amount, currency = qr_amount(text)
        source = "qr" if amount is not None else None
        if amount is None:
            amount, currency = labelled_amount(text)
            source = "labelled" if amount is not None else None

    results.append({
        "path": path,
        "stem": stem,
        "hasText": has_text,
        "issueDate": issue,
        "dueDate": due_date(text, issue) if has_text else None,
        "amount": amount,
        "currency": currency,
        "amountSource": source,
        "reference": reference(text, stem) if has_text else (re.findall(r"\d{6,}", stem) or [None])[0],
        "vendor": vendor_from_stem(stem),
    })

if YEAR:
    results = [r for r in results if (r["issueDate"] or "").startswith(YEAR)]

# `~/work` is the handoff to write-bills.py rather than anything the vault sees.
# Created here because the README's two steps are one flow, and a first run that
# ends in a missing-directory traceback reads as the extraction having failed.
OUT = os.path.expanduser("~/work")
os.makedirs(OUT, exist_ok=True)
json.dump(results, open(os.path.join(OUT, "bills.json"), "w"), indent=1, ensure_ascii=False)

def pct(n): return f"{100*n//max(1,len(results)):3d}%"
print(f"documents: {len(results)}")
for label, key in [("issue date","issueDate"),("due date","dueDate"),
                   ("amount","amount"),("currency","currency"),
                   ("vendor","vendor"),("reference","reference")]:
    got = sum(1 for r in results if r[key])
    print(f"  {got:4d}  {pct(got)}  {label}")
print("  amount source:", {s: sum(1 for r in results if r['amountSource']==s) for s in ('qr','labelled')})
