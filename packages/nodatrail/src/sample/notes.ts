/**
 * The sample notes NODAtrail offers to write into an empty vault: twenty-three
 * notes covering PARA, a working week of day notes, the four money notes, a
 * small chart of accounts with a month of real postings, and the two shared CRM
 * people.
 *
 * Pure apart from the heading lookup named below. Hand it a settings object and
 * a clock and it answers the same way every time, which is what lets a test read
 * the whole set back through the real parsers without a vault in the way.
 *
 * ## Everything is relative to `now`
 *
 * Unlike its two sibling plugins, whose content is a named trip and a stocked
 * kitchen, nothing here is a fixed date. A plan view opened on a freshly seeded
 * vault shows this week, this month and this month's ledger, or it shows nothing
 * at all and the plugin looks broken on first sight. So the week is the ISO week
 * `now` falls in, the month note is `now`'s month, and every posting is dated
 * inside that month.
 *
 * The dates count **backwards** from `now` and stop at the first of the month
 * (`inMonth` below). A vault seeded on the second of the month gets a ledger
 * whose postings crowd onto two days, which is honest; one seeded with postings
 * spread over a month it is three days into would be a ledger holding the
 * future.
 *
 * ## What it reaches for rather than restates
 *
 * `entryLines` composes every day-note line, `linesFor` and `formatPosting`
 * every journal line, `seedChart` supplies the accounts, and the four money
 * builders build the money frontmatter. A sample vault whose notes were built by
 * a parallel implementation would stop demonstrating the real one the first time
 * the two drifted, and the failure is invisible: a line the composer would not
 * have written is a line the reader silently skips.
 *
 * **The one impurity is `headingsFor`, and it is deliberate.** A day note's
 * headings are translated defaults rather than literals -- blank means "the
 * heading this vault's language calls it" -- so a sample note that spelled
 * `## Schedule` itself would be a note `read-schedule.ts` could not find in a
 * German vault. The heading follows the vault's language; every word of content
 * below it is English.
 *
 * ## The two wikilinks that are meant to dangle
 *
 * `[[Tom Yum Gai]]` is a note CULItrail seeds and `[[Rovos Rail 2026]]` one
 * APERtrail seeds. Seeded alone they resolve to nothing; seeded into a vault
 * that also holds a sibling's sample they resolve, and a meal turns up in a day
 * and a trip's money turns up in the ledger with no plugin having called
 * another. Those two titles are the whole of the exception -- every other
 * wikilink in this set names a note this set writes, and
 * `tests/sample-vault.test.ts` asserts the exception by name rather than
 * exempting whatever fails to resolve.
 */
import {
  addDays,
  endOfPeriod,
  formatDayTitle,
  startOfDay,
  startOfPeriod,
  summaryBody,
  type Posting,
  type SampleNote,
} from '@technosoftware/trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { folderFor } from '../vault/entity-types';
import { newProjectFolder } from '../para/project-folder';
import {
  buildAreaFrontmatter,
  buildGoalFrontmatter,
  buildProjectFrontmatter,
  buildResourceFrontmatter,
} from '../para/write';
import {
  commonProperties,
  goalProperties,
  projectProperties,
  resourceProperties,
  typeProperties,
} from '../para/properties';
import { EMPTY_COMMON } from '../para/create';
import {
  buildBillFrontmatter,
  buildAccountBudgetFrontmatter,
  buildPurchaseFrontmatter,
  buildRecurringFrontmatter,
} from '@technosoftware/trail-core';
import {
  billProperties,
  budgetProperties,
  purchaseProperties,
  recurringProperties,
} from '../finance/properties';
import { noteFolderFor as moneyFolderFor } from '../finance/paths';
import { derivedNoteTitle } from '../finance/finance-title';
import { noteFolderFor as periodFolderFor, noteTitleFor } from '../plan/paths';
import { typeValueFor as periodTypeValueFor } from '../plan/paths';
import { emptyDraft, entryLines, headingsFor, type DayEntryDraft } from '../plan/add-to-day';
import { appendUnderHeading } from '../plan/day-body';
import { seedChart, type SeededAccount } from '../finance/default-chart';
import { accountFrontmatter, accountNoteTitle, journalTitleFor } from '../ledger/write-ledger';
import { emptyJournalBody, insertPostingBlock } from '../ledger/journal-text';
import { linesFor } from '../ledger/import-write';
import { NOD_SPENDING_BLOCK_LANG } from '../crm/spending-block-lang';

