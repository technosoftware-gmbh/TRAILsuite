/**
 * The cabin catalogue of one ship or named train, edited.
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
 */
import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { ParsedVehicleCabin, VehicleInput } from '../vehicle-note';
import { updateVehicleNote } from '../write-vehicle';

export class VehicleCabinsModal extends Modal {
  private readonly value: VehicleInput;

  constructor(
    app: App,
    private readonly settings: APERtrailSettings,
    private readonly file: TFile,
    initial: VehicleInput,
    private readonly onSaved?: () => void
  ) {
    super(app);
    // A copy, and the cabins one by one: the caller's list is the board's own,
    // and the board is what the note is still being rendered from.
    this.value = { ...initial, cabins: initial.cabins.map((cabin) => ({ ...cabin })) };
  }

  onOpen(): void {
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('apt-item-editor');
    contentEl.createEl('h2', { text: t('modals.vehicleCabins.title') });

    this.renderFacts(contentEl);
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

    text(
      t('modals.newVehicleModal.operatorField'),
      () => this.value.operatorTitle,
      (value) => {
        this.value.operatorTitle = value;
      }
    );
    text(
      t('settings.properties.fields.vehicleBuilt.name'),
      () => this.value.built,
      (value) => {
        this.value.built = value;
      }
    );
    text(
      t('settings.properties.fields.vehicleRefurbished.name'),
      () => this.value.refurbished,
      (value) => {
        this.value.refurbished = value;
      }
    );
    new Setting(containerEl)
      .setName(t('settings.properties.fields.vehicleCapacity.name'))
      .addText((input) =>
        input
          .setValue(this.value.capacity === null ? '' : String(this.value.capacity))
          .onChange((raw) => {
            const parsed = Number(raw.trim());
            this.value.capacity = raw.trim() === '' || !Number.isFinite(parsed) ? null : parsed;
          })
      );
    text(
      t('settings.properties.fields.vehicleLength.name'),
      () => this.value.length,
      (value) => {
        this.value.length = value;
      }
    );
    text(
      t('settings.properties.fields.vehicleTonnage.name'),
      () => this.value.tonnage,
      (value) => {
        this.value.tonnage = value;
      }
    );
    text(
      t('settings.properties.fields.website.name'),
      () => this.value.website,
      (value) => {
        this.value.website = value;
      }
    );
  }

  private renderCabins(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName(t('modals.vehicleCabins.cabins'))
      .setDesc(t('modals.vehicleCabins.cabinsDesc'))
      .addButton((button) =>
        button.setButtonText(t('modals.vehicleCabins.addCabin')).onClick(() => {
          this.value.cabins.push({ name: '', description: null });
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
        .addTextArea((input) =>
          input.setValue(cabin.description ?? '').onChange((raw) => {
            cabin.description = raw.trim() === '' ? null : raw;
          })
        );
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
      await updateVehicleNote(this.app, this.settings, this.file, {
        ...this.value,
        cabins: named,
      });
      new Notice(t('modals.vehicleCabins.saved'));
      this.onSaved?.();
      this.close();
    } catch (err) {
      new Notice(err instanceof Error ? err.message : t('modals.vehicleCabins.saveFailed'));
    }
  }
}
