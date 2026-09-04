/**
 * The sample notes, read back through the parsers that will actually read them.
 *
 * **This replaced a suite that read a vault beside the repo and skipped when it
 * was not there.** That suite tested the right thing about the wrong artefact:
 * `CULItrail-Sample` was never shipped, so the check was permanently skipped,
 * and a skipped suite and a passing one look alike in the summary line. The
 * content is a function in this package now, so it can be seeded into a fake
 * vault and asserted unconditionally. Every claim the old suite made that still
 * applies is made here.
 *
 * What is checked is what a hand-written note gets wrong invisibly: a heading
 * the reader does not know, a wikilink that resolves to nothing, an appliance
 * whose numbers and whose supplier's wording do not meet. All of that renders
 * as a perfectly ordinary Markdown file and as an empty view.
 *
 * The one fidelity gap worth naming: the notes are serialised here with the
 * `yaml` package rather than with Obsidian's writer, which has no runtime
 * outside the app (see tests/obsidian-stub.ts). The frontmatter **object** is
 * the real one, built by `sampleFrontmatter`; only the block it is printed into
 * is this suite's. `yaml` is already in the tree as a transitive dependency and
 * nothing in `src/` uses it, since Obsidian parses frontmatter itself.
 */
import { describe, expect, it } from 'vitest';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
  computedOrderTotal,
  deriveServingNutrition,
  formatWeekTitle,
  orderTitles,
  parseOrderFilenameStem,
  planSampleVault,
  sampleFolders,
  sampleVaultWritable,
  sampleWriteCount,
  addDays,
  type SampleNote,
} from 'trail-core';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { mergeSettings } from '../src/settings/validate';
import { sampleFrontmatter, sampleNotes } from '../src/sample/notes';
import { carriesBlock } from '../src/sample/read-folders';
import { CUL_RELATED_ORDERS_BLOCK_LANG } from '../src/orders/related-orders-block-lang';
import { readCompanies, readPersons } from '../src/crm/read-crm';
import { readNotesOfType } from '../src/vault/read-notes';
import { stripFrontmatter } from '../src/meals/parser/body-sections';
import { readMealMeta } from '../src/meals/parser/meal-meta';
import { readGrams } from '../src/meals/parser/serving-size';
import { parseReheatSection } from '../src/meals/reheating/parse-section';
import { resolveReheating } from '../src/meals/reheating/resolve';
import { parsePlanNote, planProperties } from '../src/planning/meal-plan/plan-note';
import { orderProperties } from '../src/orders/read-orders';
import { makeFakeVault } from './fake-vault';
import { parseOrder } from 'trail-core';

const settings = DEFAULT_SETTINGS;

/**
 * A fixed clock, because two of the fifteen notes are dated relative to it.
 * A Thursday in the middle of a week and of a month, so nothing here depends
 * on how a week or a month happens to fall.
 */
const NOW = new Date(2026, 8, 17, 9, 0);

const notes = sampleNotes(settings, NOW);

function pathOf(note: SampleNote): string {
  return `${note.folder}/${note.title}.md`;
}

function noteText(note: SampleNote): string {
  const yaml = stringifyYaml(sampleFrontmatter(settings, note, NOW)).trimEnd();
  return `---\n${yaml}\n---\n\n${note.body}`;
}

/**
 * The frontmatter as a reader gets it, round-tripped through YAML.
 *
 * Round-tripped rather than handed over as the object it was built from, so a
 * value whose YAML form does not survive the trip -- a nested list of mappings,
 * an unquoted number -- is read the way a vault would read it rather than the
 * way this file wrote it.
 */