/** The two people every plugin in the suite seeds, spelled identically in all three. */
const STEFAN = 'Stefan';
const ERIKA = 'Erika';

/** The one area. Everything else in the set files under it, directly or through the goal. */
const AREA = 'Household';
const GOAL = 'Close the books every month';
const PROJECT = 'Move the household to double entry';
const RESOURCE = 'Double entry in one page';

/**
 * The two titles this set links and does not write.
 *
 * Exported so the test names them rather than deriving them from whatever
 * happens to fail, which would make the test pass for a link that dangles by
 * mistake as readily as for these two.
 */
export const FOREIGN_TITLES = ['Tom Yum Gai', 'Rovos Rail 2026'] as const;

/**
 * The six accounts this set uses, by number.
 *
 * Numbers rather than descriptions, and taken out of `DEFAULT_CHART` rather than
 * written here, so the existing `Seed chart of accounts` command run afterwards
 * skips exactly these six and adds the other eighty-one. The two seeds are
 * idempotent against each other by construction rather than by agreement.
 *
 * `BANK` is Stefan's own account rather than the shared household one, for one
 * reason: it is the only account among these that the chart marks as somebody's,
 * so its note carries `person: [[Stefan]]` and the ledger reaches the CRM the
 * way the data model says it does. A shared account states no person, and the
 * link would then have nowhere to come from.
 */
const BANK = 1011;
const CARD = 2010;
const SALARY = 3010;
const ELECTRICITY = 4001;
const INSURANCE = 4005;
const TRAVEL = 4007;
const SAMPLE_ACCOUNTS = [BANK, CARD, SALARY, ELECTRICITY, INSURANCE, TRAVEL] as const;

/** A wikilink, spelled the one way every reference in these notes is spelled. */
function link(title: string): string {
  return `[[${title}]]`;
}

/** A fenced block with nothing in it, which is how every block this plugin seeds starts life. */
function fence(language: string): string {
  return `\`\`\`${language}\n\`\`\``;
}

/**
 * A day inside `now`'s month, counted back from `now` and floored at the first.
 *
 * Everything financial is dated with this. Counting back keeps the ledger out of
 * the future; the floor keeps it inside the month the budget measures, which is
 * the month a freshly seeded vault opens on. On the first of a month every one
 * of them lands on the same day, which is a real thing a ledger holds and not
 * worth an exception.
 */
function inMonth(now: Date, daysBack: number): Date {
  const first = startOfPeriod('month', now);
  const back = addDays(startOfDay(now), -daysBack);
  return back.getTime() < first.getTime() ? first : back;
}

/** The same as an ISO day, which is what a money note states. */
function dayIn(now: Date, daysBack: number): string {
  return formatDayTitle(inMonth(now, daysBack));
}

export function sampleNotes(settings: NODAtrailSettings, now: Date): SampleNote[] {
  return [
    ...para(settings),
    ...week(settings, now),
    monthNote(settings, now),
    ...money(settings, now),
    ...accounts(settings),
    journal(settings, now),
    ...crm(settings),
  ];
}

// PARA ---------------------------------------------------------------------

/**
 * One of each kind, linked the way the data model says they link: a goal names
 * its area, a project names its goals, a resource names its area.
 *
 * **The project states no `area:`.** It derives one through its goal, which is
 * the rule the data model is most emphatic about -- moving the goal to another
 * area re-files the project without touching the project note -- and stating it
 * here would seed the one thing the model calls two sources of truth. The
 * override exists for a project that serves no goal, and this one serves one.
 */
