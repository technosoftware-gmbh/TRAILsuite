/**
 * One ship or named train, edited: its facts and its cabin catalogue.
 *
 * **Why this exists at all.** A cabin list is a list of maps, and Obsidian's
 * own property editor cannot edit one: it would be typed as YAML by hand,
 * which is this repository's definition of half a feature. The photo spot
 * answered the same problem with a block; a catalogue is short, changes
 * rarely, and is read far more often than it is written, so a command and a
 * dialog cost a fraction of a block and put the same thing within reach.
 *
 * **The facts sit here too**, for one reason: they are the fields somebody
 * fills in from the operator's page in one sitting, alongside the cabins, and
 * a dialog that made them retype the cabin names to correct a tonnage would be
 * a worse dialog than one long form.
 *
 * It was called the cabins dialog until the other entity types got editors of
 * their own, and the name was the only thing wrong with it: this IS the
 * vehicle's editor, and calling it after one of its sections left a ship as
 * the one note whose Edit button was hiding under another word.
 */
import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { ParsedVehicleCabin, VehicleInput } from '../vehicle-note';
import { updateVehicleNote } from '../write-vehicle';
import { coverFields } from '../../ui/components/cover-fields';
import { loadSummaryInto, saveNoteSummary } from '../../ui/components/summary-field';
import { CoverInput } from '../../vault/write-cover';
import { imageField } from '../../ui/components/image-field';
import { documentField } from '../../ui/components/document-field';

export class VehicleEditorModal extends Modal {
  private readonly value: VehicleInput;
  /**
   * The picture and the gallery, which used to be a second dialog.
   *
   * Without its description row: a ship carries its own one-line description,
   * written by its own schema and already on this form, and drawing the
   * cover's would be two boxes for one sentence.
   */
  private readonly cover: CoverInput;
  /** The note's summary callout, read off disk after the form has drawn. It is what her brochure prints. */
  private summary = '';

  constructor(
    app: App,
    private readonly settings: APERtrailSettings,
    private readonly file: TFile,
    initial: VehicleInput,
    initialCover: CoverInput,
    private readonly onSaved?: () => void
  ) {
    super(app);
    // A copy, and the cabins one by one: the caller's list is the board's own,
    // and the board is what the note is still being rendered from.
    this.value = { ...initial, cabins: initial.cabins.map((cabin) => ({ ...cabin })) };
    this.cover = { ...initialCover, gallery: initialCover.gallery.map((row) => ({ ...row })) };
  }

