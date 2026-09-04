/**
 * The priority row, in the two shapes the vault records it.
 *
 * A free function taking a container and a get/set pair, which is how
 * `imageField` and `documentField` beside it are built -- and the reason is the
 * same here as there: the three PARA forms are separate classes sharing no base
 * of their own, and the capture dialog is not a PARA form at all.
 *
 * **One vocabulary, two formats.** The core's four levels are what somebody
 * picks; a PARA note stores the number behind the level, and a task stores the
 * Obsidian Tasks marker. See `priority.ts` in the core for why those are the
 * two, and why writing four of five task levels is deliberate.
 */
import { Setting } from 'obsidian';
import {
  PRIORITY_LEVELS,
  priorityLevelOf,
  priorityNumber,
  taskPriorityLevel,
  type PriorityLevel,
  type TaskPriority,
} from 'trail-core';
import { t } from '../../lang/I18nManager';

function levelChoices(extra?: [string, string]): [string, string][] {
  const choices: [string, string][] = [
    ['', t('common.none')],
    ...PRIORITY_LEVELS.map((level): [string, string] => [level, t(`priority.${level}`)]),
  ];
  if (extra) choices.push(extra);
  return choices;
}

function dropdown(
  container: HTMLElement,
  choices: readonly [string, string][],
  value: string,
  onChange: (value: string) => void
): void {
  new Setting(container).setName(t('para.priority')).addDropdown((select) => {
    for (const [option, label] of choices) select.addOption(option, label);
    select.setValue(value).onChange(onChange);
  });
}

/**
 * A PARA note's priority, stored as the number that also orders it.
 *
 * **A note carrying a number outside 1 to 4 is offered as that number**, not as
 * a level it is not. Those are the notes ranked by hand rather than graded, and
 * choosing nothing has to leave such a note exactly as it was. Only picking a
 * level replaces it.
 *
 * This used to cite the reference vault's areas as being numbered 1 to 8. They
 * are not: **the folder names carry that sequence** (`1 Gesundheit` to
 * `8 Beruf`) and the `priority:` values are 1, 2, 2 and 4. The rule stands on
 * its own -- a number the four levels do not name has to survive being looked
 * at -- but it was resting on a misread of a folder listing.
 */
export function numberPriorityField(
  container: HTMLElement,
  get: () => number | null,
  set: (value: number | null) => void
): void {
  const current = get();
  const outside = current !== null && priorityLevelOf(current) === null;

  dropdown(
    container,
    levelChoices(outside ? [String(current), String(current)] : undefined),
    current === null ? '' : (priorityLevelOf(current) ?? String(current)),
    (value) => {
      if (value === '') return set(null);
      const level = PRIORITY_LEVELS.find((candidate) => candidate === value);
      set(level ? priorityNumber(level) : Number(value));
    }
  );
}

/**
 * A task's priority, stored as the Tasks plugin's own marker.
 *
 * A line marked `lowest` -- which this never writes -- shows as `low`, the
 * nearest true thing. An empty box would erase the marker on the next save.
 */
export function taskPriorityField(
  container: HTMLElement,
  get: () => PriorityLevel | null,
  set: (value: PriorityLevel | null) => void
): void {
  dropdown(container, levelChoices(), get() ?? '', (value) => {
    set(PRIORITY_LEVELS.find((candidate) => candidate === value) ?? null);
  });
}

/** What a form should show for a task line it is editing. */
export function levelOfTask(priority: TaskPriority | null): PriorityLevel | null {
  return taskPriorityLevel(priority);
}
