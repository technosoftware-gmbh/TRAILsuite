/**
 * The sample vault's content: fifteen notes, in English, as data.
 *
 * Pure. No `App`, no `t()`, no clock of its own -- `now` is handed in, because
 * the two meal-plan weeks have to be the week just gone and the week somebody
 * is in, or a freshly seeded vault opens on an empty grid and the feature looks
 * broken on first sight.
 *
 * Every folder and every property name comes from `settings`. That is not
 * ceremony here: the seeder writes notes the readers then have to find again,
 * and a literal `'type'` or `'Eating/Meals'` would seed a vault this plugin
 * could not see the moment somebody had configured it differently.
 *
 * What each note is here to demonstrate is written above it. The set is the
 * one `docs/design/sample-vault.md` describes, with the plan notes in the
 * frontmatter `entries:` shape the plugin writes today rather than the
 * checklist body that page was written against.
 */
import {
  addDays,
  createdEntry,
  formatWeekTitle,
  folderOfPath,
  joinFolder,
  legacySelectionProperty,
  localDateISO,
  orderFilenameStem,
  wikilinkValue,
  type SampleNote,
} from 'trail-core';
import { CUL_RELATED_ORDERS_BLOCK_LANG } from '../orders/related-orders-block-lang';
import { mealPlanNotePath } from '../planning/meal-plan/note-path';
import type { CULItrailSettings } from '../settings/types';

/** The two people every plugin in the suite seeds, spelled identically in all three. */
const STEFAN = 'Stefan';
const ERIKA = 'Erika';

/** The one supplier. Its note carries the reheating boilerplate the dishes fill in. */
const SUPPLIER = 'TomTasty AG';

/**
 * The subfolder holding notes written to somebody else's convention.
 *
 * Content rather than a setting: it is a folder this seeder invents inside the
 * configured meals folder, and nothing reads it by name. It is in scope because
 * the meal reader matches on folder membership at any depth, so a subfolder of
 * `mealsFolder` is already scanned -- `additionalMealFolders` is for meals kept
 * somewhere else entirely and is deliberately not used here.
 */
const FOREIGN_SUBFOLDER = 'From a real vault';

/** The fence every CRM note this plugin touches must end up carrying. */
const ORDERS_FENCE = `\`\`\`${CUL_RELATED_ORDERS_BLOCK_LANG}\n\`\`\``;

/**
 * One note's frontmatter: what it is, when it was made, then what it says.
 *
 * Here rather than beside the writer because it is content: the key order is
 * the one every note this plugin creates carries, and it is worth being able
 * to assemble it without an Obsidian YAML writer in the room.
 */
export function sampleFrontmatter(
  settings: CULItrailSettings,
  note: SampleNote,
  now: Date
): Record<string, unknown> {
  return {
    [settings.typePropertyName.trim() || 'type']: note.typeValue,
    ...createdEntry(settings, now),
    ...note.properties,
  };
}

/** One person's plan entry, before the settings-named fields are put on it. */
interface PlanEntrySeed {
  /** A meal note's title, or null for an entry naming no note. */
  meal: string | null;
  /** The text of an entry that is not a meal note. */
  label?: string;
  day: string;
  slot: string;
  eaten?: boolean;
  rating?: number;
  time?: string;
  leftovers?: boolean;
}

/** One order line, before the settings-named fields are put on it. */
interface OrderLineSeed {
  meal: string;
  price?: number;
  quantity?: number;
}

function entryValue(
  settings: CULItrailSettings,
  seed: PlanEntrySeed,
  id: string
): Record<string, unknown> {
  const value: Record<string, unknown> = {
    // The meal first, because it is what somebody reads the entry for, and the
    // id last, because it is machinery. Same order `plan-note.ts` writes.
    [settings.planEntryMealField]: seed.meal ? wikilinkValue(seed.meal) : (seed.label ?? ''),
    [settings.planEntryDayField]: seed.day,
    [settings.planEntrySlotField]: seed.slot,
  };

  // Only when true, and only when stated, exactly as the writer does it: an
  // `eaten: false` on every planned meal would be six lines of noise per week.
  if (seed.eaten) value[settings.planEntryEatenField] = true;
  if (seed.rating !== undefined) value[settings.planEntryRatingField] = seed.rating;
  if (seed.time) value[settings.planEntryTimeField] = seed.time;
  if (seed.leftovers) value[settings.planEntryLeftoversField] = true;
  value[settings.planEntryIdField] = id;

  return value;
}

