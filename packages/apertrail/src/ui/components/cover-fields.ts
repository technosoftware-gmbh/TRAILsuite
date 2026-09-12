/**
 * What a note presents, as the rows every editor draws: the line under its
 * title, the picture that stands for it, its highlights, its summary and its
 * gallery.
 *
 * **The order and the words are the trip editor's**, because a trip had all
 * five first and everything else grew a subset of them under different
 * labels. Two forms asking the same question in two orders, one calling it
 * "Kurz gesagt" and the other "Untertitel", is how somebody comes to believe
 * they are two fields. The labels now come from one set of keys rather than
 * from two that happen to agree.
 *
 * Still called the cover, which is the smaller half of what it holds. See
 * `vault/write-cover.ts` for why the name stayed.
 *
 * These lived in a dialog of their own, and that dialog existed for a reason
 * that has since expired. Its docstring put it plainly: the question "what
 * does this note look like" is the same question for a ship, a hotel, a
 * landmark, a city, a state and a country, so it should be one surface rather
 * than six saying the same thing six ways. True -- and when nothing else could
 * edit those notes, one dialog was the only way to have it.
 *
 * Every one of those notes has an editor now. Keeping the cover separate left
 * a country with two buttons, of which the smaller one held a single field
 * and the larger one was not named after the note. So the sharing moved down
 * a level: this is the section, and each editor draws it.
 *
 * **A gallery is a list of maps**, which is what made a dialog necessary in
 * the first place: Obsidian's own property editor cannot edit one, so without
 * this it is YAML typed by hand.
 */
import { App, Setting } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { imageField } from './image-field';
import { galleryRows, GalleryFieldOptions, GalleryRow, uploadIntoGallery } from './gallery-field';
import { CoverInput } from '../../vault/write-cover';
import { summaryField, SummaryFieldOptions } from './summary-field';

export interface CoverFieldsOptions {
  app: App;
  /** Mutated in place, and saved by the editor that owns it. */
  value: CoverInput;
  /** Where an uploaded picture lands is the vault's decision, and it decides from the note. */
  notePath: () => string;
  /** Redraw, after a picker or an upload changes what the rows should show. */
  refresh: () => void;
  /**
   * A ship carries its own one-line description, written by its own schema
   * and already on its form, so drawing this one would be two boxes for one
   * sentence. Everything else takes the whole run.
   */
  includeDescription?: boolean;
  /**
   * The long summary, in the trip editor's own position: after the
   * highlights, before the gallery.
   *
   * Not a cover row, and it is not written through `CoverInput`: it is the
   * note's own body, and the editor saves it separately. It is drawn from
   * here so that one function decides the order of all five rather than each
   * editor deciding again.
   *
   * Omitted while a note is being created, which is every caller's own
   * condition already: there is no body to read a summary out of yet.
   */
  summary?: SummaryFieldOptions;
}

export function coverFields(container: HTMLElement, options: CoverFieldsOptions): void {
  if (options.includeDescription !== false) {
    new Setting(container)
      .setName(t('modals.noteCover.description'))
      .setDesc(t('modals.noteCover.descriptionHint'))
      .addText((text) =>
        text.setValue(options.value.description ?? '').onChange((raw) => {
          options.value.description = raw.trim() === '' ? null : raw;
        })
      );
  }

  imageField(container, {
    app: options.app,
    label: t('modals.noteCover.image'),
    get: () => options.value.image,
    set: (value) => {
      options.value.image = value;
    },
    refresh: options.refresh,
    notePath: options.notePath,
  });

  highlightsField(container, options);

  if (options.summary) summaryField(container, options.summary);

  const gallery = galleryOptions(options);

  new Setting(container)
    .setName(t('modals.noteCover.gallery'))
    .setDesc(t('modals.noteCover.galleryHint'))
    .addExtraButton((button) =>
      button
        .setIcon('upload')
        .setTooltip(t('modals.common.imageUploadButton'))
        .onClick(() => void uploadIntoGallery(gallery))
    )
    .addButton((button) =>
      button
        .setIcon('plus')
        .setTooltip(t('modals.tripEditor.galleryAdd'))
        .onClick(() => {
          options.value.gallery.push({ image: '', caption: null });
          options.refresh();
        })
    );

  galleryRows(container, gallery);
}

/**
 * One line per highlight, which is how the trip editor has always taken them
 * and what makes reordering them a matter of moving a line.
 *
 * Split on save rather than on every keystroke: a box that dropped an empty
 * line as you typed would take the blank line back out from under the cursor
 * the moment you pressed return.
 */
function highlightsField(container: HTMLElement, options: CoverFieldsOptions): void {
  new Setting(container)
    .setName(t('modals.noteCover.highlights'))
    .setClass('apt-form-multiline')
    .setDesc(t('modals.noteCover.highlightsHint'))
    .addTextArea((area) => {
      area.inputEl.rows = 4;
      area.setValue(options.value.highlights.join('\n')).onChange((raw) => {
        options.value.highlights = raw.split('\n');
      });
    });
}

function galleryOptions(options: CoverFieldsOptions): GalleryFieldOptions {
  const gallery: GalleryRow[] = options.value.gallery;
  return {
    app: options.app,
    gallery,
    notePath: options.notePath,
    refresh: options.refresh,
    labels: {
      field: t('modals.noteCover.gallery'),
      hint: t('modals.noteCover.galleryHint'),
      add: t('modals.tripEditor.galleryAdd'),
      empty: t('modals.noteCover.galleryEmpty'),
      caption: t('modals.tripEditor.galleryCaption'),
      remove: t('modals.tripEditor.galleryRemove'),
      moveUp: t('modals.tripEditor.moveUp'),
      moveDown: t('modals.tripEditor.moveDown'),
    },
  };
}

/** The cover a record already read, as the shape these rows edit. A copy: the caller's list is the board's own. */
export function coverInputOf(record: {
  description: string | null;
  image: string | null;
  gallery: GalleryRow[];
  highlights: string[];
}): CoverInput {
  return {
    description: record.description,
    image: record.image,
    gallery: record.gallery.map((row) => ({ ...row })),
    highlights: [...record.highlights],
  };
}
