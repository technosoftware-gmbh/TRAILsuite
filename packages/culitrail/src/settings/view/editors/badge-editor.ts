/**
 * The header-badge list.
 *
 * Order matters here in a way it does not in an ordinary settings list: the
 * list is the header's layout, and the two non-badge entry types
 * (`separator`, `newline`) exist only to arrange the ones around them. That
 * is why arranging the header is this list rather than a second setting.
 *
 * A built-in badge can be edited and disabled but not deleted, and its label
 * is a translation key until somebody types over it. Both rules are about the
 * same thing: a built-in that could be lost or frozen into one language would
 * be unrecoverable without editing `data.json` by hand.
 */
import { App, Setting } from 'obsidian';
import { t } from '../../../lang/I18nManager';
import { discoverMealFields } from '../../../meals/discovery/scan-fields';
import type { FieldDiscovery } from '../../../meals/discovery/types';
import { addFooterButtons, BaseModal } from '../../../ui/base-modal';
import { renderFieldPicker } from '../../../ui/field-picker';
import type {
  BadgeColor,
  BadgeType,
  BadgeValueType,
  CULItrailSettings,
  CustomBadge,
} from '../../types';
import { renderListEditor } from '../../../ui/list-editor';
import type { SettingsTabContext } from '../settings-tab';

const COLORS: BadgeColor[] = ['default', 'green', 'blue', 'purple', 'yellow', 'red'];

/**
 * What a badge is called on the list.
 *
 * `label` beats `labelKey`, which is how editing a built-in's label works:
 * the edit sets `label`, and from then on it is shown as typed rather than as
 * translated.
 */
export function badgeName(badge: CustomBadge): string {
  if (badge.type === 'separator') return t('settings.badges.separator');
  if (badge.type === 'newline') return t('settings.badges.newline');
  if (badge.label) return badge.label;
  return badge.labelKey ? t(badge.labelKey) : badge.property;
}

function colorLabel(color: BadgeColor): string {
  switch (color) {
    case 'green':
      return t('settings.badges.colorGreen');
    case 'blue':
      return t('settings.badges.colorBlue');
    case 'purple':
      return t('settings.badges.colorPurple');
    case 'yellow':
      return t('settings.badges.colorYellow');
    case 'red':
      return t('settings.badges.colorRed');
    case 'default':
    default:
      return t('settings.badges.colorDefault');
  }
}

export function renderBadgeEditor(container: HTMLElement, context: SettingsTabContext): void {
  const { settings } = context;

  const save = (badges: CustomBadge[]): void => {
    settings.headerBadges = badges;
    void context.save();
    context.refresh();
  };

  renderListEditor<CustomBadge>(container, {
    items: settings.headerBadges,
    // A built-in is kept and disabled rather than removed.
    isRemovable: (badge) => !badge.builtin,
    addLabel: t('settings.badges.add'),
    onAdd: () => ({
      type: 'badge',
      property: '',
      label: t('settings.badges.newBadge'),
      color: 'default',
      valueType: 'auto',
      splitArray: false,
      enabled: true,
      builtin: false,
    }),
    onChange: save,
    renderItem: (row, badge, index) => {
      row.createSpan({ cls: 'culi-list-name', text: badgeName(badge) });

      if (badge.type === 'badge' || badge.type === undefined) {
        row.createSpan({
          cls: 'culi-list-detail',
          text: badge.property || t('settings.badges.noProperty'),
        });
      }

      const toggle = row.createEl('input', { attr: { type: 'checkbox' } });
      toggle.checked = badge.enabled;
      toggle.setAttr('aria-label', t('settings.badges.enabled'));
      toggle.addEventListener('change', () => {
        const next = [...settings.headerBadges];
        next[index] = { ...badge, enabled: toggle.checked };
        settings.headerBadges = next;
        void context.save();
      });

      const edit = row.createEl('button', { cls: 'culi-list-edit', text: t('settings.list.edit') });
      edit.addEventListener('click', () => {
        new BadgeModal(context.app, badge, settings, (edited) => {
          const next = [...settings.headerBadges];
          next[index] = edited;
          save(next);
        }).open();
      });
    },
  });
}