function para(settings: NODAtrailSettings): SampleNote[] {
  const common = commonProperties(settings);

  const area: SampleNote = {
    folder: folderFor(settings, 'area'),
    title: AREA,
    typeValue: settings.areaTypeValue,
    properties: stripType(
      settings,
      buildAreaFrontmatter(typeProperties(settings, settings.areaTypeValue), common, {
        ...EMPTY_COMMON,
        priority: 1,
      })
    ),
    body: `${summaryBody(
      'What the two of us keep running: the flat, the money, the paperwork. ' +
        'A standard to be maintained rather than something that finishes, which is ' +
        'why it has a priority and no status.'
    )}\n\n${fence('nod-projects')}\n`,
  };

  const goal: SampleNote = {
    folder: folderFor(settings, 'goal'),
    title: GOAL,
    typeValue: settings.goalTypeValue,
    properties: stripType(
      settings,
      buildGoalFrontmatter(
        typeProperties(settings, settings.goalTypeValue),
        goalProperties(settings),
        {
          ...EMPTY_COMMON,
          priority: 2,
          areaTitle: AREA,
          status: 'ongoing',
          // Left out on purpose. A deadline is a day somebody chose, and a
          // sample vault that invented one would be inviting the first thing
          // anybody does with this note to be deleting a date.
          deadline: null,
          achieved: null,
          closed: null,
        }
      )
    ),
    body: `${summaryBody(
      'Every month closed within a week of it ending, with the bank statement and the ' +
        'journal agreeing to the franc.'
    )}\n\n${fence('nod-projects')}\n`,
  };

  const project: SampleNote = {
    // A folder of its own, named after the project, unless the vault has turned
    // `projectFolderPerNote` off -- in which case `newProjectFolder` hands back
    // the projects folder itself and the note lands there flat.
    folder: newProjectFolder(settings, PROJECT),
    title: PROJECT,
    typeValue: settings.projectTypeValue,
    properties: stripType(
      settings,
      buildProjectFrontmatter(
        typeProperties(settings, settings.projectTypeValue),
        projectProperties(settings),
        {
          ...EMPTY_COMMON,
          priority: 2,
          goalTitles: [GOAL],
          areaTitle: null,
          status: 'ongoing',
          deadline: null,
          completed: null,
          closed: null,
        }
      )
    ),
    body: `${summaryBody(
      'Chart of accounts, opening balances, and the first month posted by hand so that ' +
        'the shape of a posting is learned before anything is imported.'
    )}\n\n${fence('nod-tasks')}\n`,
  };

  const resource: SampleNote = {
    folder: folderFor(settings, 'resource'),
    title: RESOURCE,
    typeValue: settings.resourceTypeValue,
    properties: stripType(
      settings,
      buildResourceFrontmatter(
        typeProperties(settings, settings.resourceTypeValue),
        resourceProperties(settings),
        {
          ...EMPTY_COMMON,
          areaTitle: AREA,
          topic: 'Bookkeeping',
          source: 'https://double-entry.example/one-page',
          tags: ['finance', 'reference'],
        }
      )
    ),
    body:
      `${summaryBody('The whole of double entry that a household actually needs.')}\n\n` +
      'Every movement of money touches two accounts: one is debited and the other credited, ' +
      'by the same amount, on the same day.\n\n' +
      'Assets and expenses increase on the debit side. Liabilities and income increase on the ' +
      'credit side. There is no fifth thing a household account can be, and equity is what is ' +
      'left over rather than something to maintain.\n\n' +
      'A balance is the sum of the postings that touch an account. Nothing stores one.\n',
  };

  return [area, goal, project, resource];
}

/**
 * The type property is `frontmatterObject`'s to place, not a builder's to
 * repeat. Same reason `para/create.ts` and `finance/write-finance.ts` each strip
 * it: handed through twice it would sit before the created stamp and again
 * after it, and the second one would win.
 */
function stripType(
  settings: NODAtrailSettings,
  frontmatter: Record<string, unknown>
): Record<string, unknown> {
  const { [settings.typePropertyName]: _type, ...rest } = frontmatter;
  return rest;
}

