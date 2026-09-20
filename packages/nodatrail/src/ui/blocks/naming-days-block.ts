/**
 * `nod-day-entries`: which days wrote about this note.
 *
 * The third plugin's answer in a note none of them owns: APERtrail's
 * `travel-related-trips` says which trips somebody came on, NODAtrail's
 * `nod-spending` says what was spent at a company, and this says which days
 * named them. Each renders its own fence inside a note it does not own, and a
 * fence whose plugin is disabled shows as a plain code block rather than an
 * error.
 *
 * **A Person note is the first use and not the only one.** "Which days name
 * this note" is one question whatever the note is, so the same fence in a
 * **trip** note lists the days its seeded stops were written into. That is
 * §F.3 of `docs/design/day-entry-links.md`, and it cost no code: the answer was
 * already a link away.
 *
 * **An excursion note is the case that does not work**, and the reason is a
 * format question rather than a reading one: a seeded stop says the excursion
 * as its text and links only the trip, so nothing points at the excursion note
 * to be found by.
 *
 * **It answers about the note it is in.** No argument needed and none usually
 * given; `note:` is accepted for a block somebody has put somewhere else,
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
import { readDaysNaming } from '../../plan/read-naming-days';
import { emptyState, row } from '../kit/elements';
import { blockArgs, hostNote, type BlockDeps } from './context';

/** The note this block is about: the one it sits in, or the one it names. */
function subject(
  deps: BlockDeps,
  source: string,
  context: MarkdownPostProcessorContext
): TFile | null {
  const named = blockArgs(source).get('note');
  if (!named) return hostNote(deps.app, context);

  const file = deps.app.metadataCache.getFirstLinkpathDest(named, '');
  return file instanceof TFile ? file : null;
}

export async function renderNamingDaysBlock(
  deps: BlockDeps,
  source: string,
  element: HTMLElement,
  context: MarkdownPostProcessorContext
): Promise<void> {
  element.addClass('nod-block');

  const about = subject(deps, source, context);
  if (!about) {
    emptyState(element, t('day.noNamingDays'));
    return;
  }

  const found = await readDaysNaming(deps.app, deps.getSettings(), about);
  if (found.entries.length === 0) {
    emptyState(element, t('day.noNamingDays'));
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
      text: t('day.moreNamingDays', { count: String(found.more) }),
    });
  }
}