/** One badge's fields. A modal rather than inline rows: a badge has nine of them. */
class BadgeModal extends BaseModal {
  private readonly draft: CustomBadge;
  /** The library's fields as of this dialog opening. See `ModeModal` for why it is not cached. */
  private readonly discovery: FieldDiscovery;

  constructor(
    app: App,
    badge: CustomBadge,
    settings: CULItrailSettings,
    private readonly onSave: (badge: CustomBadge) => void
  ) {
    super(app);
    this.draft = { ...badge };
    this.discovery = discoverMealFields(app, settings);
  }

  getTitle(): string {
    return t('settings.badges.editBadge');
  }

  getIcon(): string {
    return 'tag';
  }

  renderBody(body: HTMLElement): void {
    new Setting(body).setName(t('settings.badges.type')).addDropdown((dropdown) => {
      dropdown.addOption('badge', t('settings.badges.typeBadge'));
      dropdown.addOption('separator', t('settings.badges.separator'));
      dropdown.addOption('newline', t('settings.badges.newline'));
      dropdown.setValue(this.draft.type ?? 'badge');
      dropdown.onChange((value) => {
        this.draft.type = value as BadgeType;
      });
    });

    new Setting(body)
      .setName(t('settings.badges.label'))
      // The built-in case is the interesting one: leaving this blank keeps the
      // translated name, and typing anything freezes it as typed.
      .setDesc(this.draft.builtin ? t('settings.badges.labelBuiltinDesc') : '')
      .addText((text) =>
        text.setValue(this.draft.label ?? '').onChange((value) => {
          this.draft.label = value.trim() || undefined;
        })
      );

    // A computed badge has no property and no formula to offer. Both rows are
    // left out rather than shown disabled: a picker that cannot be used still
    // invites somebody to try, and setting a property on one of these would
    // silently do nothing, since the computed value wins.
    if (this.draft.derived) {
      body.createEl('p', {
        cls: 'culi-settings-note',
        text: t('settings.badges.derivedDesc'),
      });
    } else {
      // A picker rather than a text field, and no tags in it: a badge renders a
      // property's value, and a tag is something a meal has rather than a value
      // it holds.
      new Setting(body)
        .setName(t('settings.badges.property'))
        .setDesc(t('settings.badges.propertyDesc'))
        .then((setting) => {
          renderFieldPicker(setting.controlEl, {
            app: this.app,
            value: this.draft.property,
            discovery: this.discovery,
            onChange: (field) => {
              this.draft.property = field;
            },
          });
        });

      new Setting(body)
        .setName(t('settings.badges.formula'))
        .setDesc(t('settings.badges.formulaDesc'))
        .addText((text) =>
          text.setValue(this.draft.formula ?? '').onChange((value) => {
            this.draft.formula = value.trim() || undefined;
          })
        );
    }

    // Both of these apply to a badge shown as a pill and are ignored by one shown
    // as a column in the figure strip, which has no background to tint and no
    // room for an icon above a two-line cell. Said here rather than left for
    // somebody to discover by picking an icon and seeing nothing happen: which
    // form a badge takes is derived from its own shape, so this is not something
    // they chose and can undo.
    new Setting(body)
      .setName(t('settings.badges.icon'))
      .setDesc(t('settings.badges.chipOnlyDesc'))
      .addText((text) =>
        text.setValue(this.draft.icon ?? '').onChange((value) => {
          this.draft.icon = value.trim() || undefined;
        })
      );

    new Setting(body)
      .setName(t('settings.badges.color'))
      .setDesc(t('settings.badges.chipOnlyDesc'))
      .addDropdown((dropdown) => {
        for (const color of COLORS) dropdown.addOption(color, colorLabel(color));
        dropdown.setValue(this.draft.color);
        dropdown.onChange((value) => (this.draft.color = value as BadgeColor));
      });

    this.renderValueColors(body);

    new Setting(body)
      .setName(t('settings.badges.valueType'))
      .setDesc(t('settings.badges.valueTypeDesc'))
      .addDropdown((dropdown) => {
        dropdown.addOption('auto', t('settings.badges.valueAuto'));
        dropdown.addOption('minutes', t('settings.badges.valueMinutes'));
        dropdown.setValue(this.draft.valueType);
        dropdown.onChange((value) => (this.draft.valueType = value as BadgeValueType));
      });

    new Setting(body)
      .setName(t('settings.badges.splitArray'))
      .setDesc(t('settings.badges.splitArrayDesc'))
      .addToggle((toggle) =>
        toggle.setValue(this.draft.splitArray).onChange((value) => (this.draft.splitArray = value))
      );

    new Setting(body)
      .setName(t('settings.badges.hideLabel'))
      .setDesc(t('settings.badges.hideLabelDesc'))
      .addToggle((toggle) =>
        toggle.setValue(this.draft.hideLabel ?? false).onChange((value) => {
          this.draft.hideLabel = value || undefined;
        })
      );

    new Setting(body).setName(t('settings.badges.prefix')).addText((text) =>
      text.setValue(this.draft.prefix ?? '').onChange((value) => {
        this.draft.prefix = value || undefined;
      })
    );

    new Setting(body).setName(t('settings.badges.suffix')).addText((text) =>
      text.setValue(this.draft.suffix ?? '').onChange((value) => {
        this.draft.suffix = value || undefined;
      })
    );
  }