// The plan -----------------------------------------------------------------

/**
 * A day note, built the way the capture dialog builds one.
 *
 * Through `entryLines` and `appendUnderHeading` rather than by writing markdown,
 * because a line the composer would not have written is a line the reader
 * silently skips: a meeting whose marker is off by a variation selector, or a
 * task whose date marker is in the wrong place, renders as an ordinary bullet
 * and disappears from every view. Composing it is the only way to know it reads
 * back.
 *
 * **The frontmatter is nothing but the type and the stamp**, which is what
 * `write-period.ts` writes. Headings arrive with the entries that need them.
 */
function dayNote(settings: NODAtrailSettings, date: Date, drafts: DayEntryDraft[]): SampleNote {
  const day = formatDayTitle(date);

  let body = '';
  for (const draft of drafts) {
    body = appendUnderHeading(
      body,
      headingsFor(settings, draft.kind),
      entryLines(settings, draft, day)
    );
  }

  return {
    folder: periodFolderFor(settings, 'day', date),
    title: noteTitleFor(settings, 'day', date),
    typeValue: periodTypeValueFor(settings, 'day'),
    properties: {},
    body,
  };
}

/** A meeting draft, which is the only entry kind with a marker worth demonstrating. */
function meeting(fields: Partial<DayEntryDraft>): DayEntryDraft {
  return { ...emptyDraft('meeting'), ...fields };
}

/**
 * Monday to Friday of the ISO week `now` falls in.
 *
 * A working week rather than seven days: the two that carry nothing would be two
 * notes seeded empty, and a day nobody opened has no note at all.
 *
 * **All four attendance markers appear**, one per meeting, because the four are
 * settings and this is the only place a new user ever sees what they look like
 * before deciding to change one. `markerFor` picks each from the settings, so a
 * vault that has already changed one gets its own.
 */
function week(settings: NODAtrailSettings, now: Date): SampleNote[] {
  const monday = startOfPeriod('week', now);
  const friday = addDays(monday, 4);

  return [
    dayNote(settings, monday, [
      meeting({
        text: 'Week kickoff, the two of us at the kitchen table',
        startTime: '08:30',
        endTime: '09:00',
        context: AREA,
        attendance: '',
        notes: 'The electricity bill is in and is not due until later this month.',
        followUps: [
          { text: 'Open the year budget and check the travel line', context: PROJECT, due: '' },
        ],
      }),
      {
        ...emptyDraft('task'),
        text: 'Post the salary and the card payment by hand',
        context: PROJECT,
        priority: 'high',
        due: formatDayTitle(friday),
      },
      {
        ...emptyDraft('idea'),
        text: 'A standing five minutes on Friday would close the month on its own',
      },
    ]),

    dayNote(settings, addDays(monday, 1), [
      meeting({
        // Tentative: an hour somebody has asked for and nobody has answered
        // properly. It stays in the day, because the hour is gone either way.
        text: 'Call with the accountant about the opening balances',
        startTime: '11:00',
        endTime: '12:00',
        attendance: 'tentative',
        context: PROJECT,
      }),
      {
        ...emptyDraft('note'),
        text: 'The bank exports statements as CSV going back two years.',
      },
    ]),

    dayNote(settings, addDays(monday, 2), [
      meeting({
        // Unanswered: in the calendar, never replied to. The marker says so
        // rather than the meeting being dropped, which would make the day read
        // as freer than it is.
        text: 'Building committee, annual accounts',
        startTime: '19:30',
        endTime: '21:00',
        attendance: 'unanswered',
      }),
      meeting({
        // ------ The CULItrail crossing. ------
        // A meal note this plugin does not write and will never read. Seeded
        // alone the link dangles, which is expected and is the demonstration:
        // seed CULItrail into the same vault and the evening resolves, with
        // neither plugin having called the other.
        text: 'Dinner at home',
        startTime: '19:00',
        endTime: '20:00',
        context: 'Tom Yum Gai',
      }),
    ]),

    dayNote(settings, addDays(monday, 3), [
      meeting({
        // Declined, and still written down. See docs/design/calendar-import.md:
        // a meeting you declined is still the reason nothing else is in that
        // slot.
        text: 'Supplier webinar, new invoicing portal',
        startTime: '16:00',
        endTime: '17:00',
        attendance: 'declined',
      }),
      {
        ...emptyDraft('task'),
        text: 'Scan the electricity bill into the finance folder',
        context: AREA,
        priority: null,
        due: null,
      },
    ]),

    dayNote(settings, friday, [
      meeting({
        text: 'Weekly review',
        startTime: '17:00',
        endTime: '17:30',
        context: PROJECT,
        attendance: '',
        notes: 'Journal balances against the statement.\nThe travel line is the one over budget.',
        followUps: [
          { text: 'Reconcile the card account', context: PROJECT, due: '' },
          { text: 'Write next month into the budget note', context: PROJECT, due: '' },
        ],
      }),
      {
        ...emptyDraft('note'),
        text: 'First month closed without a spreadsheet open anywhere.',
      },
    ]),
  ];
}

