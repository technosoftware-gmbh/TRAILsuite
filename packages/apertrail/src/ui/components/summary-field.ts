/**
 * The long summary, as the row every editor draws and the write behind it.
 *
 * The one-line `description` says what a note is in a subtitle's worth of
 * words; this is the paragraph, or the page, underneath it. It lives in the
 * note's **body**, as a summary callout, which is why it is not a field on any
 * of the writers in `write-*.ts`: those touch frontmatter, and the promise
 * they make is that a dialog never rewrites the text of a note.
 *
 * **The box holds the whole callout, lists included.** The prospect and the
 * trip document print exactly this and nothing else from the note, so what
 * somebody edits here is what comes out on paper. Text below the callout is
 * their own working notes and reaches no sheet, which is the decision that
 * made a field for the whole block the right shape rather than a field per
 * heading.
 *
 * The trip editor had this row first, alone, and its label and hint were
 * written as a trip's. They are not: every note in this vault may carry the
 * block, and six editors saying the same thing six ways is what
 * `cover-fields.ts` next door was extracted to stop.
 */
import { App, Notice, Setting, TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { loadNoteSummary, writeNoteSummary } from '../../shared/note-summary';

export interface SummaryFieldOptions {
  /** The text as the form has it now. */
  value: string;
  onChange: (value: string) => void;
}

/** The row. Six lines tall, because it is the longest thing on any of these forms. */
export function summaryField(container: HTMLElement, options: SummaryFieldOptions): void {
  new Setting(container)
    .setName(t('modals.noteSummary.field'))
    .setClass('apt-form-multiline')
    .setDesc(t('modals.noteSummary.hint'))
    .addTextArea((area) => {
      area.inputEl.rows = 6;
      area.inputEl.addClass('apt-note-summary');
      area.setValue(options.value).onChange(options.onChange);
    });
}

/**
 * Reads the summary out of a note and hands it back, for a form that has
 * already drawn.
 *
 * The summary is body text, so getting it means going to disk, and no
 * constructor can await. Every one of these dialogs draws without it and
 * redraws when it arrives rather than making somebody wait on a file read
 * before they can type a title.
 *
 * **A note with no summary never redraws.** There would be nothing new to
 * show, and a redraw a fraction of a second in takes back whatever was typed
 * into the first field in the meantime.
 */
export function loadSummaryInto(app: App, file: TFile, arrived: (summary: string) => void): void {
  void loadNoteSummary(app, file).then((summary) => {
    if (summary !== '') arrived(summary);
  });
}

/**
 * Writes the summary and says so when the note holds more than one.
 *
 * Everything that reads a summary takes the first callout: this form, the
 * prospect, the trip document. A second one is therefore text that is never
 * shown, never printed and never edited, and nothing about the note looks
 * wrong -- which is exactly the case worth a sentence rather than silence.
 * The first is still what gets edited; refusing the save would block an edit
 * over what is almost always a paste that went in twice.
 */
export async function saveNoteSummary(app: App, file: TFile, summary: string): Promise<void> {
  const { ignored } = await writeNoteSummary(app, file, summary);
  if (ignored > 0) new Notice(t('modals.noteSummary.extraCallouts'));
}
