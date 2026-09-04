"""
Draft a NODAtrail bill note per invoice.

Every field is either read from the document or left blank. Nothing is guessed
into a number: the amounts here come from a Swiss QR payment part or from a line
that names the invoice's own total and where the document agrees with itself,
and 30 of the 136 have no amount because neither was available. A blank is a
field somebody fills in; a wrong figure is one they have to notice first.

Refuses to overwrite. Run it twice and the second run writes nothing.
"""
import json, os, re, sys, datetime

VAULT = sys.argv[1]
DEST = os.path.join(VAULT, 'Finance', 'Bills')
bills = json.load(open(os.path.expanduser('~/work/bills.json')))

# Words that turned up as the "vendor" and are not one.
NOT_A_VENDOR = {'ihre', 'leistungsabrechnung', 'vesr', 'rechnung', 'kopie'}

# Only where the vendor says it plainly. Everything else stays blank rather than
# being filed under a category somebody then has to correct.
CATEGORY = {
    'musterversicherung': 'insurance',
    'swisscom': 'utilities', 'sunrise': 'utilities', 'wingo': 'utilities',
    'hostpoint': 'utilities',
    'digitec': 'household', 'galaxus': 'household', 'zooplus': 'household',
    'prowin': 'household',
    'coop': 'food',
    'strassenverkehrsamt': 'transport', 'aas': 'transport',
    'dhl': 'fees',
    'srk': 'gifts', 'parablegiker': 'gifts', 'vereinigelhilfe': 'gifts',
    'hev': 'housing', 'entsorgungsmarken': 'housing',
}

def clean_vendor(v):
    if not v: return None
    return None if v.lower() in NOT_A_VENDOR else v

def yaml_scalar(value):
    """Quoted only where YAML would otherwise read it as something else."""
    text = str(value)
    if re.fullmatch(r'[A-Za-zÀ-ÿ0-9 .&\'/+-]+', text) and not re.fullmatch(r'[\d.,-]+', text):
        return text
    return '"' + text.replace('"', '\\"') + '"'

def unique(title, taken):
    candidate, n = title, 2
    while candidate.lower() in taken:
        candidate, n = f'{title} ({n})', n + 1
    taken.add(candidate.lower())
    return candidate

os.makedirs(DEST, exist_ok=True)
# Deterministic: the title set comes from the bills alone, never from what is
# already on disk. Seeding it from the folder made a re-run rename every note to
# "... (2)" and write a second copy of all 136, which is the whole reason this
# comment exists.
taken = set()
now = datetime.datetime.now().strftime('%Y-%m-%dT%H:%M')

written, skipped, no_amount = 0, 0, 0
wanted = set()
for b in sorted(bills, key=lambda x: (x['issueDate'] or '', x['stem'])):
    vendor = clean_vendor(b['vendor'])
    stem = re.sub(r'[\\/:*?"<>|#^\[\]]', '-', b['stem'])[:60]
    title = unique(f"{b['issueDate']} {vendor}" if vendor else f"{b['issueDate']} {stem}", taken)

    path = os.path.join(DEST, title + '.md')
    wanted.add(title + '.md')
    if os.path.exists(path) and '--force' not in sys.argv:
        skipped += 1
        continue

    lines = ['---', 'type: bill']
    if vendor: lines.append(f'company: {yaml_scalar(vendor)}')
    lines.append('area: "[[Finanzen]]"')

    category = CATEGORY.get((vendor or '').lower())
    if category: lines.append(f'category: {category}')

    if b['amount'] is not None:
        lines.append(f"amount: {b['amount']:.2f}")
        lines.append(f"currency: {b['currency'] or 'CHF'}")
    else:
        no_amount += 1
        # Written empty rather than omitted: an empty property is a field the
        # property editor already shows, and this is a note somebody has to
        # finish.
        lines.append('amount:')
        lines.append('currency: CHF')

    lines.append(f"issueDate: {b['issueDate']}")
    lines.append(f"dueDate: {b['dueDate']}" if b['dueDate'] else 'dueDate:')
    lines.append('paidDate:')
    # A reference that is just the date the filename already carries is not a
    # reference. It came from the fallback that takes the longest digit run out
    # of a name, and on `20260103_parablegiker` the only digit run is the date.
    ref = b['reference']
    if ref and b['issueDate'] and re.sub(r'\D', '', ref) == b['issueDate'].replace('-', ''):
        ref = None
    if ref: lines.append(f"reference: {yaml_scalar(ref)}")
    lines.append(f'document: {yaml_scalar(b["path"])}')
    lines.append(f'created: "{now}"')
    lines.append('---')
    lines.append('')
    lines.append(f'![[{b["path"]}]]')
    lines.append('')

    open(path, 'w', encoding='utf-8').write('\n'.join(lines))
    written += 1

print(f'written        {written}')
print(f'already there  {skipped}')
print(f'without amount {no_amount}')

# Anything in the folder this run did not want. Reported rather than removed:
# this mount forbids unlink, and a script that deletes notes is not a script
# worth trusting anyway.
strays = sorted(f for f in os.listdir(DEST) if f.endswith('.md') and f not in wanted)
print(f'strays         {len(strays)}')
open(os.path.expanduser('~/work/strays.txt'), 'w').write('\n'.join(strays))