function frontmatterOf(note: SampleNote): Record<string, unknown> {
  const parsed: unknown = parseYaml(stringifyYaml(sampleFrontmatter(settings, note, NOW)));
  return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

const vault = makeFakeVault(
  notes.map((note) => ({
    path: pathOf(note),
    frontmatter: frontmatterOf(note),
    contents: noteText(note),
  }))
);

const byTitle = new Map(notes.map((note) => [note.title, note] as const));

function note(title: string): SampleNote {
  const found = byTitle.get(title);
  if (!found) throw new Error(`No sample note called ${title}`);
  return found;
}

function metaOf(title: string) {
  return readMealMeta(frontmatterOf(note(title)), settings, note(title).body.split('\n'));
}

function reheatEntries(title: string) {
  return parseReheatSection(note(title).body, settings);
}

describe('the sample notes', () => {
  it('is the fifteen notes the design page describes', () => {
    expect(notes).toHaveLength(15);
  });

  it('writes only into the folders the default settings name', () => {
    // The whole point of the set: seed it, configure nothing, and every view
    // finds its notes. That only holds if the folders are the defaults exactly.
    const folders = sampleFolders(notes);
    expect(folders).toContain(settings.mealsFolder);
    expect(folders).toContain(settings.ordersFolder);
    expect(folders).toContain(settings.personsFolder);
    expect(folders).toContain(settings.companiesFolder);

    // The plan notes are addressed by a path template rather than by the
    // folder setting, and the two have to agree or the meal plan writes one
    // week where the eating history reads none.
    const planFolders = folders.filter((folder) => folder.startsWith(settings.mealPlansFolder));
    expect(planFolders.length).toBeGreaterThan(0);

    for (const folder of folders) {
      const known =
        folder.startsWith(settings.mealsFolder) ||
        folder.startsWith(settings.mealPlansFolder) ||
        folder === settings.ordersFolder ||
        folder === settings.personsFolder ||
        folder === settings.companiesFolder;
      expect(known, folder).toBe(true);
    }
  });

  it('resolves every wikilink it writes to a note it also writes', () => {
    // "Every wikilink in it resolves" is the half of the promise worth
    // checking, and it is checked over the note text rather than over the
    // model: a link inside a frontmatter value is still a link.
    const titles = new Set(notes.map((entry) => entry.title));
    const broken: string[] = [];

    for (const entry of notes) {
      for (const match of noteText(entry).matchAll(/\[\[([^\]|#]+)/g)) {
        const target = match[1].trim();
        if (!titles.has(target)) broken.push(`${entry.title} -> ${target}`);
      }
    }

    expect(broken).toEqual([]);
  });
});

describe('meals', () => {
  const meals = readNotesOfType(vault, settings, 'meal');

  it('is found by folder and type, subfolder included', () => {
    // Five, and the fifth sits in `From a real vault`. The reader matches
    // folder membership at any depth, which is why that folder needs no
    // `additionalMealFolders` entry to be in scope.
    expect(meals.map((entry) => entry.title).sort()).toEqual([
      'Aubergine Parmigiana',
      'Chicken Korma',
      "Grandma's Lasagne",
      'Lentil Soup',
      'Tom Yum Gai',
    ]);
  });

  it('gives every meal a body to render', () => {
    for (const entry of meals) {
      const body = stripFrontmatter(noteText(note(entry.title))).trim();
      // A note that is frontmatter and nothing else renders as an empty view,
      // which is invisible in Markdown and is exactly what a hand-written
      // sample produces.
      expect(body, entry.title).not.toBe('');
    }
  });

  it('resolves the supplier boilerplate against a dish that supplies only numbers', () => {
    // The whole merge rule end to end. The company's wording with the dish's
    // temperature and time filled into it: a token left unfilled would
    // withhold the appliance, so an empty result here means the two notes
    // disagree about a field name.
    const supplier = reheatEntries('TomTasty AG');
    expect(supplier.length).toBe(3);

    const resolved = resolveReheating(reheatEntries('Tom Yum Gai'), supplier, settings);

    const steamer = resolved.find((entry) => entry.applianceId === 'steamer');
    expect(steamer?.source).toBe('supplier');
    expect(steamer?.steps.join(' ')).toContain('95 °C');
    expect(steamer?.steps.join(' ')).toContain('25 min');
    expect(steamer?.steps.join(' ')).not.toContain('{');

    const microwave = resolved.find((entry) => entry.applianceId === 'microwave');
    expect(microwave?.source).toBe('supplier');
    expect(microwave?.steps.join(' ')).toContain('800 W');
    expect(microwave?.steps.join(' ')).not.toContain('{');

    // The row worth defending: the company publishes an oven instruction with
    // tokens in it and this dish states no oven numbers, so the appliance is
    // withheld entirely rather than offered with a hole in the sentence.
    expect(resolved.some((entry) => entry.applianceId === 'oven')).toBe(false);
  });

  it('lets a dish absorb the wording for one appliance and override it for another', () => {
    const resolved = resolveReheating(
      reheatEntries('Aubergine Parmigiana'),
      reheatEntries('TomTasty AG'),
      settings
    );

    const oven = resolved.find((entry) => entry.applianceId === 'oven');
    expect(oven?.source).toBe('supplier');
    expect(oven?.steps.join(' ')).toContain('180 °C');
    expect(oven?.steps.join(' ')).toContain('20 min');

    // Prose on the dish wins outright, which is the other row of the table:
    // the dish's own words, and none of the company's.
    const microwave = resolved.find((entry) => entry.applianceId === 'microwave');
    expect(microwave?.source).toBe('dish');
    expect(microwave?.steps.join(' ')).toContain('Take the lid off, pierce the film');
    expect(microwave?.steps.join(' ')).not.toContain('Stir once halfway through');
  });

  it('leaves that dish without a supplier property, so an order has to supply it', () => {
    // The half of the chain the case above cannot reach: resolving a supplier
    // needs an App, so it is not run here, but its two inputs are exactly what
    // this asserts. The dish states no `supplier:`, and an order names both the
    // dish and the company. Tidying a supplier property onto the note would
    // stop it demonstrating the derived path, and every assertion above would
    // still pass.
    expect(frontmatterOf(note('Tom Yum Gai'))[settings.supplierProperty]).toBeUndefined();

    const naming = readNotesOfType(vault, settings, 'order')
      .map((entry) =>
        parseOrder({
          stem: entry.title,
          frontmatter: entry.frontmatter,
          properties: orderProperties(settings),
          legacyPrefix: settings.orderSelectionPropertyPrefix,
          personTitles: ['Stefan', 'Erika'],
        })
      )
      .filter((order) => orderTitles(order).includes('Tom Yum Gai'));

    expect(naming.length).toBeGreaterThan(0);
    for (const order of naming) expect(order.companyTitle).toBe('TomTasty AG');
  });

  it('prices the ready meals, so the card and the header have a figure to show', () => {
    // Only that a price is stated and readable. **Deliberately not** that it
    // agrees with the total of the order referencing the dish, which is a rule
    // that does not hold: a dish price is the default offered when a meal is
    // added to an order, it changes when the supplier changes it, and the order
    // does not follow it afterwards. The two agree in this set because that is
    // how it was seeded, not because anything keeps them in step, and a test
    // pinning it would fail the first time a price rose and would describe the
    // failure as inconsistency.
    for (const title of ['Tom Yum Gai', 'Aubergine Parmigiana', 'Chicken Korma']) {
      const price = metaOf(title).price;
      expect(price, title).not.toBeNull();
      expect(price, title).toBeGreaterThan(0);
    }
  });

  it('covers the shapes the design page says it covers', () => {
    const fronts = notes
      .filter((entry) => entry.typeValue === settings.mealTypeValue)
      .map((entry) => ({ title: entry.title, front: frontmatterOf(entry) }));

    // A meal with no servings at all, which the per-serving nutrition has to
    // survive rather than divide by.
    expect(fronts.some((entry) => metaOf(entry.title).servings === null)).toBe(true);

    // One carrying enough allergens for the exclusion filter to be worth
    // demonstrating on a single note.
    const allergens = fronts.map((entry) => metaOf(entry.title).allergens.length);
    expect(Math.max(...allergens)).toBeGreaterThanOrEqual(6);

    // Exactly one note states lastEaten and eatenCount outright. Every other
    // derives them, and two sources of truth is the thing being demonstrated
    // rather than the thing being done everywhere.
    const stated = fronts.filter((entry) => entry.front[settings.lastEatenProperty] !== undefined);
    expect(stated.map((entry) => entry.title)).toEqual(["Grandma's Lasagne"]);
    expect(
      fronts.filter((entry) => entry.front[settings.eatenCountProperty] !== undefined)
    ).toHaveLength(1);
  });

  it('states a breakdown whose per-serving figures are the ones a save would write', () => {
    // The one write-back inside a single note. Seeded at exactly what the
    // editor computes from the breakdown and the serving weight, so the first
    // save of this note is a no-op rather than a silent correction to five
    // numbers.
    const meta = metaOf('Chicken Korma');
    const grams = readGrams(frontmatterOf(note('Chicken Korma'))[settings.servingSizeProperty]);
    expect(grams).toBe(400);

    const derived = deriveServingNutrition(meta.per100g, grams);
    expect(meta.nutrition.calories).toBe(derived.calories);
    expect(meta.nutrition.protein).toBe(derived.protein);
    expect(meta.nutrition.fat).toBe(derived.fat);
    expect(meta.nutrition.carbs).toBe(derived.carbs);
  });
});

describe('the note written to a foreign convention', () => {
  // `prep:` and `cook:` rather than the configured names, `yield:` rather than
  // servings, `cover:` rather than image, `kcal:` rather than calories, and
  // `diet:` as a bare string rather than a list. This is the only place the
  // alias lists and the lenient readers are proven against notes nobody wrote
  // for CULItrail.
  const meta = () => metaOf("Grandma's Lasagne");

  it('sits under the meals folder, so it needs no second folder setting', () => {
    expect(note("Grandma's Lasagne").folder.startsWith(settings.mealsFolder)).toBe(true);
    expect(note("Grandma's Lasagne").folder).not.toBe(settings.mealsFolder);
  });

  it('states nothing under the names this vault would have written', () => {
    // Without this the case is not proven at all: the alias lists find the
    // value under either spelling, so a note quietly "tidied" onto the
    // configured names reads identically and stops testing anything.
    const front = frontmatterOf(note("Grandma's Lasagne"));
    for (const key of [
      settings.prepTimeProperty,
      settings.reheatTimeProperty,
      settings.servingsProperty,
      settings.imageProperty,
      settings.caloriesProperty,
    ]) {
      expect(front[key], key).toBeUndefined();
    }
  });

  it('reads every property the other vault wrote, under its own names for them', () => {
    expect(meta().image).not.toBeNull();
    expect(meta().servings).toBe(6);
    expect(meta().prepTime).toBe(10);
    expect(meta().reheatTime).toBe(45);
    expect(meta().nutrition.calories).toBe(780);
    // A bare string where the reader expects a list.
    expect(meta().diet).toEqual(['vegetarian']);
  });

  it('shows an explicit last-eaten winning over anything derived', () => {
    expect(meta().lastEaten).toBe(localDay(addDays(NOW, -240)));
    expect(meta().eatenCount).toBe(11);
  });
});

/** The `YYYY-MM-DD` a note states, for comparing against a read-back date. */
function localDay(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

describe('meal plans', () => {
  const plans = readNotesOfType(vault, settings, 'mealPlan');
  const thisWeek = formatWeekTitle(NOW);
  const lastWeek = formatWeekTitle(addDays(NOW, -7));

  const parsed = (title: string) => {
    const found = plans.find((entry) => entry.title === title);
    expect(found, title).toBeDefined();
    return parsePlanNote({
      frontmatter: found?.frontmatter ?? {},
      properties: planProperties(settings),
    });
  };

  it('is two people across two consecutive weeks, found by folder and type', () => {
    expect(plans).toHaveLength(4);
    expect(plans.filter((entry) => entry.title.includes('Stefan'))).toHaveLength(2);
    expect(plans.filter((entry) => entry.title.includes('Erika'))).toHaveLength(2);
    expect(plans.filter((entry) => entry.title.includes(lastWeek))).toHaveLength(2);
    expect(plans.filter((entry) => entry.title.includes(thisWeek))).toHaveLength(2);
  });

  it('parses into entries that name a week, a person, a day and a slot', () => {
    for (const entry of plans) {
      const content = parsed(entry.title);
      expect(content.week, entry.title).not.toBeNull();
      expect(content.personTitle, entry.title).not.toBeNull();
      expect(content.entries.length, entry.title).toBeGreaterThan(3);

      for (const planned of content.entries) {
        // A day or slot outside the fixed set reads as absent, which drops the
        // entry into the queue rather than onto its day. Silent, and exactly
        // what a typo in a hand-written note produces.
        expect(
          planned.day,
          `${entry.title}: ${planned.mealTitle ?? planned.label ?? ''}`
        ).not.toBeNull();
        expect(
          planned.slot,
          `${entry.title}: ${planned.mealTitle ?? planned.label ?? ''}`
        ).not.toBeNull();
        expect(planned.id).not.toBe('');
      }
    }
  });

  it('records ratings on the week just gone and none on the week somebody is in', () => {
    const ratings = (title: string): number =>
      parsed(title).entries.filter((planned) => planned.rating !== null).length;

    expect(ratings(`${lastWeek}-Stefan-MealPlan`)).toBeGreaterThan(0);
    expect(ratings(`${lastWeek}-Erika-MealPlan`)).toBeGreaterThan(0);
    // Nothing has been eaten yet, so nothing is rated.
    expect(ratings(`${thisWeek}-Stefan-MealPlan`)).toBe(0);
    expect(ratings(`${thisWeek}-Erika-MealPlan`)).toBe(0);
    expect(parsed(`${thisWeek}-Stefan-MealPlan`).entries.some((planned) => planned.eaten)).toBe(
      false
    );
  });

  it('includes an entry that names no meal note, and one eaten without a rating', () => {
    const all = plans.flatMap((entry) => parsed(entry.title).entries);

    // A meal named directly rather than linked. The path that is easy to break
    // and invisible until it is.
    const freeText = all.filter((planned) => planned.mealTitle === null);
    expect(freeText).toHaveLength(1);
    expect(freeText[0].label).toBe('Leftovers');
    expect(freeText[0].isLeftovers).toBe(true);

    // Eaten and deliberately unrated, which is the state the old checklist had
    // to write `[rating:: 0]` for.
    expect(all.some((planned) => planned.eaten && planned.rating === null)).toBe(true);
  });
});

describe('orders', () => {
  const orders = readNotesOfType(vault, settings, 'order');

  const parse = (title: string) => {
    const found = orders.find((entry) => entry.title === title);
    expect(found, title).toBeDefined();
    return parseOrder({
      stem: title,
      frontmatter: found?.frontmatter ?? {},
      properties: orderProperties(settings),
      legacyPrefix: settings.orderSelectionPropertyPrefix,
      personTitles: ['Stefan', 'Erika'],
    });
  };

  it('parses each one, taking its number from the filename', () => {
    expect(orders).toHaveLength(3);

    for (const entry of orders) {
      expect(parseOrderFilenameStem(entry.title), entry.title).not.toBeNull();

      const order = parse(entry.title);
      expect(order.orderNumber, entry.title).not.toBe('');
      expect(order.companyTitle, entry.title).toBe('TomTasty AG');
      expect(
        order.selections.map((selection) => selection.personTitle),
        entry.title
      ).toEqual(['Stefan', 'Erika']);
    }
  });

  it('includes exactly one written in the v1 flat schema, and reads it', () => {
    // The reason this folder has three notes rather than two: the
    // read-and-upgrade path needs something real to run against.
    const legacyKey = `${settings.orderSelectionPropertyPrefix}Stefan`;
    const legacy = orders.filter((entry) => entry.frontmatter[legacyKey] !== undefined);
    expect(legacy).toHaveLength(1);

    const order = parse(legacy[0].title);
    expect(order.selections[0].items.map((item) => item.mealTitle)).toEqual([
      'Tom Yum Gai',
      'Lentil Soup',
    ]);
    // v1 carries no line prices, so there is nothing to compute a total from
    // and the stated figure is the only one.
    expect(computedOrderTotal(order)).toBeNull();
  });

  it('has one priced order whose lines add up to the total it states', () => {
    // The invariant that DOES hold, unlike a dish price against an order: a
    // line price and its own order's total live in one note.
    const priced = orders
      .map((entry) => parse(entry.title))
      .filter((order) => computedOrderTotal(order) !== null);

    expect(priced).toHaveLength(1);
    expect(computedOrderTotal(priced[0])).toBe(priced[0].price);
  });
});

describe('the shared CRM notes', () => {
  it('are the two people the other plugins seed, in the same shape', () => {
    const persons = readPersons(vault, settings);
    expect(persons.map((person) => person.title).sort()).toEqual(['Erika', 'Stefan']);

    for (const person of persons) {
      // The tag the eligibility filter can be demonstrated with by typing one
      // word into a setting.
      expect(person.tags, person.title).toContain('Family');
      const front = frontmatterOf(note(person.title));
      expect(front[settings.personRolesProperty], person.title).toEqual(['traveller', 'eater']);
      expect(front.email, person.title).toContain('@example.invalid');
      // The block is what makes a merged vault's person note answer to both
      // plugins, and it is the only thing in the body.
      expect(carriesBlock(note(person.title).body, CUL_RELATED_ORDERS_BLOCK_LANG)).toBe(true);
      expect(note(person.title).ensureBlock).toBe(CUL_RELATED_ORDERS_BLOCK_LANG);
    }
  });

  it('is one company whose commercial terms read back', () => {
    const companies = readCompanies(vault, settings);
    expect(companies).toHaveLength(1);

    const terms = companies[0].terms;
    expect(terms.currency).toBe('CHF');
    expect(terms.shippingFee).toBe(9.9);
    expect(terms.freeShippingFrom).toBe(12);
    // A ladder counted in portions, sorted, with the rungs a hand-typed table
    // would carry.
    expect(terms.discountTiers).toEqual([
      { from: 12, percent: 5 },
      { from: 24, percent: 10 },
    ]);
    expect(terms.lines).toEqual(['Alltag', 'Sport', 'Weightloss']);
  });

  it('keeps the related-orders fence out of the last appliance', () => {
    // The trap this note exists to reproduce: the fence sits after the
    // reheating section with nothing following it, and every line of it used to
    // land inside the Microwave instruction.
    const microwave = reheatEntries('TomTasty AG').find(
      (entry) => entry.applianceId === 'microwave'
    );
    expect(microwave?.steps.join(' ')).not.toContain('`');
    expect(microwave?.steps.join(' ')).not.toContain(CUL_RELATED_ORDERS_BLOCK_LANG);
  });
});

describe('the plan the seeder would run', () => {
  it('writes everything into a vault holding none of it', () => {
    const plan = planSampleVault(notes, []);
    expect(plan.occupied).toEqual([]);
    expect(plan.unconfigured).toEqual([]);
    expect(sampleWriteCount(plan)).toBe(15);
    expect(sampleVaultWritable(plan)).toBe(true);
  });

  it('refuses the whole run over one note it did not put there', () => {
    // A folder this plugin owns outright. One stranger in it is evidence of a
    // real vault, and the run stops.
    const plan = planSampleVault(notes, [
      { folder: settings.mealsFolder, titles: ['Tom Yum Gai', 'My Dinner Ideas'] },
    ]);

    expect(plan.occupied).toEqual([
      { folder: settings.mealsFolder, strangers: ['My Dinner Ideas'] },
    ]);
    expect(plan.shared).toEqual([]);
    expect(sampleVaultWritable(plan)).toBe(false);
  });

  it('writes beside a sibling plugin company rather than refusing over it', () => {
    // The case that broke when all three seeders were run against one vault.
    // APERtrail seeds a travel operator into `CRM/Companies` and this plugin
    // seeds a meal supplier, and no contract says which companies a vault
    // holds, so whichever ran second called the other's company a stranger and
    // gave up on the entire seed. The folder is shared, so it is reported and
    // not refused.
    const plan = planSampleVault(notes, [
      { folder: settings.companiesFolder, titles: ['Rovos Rail Charters'] },
    ]);

    expect(plan.occupied).toEqual([]);
    expect(plan.shared).toEqual([
      { folder: settings.companiesFolder, others: ['Rovos Rail Charters'] },
    ]);
    // Nothing is skipped: this plugin's own company is still absent and still
    // gets written, beside the one that is already there.
    expect(sampleWriteCount(plan)).toBe(15);
    expect(sampleVaultWritable(plan)).toBe(true);
  });

  it('reports a stranger in the shared people folder the same forgiving way', () => {
    // The same rule on the folder it was originally written for. A third person
    // somebody added is not a reason to refuse either, and `CRM/People` only
    // looked like it needed no flag because all three plugins happen to seed
    // exactly these two.
    const plan = planSampleVault(notes, [
      { folder: settings.personsFolder, titles: ['Stefan', 'Erika', 'Anna'], withoutBlock: [] },
    ]);

    expect(plan.occupied).toEqual([]);
    expect(plan.shared).toEqual([{ folder: settings.personsFolder, others: ['Anna'] }]);
    expect(sampleVaultWritable(plan)).toBe(true);
  });

  it('marks the CRM notes shared and nothing else', () => {
    // The flag is what decides which folders forgive, so which notes carry it
    // is the whole rule. A meal or an order marked shared would quietly turn a
    // folder this plugin owns into one it does not.
    const shared = notes.filter((entry) => entry.shared).map((entry) => entry.title);
    expect(shared.sort()).toEqual(['Erika', 'Stefan', 'TomTasty AG']);

    for (const entry of notes) {
      const inCrm =
        entry.folder === settings.personsFolder || entry.folder === settings.companiesFolder;
      expect(Boolean(entry.shared), entry.title).toBe(inCrm);
    }
  });

  it('skips a person another plugin wrote and appends only the block', () => {
    // The shared-CRM case the whole feature is shaped around: seed the sibling
    // plugin first, seed this one second, and the one note ends up rendering in
    // both.
    const plan = planSampleVault(notes, [
      { folder: settings.personsFolder, titles: ['Stefan'], withoutBlock: ['Stefan'] },
    ]);

    const stefan = plan.notes.find((entry) => entry.note.title === 'Stefan');
    expect(stefan?.status).toBe('exists');
    expect(stefan?.augment).toBe(true);
    expect(sampleWriteCount(plan)).toBe(14);
    expect(sampleVaultWritable(plan)).toBe(true);
  });

  it('leaves a person who already carries the block completely alone', () => {
    const plan = planSampleVault(notes, [
      { folder: settings.personsFolder, titles: ['Stefan'], withoutBlock: [] },
    ]);

    const stefan = plan.notes.find((entry) => entry.note.title === 'Stefan');
    expect(stefan?.status).toBe('exists');
    expect(stefan?.augment).toBe(false);
  });

  it('refuses rather than seeding half a vault when a folder is unconfigured', () => {
    // A blank folder is a setting somebody cleared, and the notes reference each
    // other: a partial seed is a screen full of unresolved wikilinks that reads
    // as a broken plugin.
    const blank = mergeSettings({ mealsFolder: '' });
    const plan = planSampleVault(sampleNotes(blank, NOW), []);

    expect(plan.unconfigured.length).toBeGreaterThan(0);
    expect(sampleVaultWritable(plan)).toBe(false);
  });
});

describe('the block detector', () => {
  it('answers about a fence rather than about the word', () => {
    expect(carriesBlock('```culi-related-orders\n```', 'culi-related-orders')).toBe(true);
    expect(carriesBlock('~~~culi-related-orders\n~~~', 'culi-related-orders')).toBe(true);
    // A note that merely mentions the block, which a documentation-shaped note
    // genuinely does. Appending a second fence to it would be wrong, but so
    // would claiming it already renders one.
    expect(carriesBlock('Paste a culi-related-orders block here.', 'culi-related-orders')).toBe(
      false
    );
  });
});