/**
 * The month note.
 *
 * One task on it, dated the last day of the month, which is exactly what
 * capturing at month level produces: name no day and the entry goes into the
 * period's own note, dated with that period's last day. Without it the note is
 * frontmatter and a blank page, which is what the plugin writes and is also what
 * a sample vault has nothing to show for.
 */
function monthNote(settings: NODAtrailSettings, now: Date): SampleNote {
  const first = startOfPeriod('month', now);
  const last = endOfPeriod('month', now);

  const body = appendUnderHeading(
    '',
    headingsFor(settings, 'task'),
    entryLines(
      settings,
      {
        ...emptyDraft('task'),
        text: 'Close the month: statement against journal, then the budget page',
        context: GOAL,
      },
      formatDayTitle(last)
    )
  );

  return {
    folder: periodFolderFor(settings, 'month', first),
    title: noteTitleFor(settings, 'month', first),
    typeValue: periodTypeValueFor(settings, 'month'),
    properties: {},
    body,
  };
}

// Money --------------------------------------------------------------------

/**
 * The four money notes.
 *
 * **None of them names a company**, and that is a decision rather than an
 * omission. A counterparty would have to be a note this set writes, and writing
 * one into `CRM/Companies` would make that folder one of this plan's target
 * folders -- which would refuse the whole run in any vault where a sibling
 * plugin had already seeded its own company there, and would make a sibling
 * refuse in a vault seeded by this one. Leaving companies out is what lets all
 * three be seeded into one vault in any order. A vendor that is not a note is
 * also the ordinary case: most of them never become one.
 *
 * **The bill is open**, so the outstanding list and the `nod-bills` block have
 * something to draw, and it therefore has no posting behind it: an invoice
 * reaches the ledger only when it is settled, and a posting for an unpaid bill
 * would be the same money claimed twice.
 */
