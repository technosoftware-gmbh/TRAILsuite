/**
 * The eating-history chip and the log it opens.
 *
 * A reader. Recording a cook is **Mark as eaten** in the meal header, and
 * editing one is the same modal, so this deliberately offers no actions of its
 * own: a log is a thing to look at.
 *
 * One row per cook, and the row is built so nothing appears twice. The day, the
 * clock time, the rating and the person are four fields, each rendered once;
 * the note is whatever somebody wrote in addition to those, and is left out
 * entirely when there is nothing.
 */
import { App } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { BaseModal } from '../../ui/base-modal';
import type { EatingEntry } from '../parser/eating-history';
import { formatIsoDate } from '../view-model/format-date';
import { sectionBar, sectionButton } from './section-bar';

class EatingHistoryModal extends BaseModal {
  constructor(
    app: App,
    private readonly entries: EatingEntry[]
  ) {
    super(app);
  }

  getTitle(): string {
    return t('meals.eatingHistory.title');
  }

  getIcon(): string {
    return 'history';
  }

  renderBody(body: HTMLElement): void {
    if (this.entries.length === 0) {
      body.createDiv({ cls: 'culi-settings-note', text: t('meals.eatingHistory.empty') });
      return;
    }

    const list = body.createDiv({ cls: 'culi-eating-log' });

    for (const entry of this.entries) {
      const row = list.createDiv({ cls: 'culi-eating-log-row' });

      // Day and clock time in one element, so the pair cannot be split across a
      // wrap and read as two separate facts about the cook.
      row.createSpan({
        cls: 'culi-eating-log-date',
        text: [formatIsoDate(entry.date), entry.time].filter(Boolean).join(' · '),
      });

      if (entry.rating !== null) {
        // Filled stars only, rather than five with some empty. This is a log
        // of what happened, not a control, and a row of empty stars reads as
        // something to click.
        row.createSpan({
          cls: 'culi-eating-log-rating',
          text: '★'.repeat(Math.max(0, Math.round(entry.rating))),
        });
      }

      if (entry.person) row.createSpan({ cls: 'culi-eating-log-person', text: entry.person });

      if (entry.note) row.createSpan({ cls: 'culi-eating-log-note', text: entry.note });
    }
  }

  renderFooter(): void {
    // A reader, not a form. Obsidian's own close button is the only action.
  }
}

/**
 * Adds the chip to the section bar.
 *
 * Offered whenever the feature is enabled rather than only when the note
 * already holds a log. A chip that appears and disappears depending on the
 * meal makes the sidebar's contents unpredictable, and a reader who wants to
 * know whether anything is logged has to be able to ask.
 */
export function renderEatingHistoryButton(
  container: HTMLElement,
  app: App,
  entries: EatingEntry[],
  enabled: boolean
): void {
  if (!enabled) return;

  sectionButton(sectionBar(container), {
    icon: 'history',
    label: t('meals.eatingHistory.title'),
    count: entries.length,
    history: true,
    onClick: () => new EatingHistoryModal(app, entries).open(),
  });
}