/**
 * One person's week.
 *
 * The path comes from `mealPlanNotePath` rather than from `mealPlansFolder`,
 * because a plan note is addressed by a template and the template is what
 * decides which folder one week lands in. A template that cannot be resolved
 * yields a blank folder, which is what the planner reads as unconfigured.
 */
function planNote(
  settings: CULItrailSettings,
  week: string,
  person: string,
  entries: PlanEntrySeed[]
): SampleNote {
  const path = mealPlanNotePath(settings, week, person);
  const stem = path ? path.replace(/\.md$/, '') : '';

  return {
    folder: path ? folderOfPath(path) : '',
    title: stem.slice(stem.lastIndexOf('/') + 1),
    typeValue: settings.mealPlanTypeValue,
    properties: {
      [settings.mealPlanWeekProperty]: week,
      [settings.mealPlanPersonProperty]: wikilinkValue(person),
      [settings.mealPlanEntriesProperty]: entries.map((seed, index) =>
        entryValue(settings, seed, `mp-${week}-${person.replace(/\s+/g, '')}-${index + 1}`)
      ),
    },
    body: '',
  };
}

/** A selection in the current list schema, priced or bare depending on the lines. */
function selection(
  settings: CULItrailSettings,
  person: string,
  lines: OrderLineSeed[]
): Record<string, unknown> {
  const priced = lines.some((line) => line.price !== undefined || line.quantity !== undefined);

  if (!priced) {
    return {
      [settings.orderSelectionPersonField]: wikilinkValue(person),
      [settings.orderSelectionMealsField]: lines.map((line) => wikilinkValue(line.meal)),
    };
  }

  return {
    [settings.orderSelectionPersonField]: wikilinkValue(person),
    [settings.orderSelectionItemsField]: lines.map((line) => {
      const item: Record<string, unknown> = {
        [settings.orderItemMealField]: wikilinkValue(line.meal),
      };
      if (line.price !== undefined) item[settings.orderItemPriceField] = line.price;
      // A quantity of 1 is the absence of a quantity rather than a quantity,
      // which is the rule the order writer follows.
      if (line.quantity !== undefined && line.quantity !== 1) {
        item[settings.orderItemQuantityField] = line.quantity;
      }
      return item;
    }),
  };
}

/** An order note, named the way every order is: date first, then the number. */
function orderNote(
  settings: CULItrailSettings,
  orderDate: Date,
  orderNumber: string,
  properties: Record<string, unknown>
): SampleNote {
  return {
    folder: settings.ordersFolder,
    title: orderFilenameStem(orderDate, orderNumber),
    typeValue: settings.orderTypeValue,
    properties: {
      [settings.orderCompanyProperty]: wikilinkValue(SUPPLIER),
      [settings.orderDateProperty]: localDateISO(orderDate),
      ...properties,
    },
    // Deliberately empty. The order writer writes frontmatter and leaves the
    // body to whoever wants it, and a seeded paragraph would suggest otherwise.
    body: '',
  };
}

/**
 * A Person note, identical in shape to the one the sibling plugins seed.
 *
 * **`shared: true`, here and on the company note, and nowhere else.** The two
 * CRM folders are written by all three plugins by agreement, so a note in one
 * of them that this plan does not name belongs to a sibling rather than to a
 * stranger, and finding one must not refuse the run. `CRM/People` looked like
 * it needed no flag, since all three seed exactly Stefan and Erika and nobody
 * is a stranger to anybody. `CRM/Companies` is where that broke: each plugin
 * seeds the company its own notes need, a travel operator or a meal supplier,
 * and no contract says which companies a vault holds, so the second plugin to
 * run found the first one's company there and gave up on the whole seed. Both
 * folders carry the flag, because the reason is the folder rather than the
 * coincidence that one of them happens to agree on its contents.
 *
 * Every folder CULItrail owns outright -- meals, plans, orders -- stays under
 * the ordinary rule, where one note this plan did not put there refuses.
 */