  onOpen(): void {
    this.render();
    loadSummaryInto(this.app, this.file, (summary) => {
      this.summary = summary;
      this.render();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('apt-item-editor');
    // Names the ship rather than one of its sections: this dialog edits the
    // whole note, and every other editor's title says which note it has open.
    contentEl.createEl('h2', {
      text: t('modals.common.editTitle', { title: this.file.basename }),
    });

    this.renderFacts(contentEl);
    coverFields(contentEl, {
      app: this.app,
      value: this.cover,
      notePath: () => this.file.path,
      refresh: () => this.render(),
      includeDescription: false,
      summary: {
        value: this.summary,
        onChange: (value) => {
          this.summary = value;
        },
      },
    });
    this.renderCabins(contentEl);

    new Setting(contentEl)
      .addButton((button) =>
        button.setButtonText(t('modals.tripEditor.cancel')).onClick(() => this.close())
      )
      .addButton((button) =>
        button
          .setButtonText(t('modals.tripEditor.save'))
          .setCta()
          .onClick(() => void this.save())
      );
  }

  private renderFacts(containerEl: HTMLElement): void {
    const text = (
      label: string,
      get: () => string | null,
      set: (value: string | null) => void
    ): void => {
      new Setting(containerEl).setName(label).addText((input) =>
        input.setValue(get() ?? '').onChange((raw) => {
          set(raw.trim() === '' ? null : raw);
        })
      );
    };

    new Setting(containerEl)
      .setName(t('modals.noteCover.description'))
      .setClass('apt-form-multiline')
      .setDesc(t('modals.vehicleCabins.descriptionDesc'))
      .addTextArea((input) =>
        input.setValue(this.value.description ?? '').onChange((raw) => {
          this.value.description = raw.trim() === '' ? null : raw;
        })
      );

    text(
      t('modals.newVehicleModal.operatorField'),
      () => this.value.operatorTitle,
      (value) => {
        this.value.operatorTitle = value;
      }
    );
    text(
      t('fieldNames.built'),
      () => this.value.built,
      (value) => {
        this.value.built = value;
      }
    );
    text(
      t('fieldNames.refurbished'),
      () => this.value.refurbished,
      (value) => {
        this.value.refurbished = value;
      }
    );
    new Setting(containerEl).setName(t('fieldNames.capacity')).addText((input) =>
      input
        .setValue(this.value.capacity === null ? '' : String(this.value.capacity))
        .onChange((raw) => {
          const parsed = Number(raw.trim());
          this.value.capacity = raw.trim() === '' || !Number.isFinite(parsed) ? null : parsed;
        })
    );
    text(
      t('fieldNames.length'),
      () => this.value.length,
      (value) => {
        this.value.length = value;
      }
    );
    text(
      t('fieldNames.tonnage'),
      () => this.value.tonnage,
      (value) => {
        this.value.tonnage = value;
      }
    );
    text(
      t('fieldNames.website'),
      () => this.value.website,
      (value) => {
        this.value.website = value;
      }
    );
    // It was a path typed by hand, on the argument that Obsidian's own file
    // suggester is for links in a note's body and this is a frontmatter value.
    // True, and it left the one field on the page whose value has to be exact
    // as the only one you had to go and look up somewhere else first. The
    // suggester here is this plugin's own, over the files the vault holds.
    documentField(containerEl, {
      app: this.app,
      label: t('fieldNames.deckPlan'),
      description: t('modals.vehicleCabins.deckPlanDesc'),
      placeholder: t('modals.vehicleCabins.deckPlanPlaceholder'),
      get: () => this.value.deckPlan ?? '',
      set: (value) => {
        this.value.deckPlan = value === '' ? null : value;
      },
      refresh: () => this.render(),
      notePath: () => this.file.path,
    });
  }

  private renderCabins(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName(t('modals.vehicleCabins.cabins'))
      .setDesc(t('modals.vehicleCabins.cabinsDesc'))
      .addButton((button) =>
        button.setButtonText(t('modals.vehicleCabins.addCabin')).onClick(() => {
          this.value.cabins.push({ name: '', description: null, image: null });
          this.render();
        })
      );

    this.value.cabins.forEach((cabin, index) => {
      // Numbered, because the two rows below carry the same labels for every
      // cabin and a fourth set appearing under the third otherwise reads as
      // nothing having happened.
      new Setting(containerEl)
        .setName(t('modals.vehicleCabins.cabinNumber', { number: index + 1 }))
        .setHeading();

      new Setting(containerEl)
        .setName(t('modals.tripEditor.variantName'))
        .addText((input) =>
          input
            .setPlaceholder(t('modals.vehicleCabins.cabinPlaceholder'))
            .setValue(cabin.name)
            .onChange((raw) => {
              cabin.name = raw;
            })
        )
        .addExtraButton((button) =>
          button
            .setIcon('trash-2')
            .setTooltip(t('modals.vehicleCabins.removeCabin'))
            .onClick(() => {
              this.value.cabins.splice(index, 1);
              this.render();
            })
        );

      new Setting(containerEl)
        .setName(t('modals.tripEditor.variantDescription'))
        .setClass('apt-form-multiline')
        .addTextArea((input) =>
          input.setValue(cabin.description ?? '').onChange((raw) => {
            cabin.description = raw.trim() === '' ? null : raw;
          })
        );

      // "Nothing is uploaded here, because a cabin photograph comes off the
      // operator's own page" was the reason given, and it argues for the URL
      // the box still accepts rather than against the two buttons. A picture
      // saved off that page is on the disk, and the step that was missing was
      // getting it into the vault.
      imageField(containerEl, {
        app: this.app,
        label: t('modals.vehicleCabins.cabinImage'),
        description: t('modals.vehicleCabins.cabinImageDesc'),
        get: () => cabin.image ?? '',
        set: (value) => {
          cabin.image = value === '' ? null : value;
        },
        refresh: () => this.render(),
        notePath: () => this.file.path,
      });
    });
  }

  private async save(): Promise<void> {
    // A cabin with no name is dropped rather than refused: it is a row
    // somebody opened and left, and the name is what a trip's variant matches
    // on, so a nameless one could never be referred to anyway.
    const named: ParsedVehicleCabin[] = this.value.cabins.filter(
      (cabin) => cabin.name.trim() !== ''
    );
    try {
      await updateVehicleNote(
        this.app,
        this.settings,
        this.file,
        { ...this.value, cabins: named },
        this.cover
      );
      // Inside the same try, for the place editor's reason: properties saved
      // and text not is a half-saved note.
      await saveNoteSummary(this.app, this.file, this.summary);
      new Notice(t('modals.vehicleCabins.saved'));
      this.onSaved?.();
      this.close();
    } catch (err) {
      new Notice(err instanceof Error ? err.message : t('modals.vehicleCabins.saveFailed'));
    }
  }
}
