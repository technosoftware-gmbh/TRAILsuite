"""
Move existing money notes into the subfolders the settings now describe.

Only ever needed after changing a subfolder template, and only for notes that
already exist: every reader looks through the whole module folder, so nothing is
broken while notes sit in the old place. This is tidying, not a migration.

    python3 scripts/refile-notes.py /path/to/Vault [--apply]

Without --apply it prints what it would do and touches nothing.

It refuses to move a note onto an existing one, and it never crosses out of the
module folder it found the note in.
"""
import os, re, sys, json, shutil

VAULT = sys.argv[1]
APPLY = '--apply' in sys.argv
SETTINGS = json.load(open(os.path.join(VAULT, '.obsidian/plugins/nodatrail/data.json')))

# A data.json written before these settings existed carries none of them, and
# the plugin only merges the new defaults in the next time it loads. Falling
# back here means the script works before that has happened.
for key, default in [('billSubfolder', '{YYYY}/{MM}'), ('purchaseSubfolder', '{YYYY}/{MM}'),
                     ('budgetSubfolder', '{YYYY}'), ('recurringSubfolder', '{YYYY}')]:
    SETTINGS.setdefault(key, default)

KINDS = [
    ('bill',      'billsFolder',     'billSubfolder',      ['issueDate', 'dueDate']),
    ('purchase',  'purchasesFolder', 'purchaseSubfolder',  ['orderDate']),
    ('recurring', 'recurringFolder', 'recurringSubfolder', ['startDate']),
    ('budget',    'budgetsFolder',   'budgetSubfolder',    ['period']),
]

def frontmatter(path):
    text = open(path, encoding='utf-8').read()
    m = re.match(r'^---\n(.*?)\n---', text, re.S)
    if not m: return {}
    out = {}
    for line in m.group(1).split('\n'):
        g = re.match(r'^([A-Za-z0-9_]+): *(.*)$', line)
        if g: out[g.group(1)] = g.group(2).strip().strip('"\'')
    return out

def date_parts(value):
    """(year, month) from an ISO day, a YYYY-MM period, a quarter or a year."""
    if not value: return None
    m = re.match(r'^(\d{4})-(\d{2})-\d{2}', value)
    if m: return m.group(1), m.group(2)
    m = re.match(r'^(\d{4})-Q([1-4])$', value, re.I)
    if m: return m.group(1), f'{(int(m.group(2)) - 1) * 3 + 1:02d}'
    m = re.match(r'^(\d{4})-(\d{2})$', value)
    if m: return m.group(1), m.group(2)
    m = re.match(r'^(\d{4})$', value)
    if m: return m.group(1), '01'
    return None

def target_subfolder(template, parts):
    if not template.strip(): return ''
    if parts is None: return ''
    year, month = parts
    segments = []
    for segment in template.strip().split('/'):
        if not segment: continue
        segments.append(segment.replace('{YYYY}', year).replace('{MM}', month))
    return '/'.join(segments)

moves, blocked, already = [], [], 0
for kind, folder_key, sub_key, date_keys in KINDS:
    base = os.path.join(VAULT, SETTINGS[folder_key])
    if not os.path.isdir(base): continue

    for root, _dirs, files in os.walk(base):
        for name in files:
            if not name.endswith('.md'): continue
            path = os.path.join(root, name)
            fm = frontmatter(path)
            if fm.get(SETTINGS['typePropertyName']) != SETTINGS[f'{kind}TypeValue']: continue

            parts = next((date_parts(fm.get(k)) for k in date_keys if date_parts(fm.get(k))), None)
            target_dir = os.path.join(base, target_subfolder(SETTINGS[sub_key], parts))
            target = os.path.join(target_dir, name)

            if os.path.abspath(target) == os.path.abspath(path):
                already += 1
            elif os.path.exists(target):
                blocked.append((path, target))
            else:
                moves.append((path, target))

for path, target in moves:
    rel = lambda p: os.path.relpath(p, VAULT)
    print(('move  ' if APPLY else 'would move  ') + f'{rel(path)}  ->  {rel(target)}')
    if APPLY:
        os.makedirs(os.path.dirname(target), exist_ok=True)
        shutil.move(path, target)

print()
print(f'to move       {len(moves)}')
print(f'already right {already}')
print(f'blocked       {len(blocked)}  (a note already sits at the target)')
for path, target in blocked:
    print('   ', os.path.relpath(path, VAULT), '->', os.path.relpath(target, VAULT))
if not APPLY and moves:
    print('\nNothing was moved. Re-run with --apply.')
