/**
 * `nod-day-entries`, the block a Person note carries.
 *
 * The third plugin's answer in a note none of them owns: APERtrail's
 * `travel-related-trips` says which trips somebody came on, NODAtrail's
 * `nod-spending` says what was spent at a company, and this says when you last
 * spent an afternoon with them. Each renders its own fence inside a note it
 * does not own, and a fence whose plugin is disabled shows as a plain code
 * block rather than an error.
 *
 * **It answers about the note it is in.** No argument needed and none usually
 * given; `person:` is accepted for a block somebody has put somewhere else,
 * which is the same courtesy `nod-spending` extends.
 *
 * **A place note gets no block of its own**, deliberately. A restaurant already
 * carries APERtrail's trips block, and a second list answering nearly the same
 * question is two things to reconcile by eye. That decision is section H of
 * `docs/design/day-entry-links.md` and is worth revisiting only if the trips
 * block turns out to miss the ordinary Tuesday lunches, which is exactly what
 * it will miss.
 */
import { TFile, type MarkdownPostProcessorContext } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { readPersonDays } from '../../plan/read-person-days';
import { emptyState, row } from '../kit/elements';
import { blockArgs, hostNote, type BlockDeps } from './context';

/** The note this block is about: the one it sits in, or the one it names. */
function subject(
  deps: BlockDeps,
  source: string,
  context: MarkdownPostProcessorContext
): TFile | null {
  const named = blockArgs(source).get('person');
  if (!named) return hostNote(deps.app, context);

  const file = deps.app.metadataCache.getFirstLinkpathDest(named, '');
  return file instanceof TFile ? file : null;
}

export async function renderPersonDaysBlock(
  deps: BlockDeps,
  source: string,
  element: HTMLElement,
  context: MarkdownPostProcessorContext
): Promise<void> {
  element.addClass('nod-block');

  const person = subject(deps, source, context);
  if (!person) {
    emptyState(element, t('day.noPersonDays'));
    return;
  }

  const found = await readPersonDays(deps.app, deps.getSettings(), person);
  if (found.entries.length === 0) {
    emptyState(element, t('day.noPersonDays'));
    return;
  }

  for (const entry of found.entries) {
    row(element, {
      title: entry.record.label,
      // The day and the time, which is what somebody scanning this wants
      // first. The place goes in the chips beside it, where every other link
      // the entry carries goes.
      subtitle: [entry.day, entry.record.span].filter(Boolean).join(' · '),
      icon: 'calendar',
      onClick: () => void deps.openNote(entry.file),
    });
  }

  // Said rather than silently cut off. How many more there are is the number
  // worth knowing; scrolling through them is not.
  if (found.more > 0) {
    element.createDiv({
      cls: 'nod-block-note',
      text: t('day.morePersonDays', { count: String(found.more) }),
    });
  }
}