function money(settings: NODAtrailSettings, now: Date): SampleNote[] {
  const year = String(now.getFullYear());

  const purchaseDate = dayIn(now, 10);
  const purchaseTitle = derivedNoteTitle({
    date: purchaseDate,
    company: '',
    reference: 'TS-88214',
  });

  const purchase: SampleNote = {
    folder: moneyFolderFor(settings, 'purchase', inMonth(now, 10)),
    title: purchaseTitle,
    typeValue: settings.purchaseTypeValue,
    properties: stripType(
      settings,
      buildPurchaseFrontmatter(purchaseProperties(settings), {
        reference: 'TS-88214',
        companyTitle: null,
        areaTitle: AREA,
        projectTitle: null,
        category: 'leisure',
        status: 'delivered',
        date: purchaseDate,
        deliveryDate: dayIn(now, 6),
        // The stated total wins over the computed one, always. These two agree,
        // because a sample vault whose health check reports a finding on the
        // first run is a sample vault that teaches the wrong lesson.
        amount: 189,
        currency: settings.homeCurrency,
        discount: null,
        shipping: null,
        vatRate: null,
        vatAmount: null,
        items: [
          { name: 'Camera bag', price: 129, quantity: 1, discount: null, note: null },
          { name: 'Memory card, 128 GB', price: 30, quantity: 2, discount: null, note: null },
        ],
        deliveries: [],
        documentPaths: [],
        billTitle: null,
      })
    ),
    body: '',
  };

  const issueDate = dayIn(now, 6);
  const billTitle = derivedNoteTitle({
    date: issueDate,
    company: '',
    reference: 'EL-2026-0834',
  });

  const bill: SampleNote = {
    folder: moneyFolderFor(settings, 'bill', inMonth(now, 6)),
    title: billTitle,
    typeValue: settings.billTypeValue,
    properties: stripType(
      settings,
      buildBillFrontmatter(billProperties(settings), {
        companyTitle: null,
        areaTitle: AREA,
        category: 'utilities',
        amount: 128.45,
        currency: settings.homeCurrency,
        issueDate,
        // Nine days out from today rather than a day of the month, so the bill
        // is always ahead of whoever seeded the vault and always reads as due
        // rather than as overdue on the first render.
        dueDate: formatDayTitle(addDays(startOfDay(now), 9)),
        // Unpaid, which is what makes it visible at all: `nod-bills` lists what
        // is outstanding and nothing else.
        paidDate: null,
        reference: 'EL-2026-0834',
        documentPaths: [],
        direction: 'incoming',
        recurringTitle: null,
        purchaseTitle: null,
        account: ELECTRICITY,
        lines: [],
        paidFrom: null,
        // Derived from the dates, never stored, except for `cancelled` -- which
        // this is not.
        statedStatus: null,
      })
    ),
    body: '',
  };

  const recurringStart = dayIn(now, 14);
  const recurringTitle = derivedNoteTitle({
    date: recurringStart,
    company: '',
    reference: 'POL-4471',
  });

  const recurring: SampleNote = {
    folder: moneyFolderFor(settings, 'recurring', inMonth(now, 14)),
    title: recurringTitle,
    typeValue: settings.recurringTypeValue,
    properties: stripType(
      settings,
      buildRecurringFrontmatter(recurringProperties(settings), {
        companyTitle: null,
        areaTitle: AREA,
        category: 'insurance',
        amount: 320,
        currency: settings.homeCurrency,
        cadence: 'annual',
        interval: 1,
        startDate: recurringStart,
        endDate: null,
        status: 'active',
        documentPaths: [],
        reference: 'POL-4471',
        account: INSURANCE,
      })
    ),
    body: '',
  };

  const budget: SampleNote = {
    folder: moneyFolderFor(settings, 'budget', startOfPeriod('year', now)),
    title: year,
    typeValue: settings.budgetTypeValue,
    properties: stripType(
      settings,
      buildAccountBudgetFrontmatter(budgetProperties(settings), {
        // A bare year and nothing else. `2026-08` is refused as a period.
        period: year,
        currency: settings.homeCurrency,
        lines: [
          {
            account: ELECTRICITY,
            amount: 130,
            rhythm: 'monthly',
            startMonth: null,
            note: 'Twelve equal instalments, trued up in the spring',
            overrides: {},
          },
          {
            // Once a year, in the month the seed lands in, so the budget page
            // has a planned figure against the month somebody is looking at
            // rather than against one they will reach in March.
            account: INSURANCE,
            amount: 320,
            rhythm: 'annual',
            startMonth: now.getMonth() + 1,
            note: '',
            overrides: {},
          },
          {
            account: TRAVEL,
            amount: 1500,
            rhythm: 'annual',
            startMonth: now.getMonth() + 1,
            note: 'One trip a year, saved for over the whole of it',
            overrides: {},
          },
        ],
      })
    ),
    body: '',
  };

  return [purchase, bill, recurring, budget];
}

// The ledger ---------------------------------------------------------------