function personNote(settings: CULItrailSettings, name: string, email: string): SampleNote {
  return {
    folder: settings.personsFolder,
    title: name,
    typeValue: settings.personTypeValue,
    properties: {
      [settings.personTagProperty]: ['Family'],
      [settings.personRolesProperty]: ['traveller', 'eater'],
      // A literal, and the one place in this file that is right. CULItrail
      // displays no contact field and therefore has no setting naming one; the
      // key is here because the other two plugins write it and the three notes
      // have to agree.
      email,
    },
    // No `# Stefan` heading: the filename is the title. The block is the whole
    // body, and it is what makes the note answer to this plugin as well.
    body: `${ORDERS_FENCE}\n`,
    ensureBlock: CUL_RELATED_ORDERS_BLOCK_LANG,
    shared: true,
  };
}

export function sampleNotes(settings: CULItrailSettings, now: Date): SampleNote[] {
  const thisWeek = formatWeekTitle(now);
  const lastWeek = formatWeekTitle(addDays(now, -7));
  const foreignFolder = joinFolder(settings.mealsFolder, FOREIGN_SUBFOLDER);

  return [
    {
      // The case worth having. It supplies numbers and no prose, and it states
      // no supplier, so three separate derivations have to agree before a
      // single reheating card appears: the dish supplies the temperature and
      // the time, the company supplies the wording, and the order supplies the
      // company. Anything that quietly stops working shows up here first.
      folder: settings.mealsFolder,
      title: 'Tom Yum Gai',
      typeValue: settings.mealTypeValue,
      properties: {
        [settings.servingsProperty]: 1,
        [settings.reheatTimeProperty]: 25,
        [settings.priceProperty]: 18.5,
        [settings.allergensProperty]: ['fish', 'soy'],
      },
      body: [
        'Hot and sour chicken soup with lemongrass, galangal and lime leaves.',
        '',
        `# ${settings.reheatingHeading}`,
        '',
        '## Steamer',
        `[${settings.reheatTempField}:: 95 °C] [${settings.reheatTimeField}:: 25 min]`,
        '',
        '## Microwave',
        `[${settings.reheatTempField}:: 800 W] [${settings.reheatTimeField}:: 6 min]`,
        '',
      ].join('\n'),
    },
    {
      // Two rows of the merge rule in one note. The oven heading carries
      // numbers for the company's wording to absorb; the microwave heading is
      // prose, which overrides the company outright. If a resolver ever starts
      // preferring one source wholesale, this note shows it on one screen.
      folder: settings.mealsFolder,
      title: 'Aubergine Parmigiana',
      typeValue: settings.mealTypeValue,
      properties: {
        [settings.servingsProperty]: 1,
        [settings.reheatTimeProperty]: 20,
        [settings.supplierProperty]: wikilinkValue(SUPPLIER),
        [settings.mealLineProperty]: 'Alltag',
        [settings.priceProperty]: 19.9,
        [settings.dietProperty]: ['vegetarian'],
        [settings.allergensProperty]: ['gluten', 'milk'],
      },
      body: [
        'Layered aubergine with tomato, basil and mozzarella.',
        '',
        `# ${settings.reheatingHeading}`,
        '',
        '## Oven',
        `[${settings.reheatTempField}:: 180 °C] [${settings.reheatTimeField}:: 20 min]`,
        '',
        '## Microwave',
        'Take the lid off, pierce the film and heat on medium for eight minutes.',
        'Let it stand for two more before serving.',
        '',
        `# ${settings.notesHeading}`,
        '',
        'The tray is smaller than it looks. Order two if anybody is hungry.',
        '',
      ].join('\n'),
    },
    {
      // The full shape, so every part of the header and the breakdown card has
      // something real to draw. The image path resolves to nothing on purpose:
      // the fallback is the state most vaults are actually in, and it is worth
      // seeing rather than reading about.
      folder: settings.mealsFolder,
      title: 'Chicken Korma',
      typeValue: settings.mealTypeValue,
      properties: {
        [settings.imageProperty]: '_resources/chicken-korma.png',
        [settings.servingsProperty]: 1,
        [settings.prepTimeProperty]: 2,
        [settings.reheatTimeProperty]: 12,
        [settings.mealLineProperty]: 'Alltag',
        [settings.priceProperty]: 21.9,
        [settings.dietProperty]: ['meat'],
        // Every allergen the gallery's exclusion filter has anything to match
        // against, so one note is enough to demonstrate it.
        [settings.allergensProperty]: [
          'gluten',
          'milk',
          'egg',
          'soy',
          'nuts',
          'peanuts',
          'celery',
          'mustard',
        ],
        [settings.caloriesPer100gProperty]: 152,
        [settings.kjPer100gProperty]: 636,
        [settings.macronutrientsProperty]: [
          // Regulation (EU) 1169/2011's order, and language-free ids rather
          // than words, which is what lets a German vault show German labels
          // for a note an English one wrote.
          { name: 'fat', unit: 'g', value: 6.4 },
          { name: 'saturatedFat', unit: 'g', value: 2.1 },
          { name: 'carbs', unit: 'g', value: 14.8 },
          { name: 'sugar', unit: 'g', value: 3.2 },
          { name: 'protein', unit: 'g', value: 8.1 },
        ],
        [settings.micronutrientsProperty]: [{ name: 'salt', unit: 'g', value: 0.9 }],
        // The five figures the editor recomputes from the breakdown and the
        // serving weight on every save. Seeded at exactly what that
        // computation yields for 400 g, so the first save of this note is a
        // no-op rather than a correction.
        [settings.caloriesProperty]: 608,
        [settings.kjProperty]: 2544,
        [settings.proteinProperty]: 32.4,
        [settings.fatProperty]: 25.6,
        [settings.carbsProperty]: 59.2,
        [settings.servingSizeProperty]: '400g',
        [settings.favoriteProperty]: true,
        tags: ['indian', 'curry'],
      },
      body: [
        'Chicken in a mild almond and cardamom sauce, with basmati rice.',
        '',
        `# ${settings.reheatingHeading}`,
        '',
        '## Steamer',
        `[${settings.reheatTempField}:: 95 °C] [${settings.reheatTimeField}:: 12 min]`,
        '',
        `# ${settings.notesHeading}`,
        '',
        'Mild enough for everybody. The rice comes in the same tray.',
        '',
      ].join('\n'),
    },
    {
      // The other extreme: a type value and a reheating section, and nothing
      // else. It is also the note with no servings at all, which the
      // per-serving nutrition has to survive rather than divide by.
      folder: settings.mealsFolder,
      title: 'Lentil Soup',
      typeValue: settings.mealTypeValue,
      properties: {},
      body: [
        'Brown lentils, carrot and thyme.',
        '',
        `# ${settings.reheatingHeading}`,
        '',
        '## Microwave',
        `[${settings.reheatTempField}:: 700 W] [${settings.reheatTimeField}:: 5 min]`,
        '',
      ].join('\n'),
    },
    {
      // A note nobody wrote for CULItrail. `prep:` and `cook:` rather than the
      // configured names, `yield:` rather than servings, `cover:` rather than
      // image, `kcal:` rather than calories, and `diet:` as a bare string
      // rather than a list. The literals are the point: this is the only place
      // the alias lists and the lenient readers are proven against a
      // convention that does not know this plugin exists.
      //
      // It is also the one note that states `lastEaten` and `eatenCount`
      // outright. Both are otherwise derived, and two sources of truth is what
      // is being demonstrated here rather than what is being done everywhere.
      folder: foreignFolder,
      title: "Grandma's Lasagne",
      typeValue: settings.mealTypeValue,
      properties: {
        cover: '_resources/grandmas-lasagne.png',
        yield: 6,
        prep: 10,
        cook: 45,
        kcal: 780,
        [settings.dietProperty]: 'vegetarian',
        [settings.lastEatenProperty]: localDateISO(addDays(now, -240)),
        [settings.eatenCountProperty]: 11,
      },
      body: [
        "Aunt Renate's, written down long before anybody thought about plugins.",
        '',
        `# ${settings.reheatingHeading}`,
        '',
        '## Oven',
        'Cover with foil and give it 25 minutes at 180 °C, then five more without.',
        '',
      ].join('\n'),
    },

    // Two people across two consecutive weeks, so per-person isolation and
    // week navigation are both visible without editing anything. The week just
    // gone is eaten and rated; the week somebody is in is planned and unrated,
    // because nothing has happened yet.
    planNote(settings, lastWeek, STEFAN, [
      { meal: 'Tom Yum Gai', day: 'monday', slot: 'lunch', eaten: true, rating: 4, time: '12:30' },
      { meal: 'Aubergine Parmigiana', day: 'tuesday', slot: 'dinner', eaten: true, rating: 5 },
      // Free text rather than a wikilink, and eaten with no rating. Both are
      // paths that are easy to break and invisible until they are: a label
      // entry has no note behind it, and an eaten entry with no rating is a
      // deliberate state rather than a missing value.
      {
        meal: null,
        label: 'Leftovers',
        day: 'thursday',
        slot: 'dinner',
        eaten: true,
        leftovers: true,
      },
      { meal: 'Chicken Korma', day: 'friday', slot: 'dinner', eaten: true, rating: 3 },
    ]),
    planNote(settings, lastWeek, ERIKA, [
      { meal: 'Aubergine Parmigiana', day: 'monday', slot: 'lunch', eaten: true, rating: 4 },
      { meal: 'Lentil Soup', day: 'tuesday', slot: 'lunch', eaten: true, rating: 3, time: '12:15' },
      { meal: "Grandma's Lasagne", day: 'wednesday', slot: 'dinner', eaten: true, rating: 5 },
      { meal: 'Chicken Korma', day: 'saturday', slot: 'lunch', eaten: true, rating: 4 },
    ]),
    planNote(settings, thisWeek, STEFAN, [
      { meal: 'Chicken Korma', day: 'monday', slot: 'dinner' },
      { meal: 'Lentil Soup', day: 'tuesday', slot: 'lunch' },
      { meal: 'Tom Yum Gai', day: 'wednesday', slot: 'dinner' },
      { meal: 'Aubergine Parmigiana', day: 'friday', slot: 'dinner' },
    ]),
    planNote(settings, thisWeek, ERIKA, [
      { meal: 'Tom Yum Gai', day: 'monday', slot: 'lunch' },
      { meal: "Grandma's Lasagne", day: 'tuesday', slot: 'dinner' },
      { meal: 'Aubergine Parmigiana', day: 'thursday', slot: 'lunch' },
      { meal: 'Chicken Korma', day: 'saturday', slot: 'dinner' },
    ]),

    // The v1 flat schema, one property per person keyed by first name. Nothing
    // writes this any more; it is here so the read-and-upgrade path has a real
    // note to run against rather than a fixture, and so that saving it once
    // demonstrably turns it into the current shape.
    orderNote(settings, addDays(now, -17), '23624', {
      [settings.orderDeliveryDateProperty]: localDateISO(addDays(now, -13)),
      [settings.orderPriceProperty]: 92.4,
      [settings.orderPriceCurrencyProperty]: 'CHF',
      [legacySelectionProperty(settings.orderSelectionPropertyPrefix, STEFAN)]: [
        wikilinkValue('Tom Yum Gai'),
        wikilinkValue('Lentil Soup'),
      ],
      [legacySelectionProperty(settings.orderSelectionPropertyPrefix, ERIKA)]: [
        wikilinkValue('Aubergine Parmigiana'),
        wikilinkValue('Chicken Korma'),
      ],
    }),
    // The list schema with no line prices, which is the shape most existing
    // orders are in and the one a save must not rewrite.
    orderNote(settings, addDays(now, -10), '23811', {
      [settings.orderDeliveryDateProperty]: localDateISO(addDays(now, -6)),
      [settings.orderPriceProperty]: 88.6,
      [settings.orderPriceCurrencyProperty]: 'CHF',
      [settings.orderShippingProperty]: 9.9,
      [settings.orderSelectionsProperty]: [
        selection(settings, STEFAN, [{ meal: 'Chicken Korma' }, { meal: 'Tom Yum Gai' }]),
        selection(settings, ERIKA, [{ meal: "Grandma's Lasagne" }, { meal: 'Lentil Soup' }]),
      ],
    }),
    // Priced lines, so the invoice has real arithmetic to print. The stated
    // total is the lines summed plus the company's shipping, because that is
    // what the editor would have computed; a line's price is what was charged,
    // which is a different claim from what a dish note says it costs today.
    orderNote(settings, addDays(now, -3), '23997', {
      [settings.orderDeliveryDateProperty]: localDateISO(addDays(now, 1)),
      [settings.orderPriceProperty]: 107.7,
      [settings.orderPriceCurrencyProperty]: 'CHF',
      [settings.orderShippingProperty]: 9.9,
      [settings.orderVatRateProperty]: 2.6,
      [settings.orderSelectionsProperty]: [
        selection(settings, STEFAN, [
          { meal: 'Tom Yum Gai', price: 18.5, quantity: 2 },
          { meal: 'Chicken Korma', price: 21.9 },
        ]),
        selection(settings, ERIKA, [
          { meal: 'Aubergine Parmigiana', price: 19.9 },
          { meal: 'Lentil Soup', price: 9.5, quantity: 2 },
        ]),
      ],
    }),

    personNote(settings, STEFAN, 'stefan@example.invalid'),
    personNote(settings, ERIKA, 'erika@example.invalid'),

    {
      // The other half of the reheating demonstration. The boilerplate is
      // written once here instead of on every dish, with `{temp}` and `{time}`
      // filled from whichever meal is being read. A token nothing fills
      // withholds that appliance entirely rather than printing a sentence with
      // a hole in it, which is why the Oven card is absent for a dish that
      // states no oven numbers.
      //
      // The related-orders fence sits after the last appliance on purpose:
      // that is the note that once had a line of backticks read back as a
      // reheating instruction, and the parser drops fenced blocks because of
      // it.
      folder: settings.companiesFolder,
      title: SUPPLIER,
      typeValue: settings.companyTypeValue,
      properties: {
        [settings.companyTagProperty]: ['Food delivery'],
        [settings.companyRolesProperty]: ['meal supplier'],
        [settings.companyCurrencyProperty]: 'CHF',
        [settings.companyPaymentMethodProperty]: 'Invoice',
        [settings.companyInvoiceTimingProperty]: 'With the delivery',
        [settings.companyShippingFeeProperty]: 9.9,
        [settings.companyFreeShippingFromProperty]: 12,
        // Counted in portions rather than in francs, which is how a meal
        // company sells. `from` and `percent` are the reader's own sub-keys.
        [settings.companyDiscountTableProperty]: [
          { from: 12, percent: 5 },
          { from: 24, percent: 10 },
        ],
        [settings.companyLinesProperty]: ['Alltag', 'Sport', 'Weightloss'],
      },
      body: [
        `# ${settings.reheatingHeading}`,
        '',
        '## Steamer',
        'Take the clear film off the tray. Use the reheat setting at {temp} and give it {time}.',
        '',
        '## Oven',
        'Take the lid off and keep the tray. {temp} for {time}, uncovered.',
        '',
        '## Microwave',
        'Pierce the film and heat at {temp} for {time}. Stir once halfway through.',
        '',
        ORDERS_FENCE,
        '',
      ].join('\n'),
      ensureBlock: CUL_RELATED_ORDERS_BLOCK_LANG,
      // Shared, for the reason spelled out on `personNote` above. This is the
      // note the combined vault actually broke on: a sibling plugin's own
      // company was sitting in this folder and refused the entire run.
      shared: true,
    },
  ];
}