  renderFooter(footer: HTMLElement): void {
    addFooterButtons(footer, {
      confirmLabel: t('settings.list.save'),
      onCancel: () => this.close(),
      onConfirm: () => {
        this.onSave(this.draft);
        this.close();
      },
    });
  }

  /**
   * A colour per value, for a badge holding a small vocabulary.
   *
   * Offered for every badge rather than only for `splitArray` ones: a badge
   * showing one value at a time still has a vocabulary, and `diet` was one
   * before it was ever split. What it is *not* offered as is a free colour –
   * the five names plus `default` are the whole set, so a colour chosen here is
   * one the stylesheet has a `culi-badge-` rule for.
   */
  private renderValueColors(body: HTMLElement): void {
    const section = body.createDiv();

    const draw = (): void => {
      section.empty();

      const entries = Object.entries(this.draft.valueColors ?? {});

      for (const [value, color] of entries) {
        new Setting(section)
          .setName(value)
          .addDropdown((dropdown) => {
            for (const option of COLORS) dropdown.addOption(option, colorLabel(option));
            dropdown.setValue(color);
            dropdown.onChange((next) => {
              this.draft.valueColors = { ...this.draft.valueColors, [value]: next as BadgeColor };
            });
          })
          .addExtraButton((button) =>
            button
              .setIcon('trash-2')
              .setTooltip(t('settings.badges.valueColorRemove'))
              .onClick(() => {
                const rest = { ...this.draft.valueColors };
                delete rest[value];
                // Undefined rather than an empty object, so a map somebody
                // emptied does not persist as `{}` and read as configured.
                this.draft.valueColors = Object.keys(rest).length > 0 ? rest : undefined;
                draw();
              })
          );
      }

      let pending = '';
      new Setting(section)
        .setName(t('settings.badges.valueColors'))
        .setDesc(t('settings.badges.valueColorsDesc'))
        .addText((text) =>
          text
            .setPlaceholder(t('settings.badges.valueColorPlaceholder'))
            .onChange((value) => (pending = value))
        )
        .addButton((button) =>
          button.setButtonText(t('settings.badges.valueColorAdd')).onClick(() => {
            const value = pending.trim();
            // A blank value would key the map on nothing and match nothing.
            if (!value) return;
            this.draft.valueColors = { ...this.draft.valueColors, [value]: this.draft.color };
            draw();
          })
        );
    };

    draw();
  }
}