/**
 * Six accounts out of the shipped chart.
 *
 * **`seedChartOfAccounts` is deliberately not called from here**, and the reason
 * is worth stating because calling it looks like the tidier answer. The shipped
 * chart is eighty-seven notes: written by a command whose whole promise is a
 * preview of what it will write, they would bury the twenty-three that are the
 * sample, and they would arrive through a second idempotency rule -- that seed
 * skips an account whose *number* is taken, while the sample planner skips a
 * note whose *title* is taken -- inside one command. Worse, it writes outside
 * the plan, and `writeSampleVault` refuses before it writes anything precisely
 * so that a refusal leaves the vault untouched.
 *
 * So the chart is not duplicated either: these six come out of `seedChart` by
 * number, with their kinds, groups, titles and currencies as the real chart
 * states them. Running `Seed chart of accounts` afterwards skips exactly these
 * six and writes the other eighty-one, which is the adoption path a sample vault
 * should leave open.
 *
 * The chart is asked for in English because the sample content is English. Its
 * folder, its property names and its home currency are still the vault's.
 */
function accounts(settings: NODAtrailSettings): SampleNote[] {
  const chart = seedChart('en', {
    homeCurrency: settings.homeCurrency,
    personOne: STEFAN,
    personTwo: ERIKA,
  });
  const byNumber = new Map<number, SeededAccount>(chart.map((entry) => [entry.number, entry]));

  const notes: SampleNote[] = [];
  for (const number of SAMPLE_ACCOUNTS) {
    const account = byNumber.get(number);
    // Unreachable while the six numbers are in the chart, and silent rather
    // than thrown if one is ever removed from it: a sample vault short one
    // account is a report about a posting naming an unknown number, which is
    // the health check's job to make, not this function's to crash over.
    if (!account) continue;

    notes.push({
      folder: settings.accountsFolder,
      title: accountNoteTitle(account),
      typeValue: settings.accountTypeValue,
      properties: accountFrontmatter(settings, account),
      body: '',
    });
  }

  return notes;
}

/** One posting, with the fields a parsed one carries that a written one does not. */
function posting(fields: Partial<Posting> & Pick<Posting, 'date' | 'amount' | 'text'>): Posting {
  return {
    debit: null,
    credit: null,
    currency: null,
    reference: null,
    counterAmount: null,
    counterCurrency: null,
    // Line numbers belong to a posting that was read out of a note. These are
    // going in, and `formatPosting` never looks at them.
    line: 0,
    entryLine: 0,
    splitOf: null,
    importKey: null,
    ...fields,
  };
}

/**
 * One journal note for `now`'s month, with a month of postings in it.
 *
 * Five entries, six postings once the split is expanded, and they cover the
 * shapes the ledger has: a plain expense, income, a debt raised on a card and
 * paid off again, and a split whose legs supply the debits the header leaves
 * blank. Every one of them names an account this set also writes.
 *
 * **The two that link `[[Rovos Rail 2026]]`** are the APERtrail crossing: a
 * trip's money reaching the double-entry ledger through notes on disk and
 * nothing else. The link rides in a posting's free text, which is why the text
 * must never carry a bar -- `formatPosting` replaces one if it does, because a
 * bar would shift every field after it.
 *
 * Composed through `linesFor` and `insertPostingBlock`, the same two the
 * statement import writes through, so the block is in date order and the legs of
 * a split arrive with their header rather than around somebody else's.
 */
