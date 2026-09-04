/**
 * The order the goal and project strips put their cards in, and the line the
 * cards show underneath.
 *
 * Priority first, because it is the claim somebody made about what matters.
 * The deadline breaks the tie, because among things that matter equally the one
 * due first is the one to look at. Both fall back the same way: **saying nothing
 * sorts after saying something**, so an undated goal goes below one due on
 * Friday rather than above it, and a goal with no priority goes below every goal
 * that states one.
 *
 * The meta line shows those same two facts, which is the point of the pair
 * arriving together: a card sorted by something it does not show is a card that
 * looks shuffled.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { byPriorityThenDeadline } from '../src/para/board';

const card = (title: string, priority: number | null, deadline: string | null) => ({
  title,
  file: null,
  archived: false,
  note: { priority, deadline },
});

const order = (cards: ReturnType<typeof card>[]) =>
  [...cards].sort(byPriorityThenDeadline).map((c) => c.title);

describe('the order of goals and projects', () => {
  it('puts the higher priority first', () => {
    // Named after the priority each one carries, so the expectation reads as
    // the rule rather than as an alphabet. The first version of this test was
    // written the other way round and failed on its own data.
    expect(
      order([card('third', 3, null), card('first', 1, null), card('second', 2, null)])
    ).toEqual(['first', 'second', 'third']);
  });

  it('breaks a tie on priority with the earlier deadline', () => {
    expect(order([card('later', 2, '2026-12-01'), card('sooner', 2, '2026-09-30')])).toEqual([
      'sooner',
      'later',
    ]);
  });

  /** Undated is not urgent. It is undated, and it goes below everything dated. */
  it('puts an undated note below a dated one of the same priority', () => {
    expect(order([card('undated', 2, null), card('friday', 2, '2026-09-04')])).toEqual([
      'friday',
      'undated',
    ]);
  });

  it('puts a note with no priority below every note that states one', () => {
    expect(order([card('none', null, '2026-01-01'), card('low', 4, '2026-12-31')])).toEqual([
      'low',
      'none',
    ]);
  });

  /** Priority outranks the deadline, rather than the other way round. */
  it('does not let an early deadline overtake a higher priority', () => {
    expect(
      order([card('urgent-ish', 3, '2026-09-01'), card('important', 1, '2027-06-30')])
    ).toEqual(['important', 'urgent-ish']);
  });

  it('is stable on the title when both facts agree', () => {
    expect(order([card('Beta', 2, '2026-09-30'), card('Alpha', 2, '2026-09-30')])).toEqual([
      'Alpha',
      'Beta',
    ]);
  });

  it('leaves a list of undated, unprioritised notes in title order', () => {
    expect(order([card('Zeta', null, null), card('Alpha', null, null)])).toEqual(['Alpha', 'Zeta']);
  });
});

describe('the line under a card', () => {
  const strips = readFileSync(
    join(__dirname, '..', 'src', 'ui', 'dashboard', 'para-strips.ts'),
    'utf8'
  );

  it('shows the two facts the strip is sorted by', () => {
    expect(strips).toContain('meta: paraMeta(goal.note.priority, goal.note.deadline)');
    expect(strips).toContain('meta: paraMeta(project.note.priority, project.note.deadline)');
  });

  /**
   * All three strips through one function.
   *
   * The area strip printed the raw number until 30 August 2026, so a dropdown
   * offering `Hoch` produced a card saying `Priorität 2`. That was left over
   * from before priority had names, not a reason for areas to read differently
   * from the two strips beside them. An area has no deadline, so it passes null
   * and gets the level alone.
   */
  it('says the level on an area too, not the raw number', () => {
    expect(strips).toContain('meta: paraMeta(area.note.priority, null)');
    expect(strips).not.toContain("`${t('para.priority')} ${String(area.note.priority)}`");
  });

  it('sorts both strips the same way', () => {
    expect(strips).toContain('[...goals].sort(byPriorityThenDeadline)');
    expect(strips).toContain('[...projects].sort(byPriorityThenDeadline)');
  });

  /**
   * A number outside the four levels is shown as itself. This vault numbers its
   * areas 1 to 8 by hand, and a note that borrowed the habit should read as what
   * it says rather than be rounded into a word it does not carry.
   */
  it('shows a priority outside the four levels as its number', () => {
    expect(strips).toContain('level ? t(`priority.${level}`) : String(priority)');
  });
});

describe('the strip', () => {
  const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8');

  it('lays the cards out six to a row rather than scrolling sideways', () => {
    expect(css).toContain('--nod-hero-columns: 6;');
    expect(css).toContain(
      'grid-template-columns: repeat(var(--nod-hero-columns), minmax(0, 1fr));'
    );
  });

  /**
   * The whole reason it changed. A sideways scroll suited four areas and hid
   * everything past the third of fifteen projects behind a gesture.
   */
  it('does not scroll sideways any more', () => {
    const rule = css.slice(css.indexOf('.nod-dashboard-strip {'));
    expect(rule.slice(0, rule.indexOf('}'))).not.toContain('overflow-x');
  });

  it('keeps the count in one place, so the narrow overrides restate only the number', () => {
    expect(css).toContain('--nod-hero-columns: 4;');
    expect(css).toContain('--nod-hero-columns: 2;');
    // One track list, three values for it.
    expect(css.split('grid-template-columns: repeat(var(--nod-hero-columns)').length - 1).toBe(1);
  });
});