function journal(settings: NODAtrailSettings, now: Date): SampleNote {
  const month = startOfPeriod('month', now);
  const title = journalTitleFor(month);
  const currency = settings.homeCurrency;

  const purchaseReference = derivedNoteTitle({
    date: dayIn(now, 10),
    company: '',
    reference: 'TS-88214',
  });

  const entries = [
    {
      posting: posting({
        date: dayIn(now, 14),
        // The debit side is left blank and the legs fill it, which is the form
        // the parser reads a split back out of.
        credit: BANK,
        amount: 1560,
        currency,
        text: `Travel agent, ${link('Rovos Rail 2026')}`,
      }),
      legs: [
        { account: TRAVEL, amount: 1240, text: 'Deposit' },
        { account: INSURANCE, amount: 320, text: 'Travel insurance for the trip' },
      ],
    },
    {
      posting: posting({
        date: dayIn(now, 10),
        debit: TRAVEL,
        credit: CARD,
        amount: 189,
        currency,
        text: `Camera bag and cards for ${link('Rovos Rail 2026')}`,
        // The purchase note this settles, by title. The sixth column.
        reference: purchaseReference,
      }),
      legs: [],
    },
    {
      posting: posting({
        date: dayIn(now, 6),
        debit: ELECTRICITY,
        credit: BANK,
        amount: 128.45,
        currency,
        // Last month's electricity, paid this month. Deliberately not the bill
        // note in this set, which is still open: an invoice reaches the ledger
        // when it is settled and not before.
        text: 'Electricity and gas, previous month',
      }),
      legs: [],
    },
    {
      posting: posting({
        date: dayIn(now, 3),
        debit: BANK,
        credit: SALARY,
        amount: 7412,
        currency,
        text: 'Salary',
      }),
      legs: [],
    },
    {
      posting: posting({
        date: dayIn(now, 1),
        debit: CARD,
        credit: BANK,
        amount: 189,
        currency,
        text: 'Credit card settled',
      }),
      legs: [],
    },
  ];

  let body = emptyJournalBody(title);
  for (const entry of entries) body = insertPostingBlock(body, linesFor(entry));

  return {
    folder: moneyFolderFor(settings, 'journal', month),
    title,
    typeValue: settings.journalTypeValue,
    // The note carries nothing beyond the shared header. Everything is in the
    // block.
    properties: {},
    body,
  };
}

// The shared CRM notes -----------------------------------------------------

/**
 * The two people, on the terms all three plugins agree.
 *
 * These are notes NODAtrail reads rather than owns: APERtrail and CULItrail
 * match the same folder on the same `type:` value, so a vault seeded by two of
 * them ends up with one Stefan answering to both. That is what `ensureBlock` is
 * for -- whichever plugin runs second finds the note there, skips it, and
 * appends only the fence it owns the constant for.
 *
 * **No company note**, for the reason `money()` gives: none of these notes needs
 * one. NODAtrail's money notes name no counterparty, so there is nothing for a
 * Company note to be, and a folder this plan has no business in is a folder it
 * does not claim.
 *
 * `email` is a literal here because NODAtrail has no setting for it, which is
 * the one case the shared contract allows a literal. Both other plugins write
 * the same key.
 */
function crm(settings: NODAtrailSettings): SampleNote[] {
  const person = (title: string, email: string): SampleNote => ({
    folder: settings.personsFolder,
    title,
    typeValue: settings.personTypeValue,
    properties: {
      [settings.personTagProperty]: ['Family'],
      [settings.personRolesProperty]: ['traveller', 'eater'],
      email,
    },
    // No `# Stefan` heading: the filename is the title, and the body is this
    // plugin's own block and nothing else. It renders its empty state until
    // somebody in this vault invoices the household, which is exactly what it
    // should say about a person who never has.
    body: `${fence(NOD_SPENDING_BLOCK_LANG)}\n`,
    ensureBlock: NOD_SPENDING_BLOCK_LANG,
    // The one folder this plan writes into that it does not own. `CRM/People` is
    // filled by all three plugins and by whoever keeps contacts in this vault, so
    // a person note NODAtrail does not name is a colleague rather than a
    // stranger, and refusing the whole run over one would be refusing to seed a
    // vault for having an address book. Reported in the preview instead. Set here
    // and nowhere else: every other folder this plan touches is one it fills
    // entirely, and a real project or a real journal in one of those is exactly
    // the evidence the refusal rule exists to act on.
    shared: true,
  });

  return [person(STEFAN, 'stefan@example.invalid'), person(ERIKA, 'erika@example.invalid')];
}
