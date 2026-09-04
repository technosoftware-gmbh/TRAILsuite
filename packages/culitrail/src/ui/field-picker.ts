/**
 * A button that names a frontmatter field, and a menu of the fields the meal
 * library actually has.
 *
 * A menu rather than a `<select>` because each entry carries a type icon, the
 * same icons Obsidian's own property panel uses, and an option element cannot
 * hold one. Typing a field name by hand stays possible: the menu offers that
 * as its last entry, because a filter on a property no note carries yet is a
 * reasonable thing to write.
 */
import { App, Menu, setIcon } from 'obsidian';
import { t } from '../lang/I18nManager';
import { DERIVED_FILTER_FIELDS } from '../meals/discovery/field-types';
import { describeField } from '../meals/discovery/field-summary';
import type { FieldDiscovery } from '../meals/discovery/types';
import type { FilterableType } from '../meals/discovery/field-types';
import { addFooterButtons, BaseModal } from './base-modal';

/** Obsidian's property-panel icon for a type, so the picker reads as familiar. */
export function typeIcon(type: FilterableType, isList = false): string {
  if (isList) return 'list';

  switch (type) {
    case 'date':
      return 'calendar';
    case 'number':
      return 'binary';
    case 'boolean':
      return 'check-square';
    case 'tag':
      return 'tag';
    default:
      return 'type';
  }
}

export interface FieldPickerOptions {
  app: App;
  /** The field key currently chosen. `#tag`-prefixed when it names a tag. */
  value: string;
  /** The scan the containing dialog took when it opened. */
  discovery: FieldDiscovery;
  /**
   * Whether tags are offered as `#tag` pseudo-fields. True for filters, which
   * can ask whether a meal has a tag; false for a badge, which renders a
   * property's value and has nothing to render for a tag.
   */
  includeTags?: boolean;
  /**
   * Whether the computed pseudo-fields are offered.
   *
   * True for filters, which can ask what a dish is; false for a badge, which
   * renders a property's value and has no property here to render.
   */
  includeDerived?: boolean;
  onChange: (field: string) => void;
}

/** A prompt for a property name no note carries yet. */
class CustomFieldModal extends BaseModal {
  private text = '';

  constructor(
    app: App,
    private readonly onAccept: (field: string) => void
  ) {
    super(app);
  }

  getTitle(): string {
    return t('ui.fieldPicker.customTitle');
  }

  getIcon(): string {
    return 'pencil';
  }

  renderBody(body: HTMLElement): void {
    body.createEl('p', { cls: 'culi-settings-note', text: t('ui.fieldPicker.customNote') });

    const input = body.createEl('input', {
      cls: 'culi-field-picker-custom-input',
      attr: { type: 'text', placeholder: t('ui.fieldPicker.customPlaceholder') },
    });
    input.addEventListener('input', () => {
      this.text = input.value.trim();
    });
    // Enter finishes a one-field dialog. Having to reach for the button after
    // typing a single word is the kind of friction that would make the picker
    // feel worse than the text box it replaces.
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || this.text === '') return;
      event.preventDefault();
      this.accept();
    });
    input.focus();
  }

  private accept(): void {
    this.onAccept(this.text);
    this.close();
  }

  renderFooter(footer: HTMLElement): void {
    addFooterButtons(footer, {
      confirmLabel: t('ui.fieldPicker.customConfirm'),
      onCancel: () => this.close(),
      onConfirm: () => this.accept(),
    });
  }
}

/**
 * Builds the picker button.
 *
 * The button repaints itself before `onChange` fires, so a caller that has to
 * rebuild the rest of its row (an operator list depends on the field's type)
 * can do that without also redrawing the button that was clicked.
 */
export function renderFieldPicker(
  parent: HTMLElement,
  options: FieldPickerOptions
): HTMLButtonElement {
  const { app, discovery, includeTags = false, includeDerived = false } = options;

  const button = parent.createEl('button', { cls: 'culi-field-picker-btn' });
  const icon = button.createSpan({ cls: 'culi-field-picker-icon' });
  const name = button.createSpan({ cls: 'culi-field-picker-name' });
  setIcon(button.createSpan({ cls: 'culi-field-picker-chevron' }), 'chevron-down');

  const paint = (field: string): void => {
    icon.empty();
    name.toggleClass('culi-field-picker-name--empty', field === '');

    if (field === '') {
      name.textContent = t('ui.fieldPicker.none');
      return;
    }

    if (field.startsWith('@')) {
      setIcon(icon, 'sparkles');
      name.textContent = t(`ui.fieldPicker.derived.${field.slice(1)}`);
      return;
    }

    const described = describeField(discovery, field);
    setIcon(icon, typeIcon(described.type, described.isList));
    name.textContent = field;
  };

  const choose = (field: string): void => {
    paint(field);
    options.onChange(field);
  };

  paint(options.value);

  button.addEventListener('click', (event) => {
    const menu = new Menu();

    for (const field of discovery.fields) {
      menu.addItem((item) =>
        item
          .setTitle(field.key)
          .setIcon(typeIcon(field.type, field.isList))
          .onClick(() => choose(field.key))
      );
    }

    // Before the tags and after the properties: it is a field, not a tag, and it
    // is the only entry in the menu that no scan could have found.
    if (includeDerived) {
      menu.addSeparator();
      for (const field of DERIVED_FILTER_FIELDS) {
        menu.addItem((item) =>
          item
            .setTitle(t(`ui.fieldPicker.derived.${field}`))
            .setIcon('sparkles')
            .onClick(() => choose(`@${field}`))
        );
      }
    }

    if (includeTags && discovery.tags.length > 0) {
      menu.addSeparator();
      for (const tag of discovery.tags) {
        menu.addItem((item) =>
          item
            .setTitle(`#${tag}`)
            .setIcon('tag')
            .onClick(() => choose(`#${tag}`))
        );
      }
    }

    // Always last, and always present: a scan of a vault with no meals in it
    // finds nothing, and an empty menu would look broken rather than empty.
    menu.addSeparator();
    menu.addItem((item) =>
      item
        .setTitle(t('ui.fieldPicker.custom'))
        .setIcon('pencil')
        .onClick(() => {
          new CustomFieldModal(app, (field) => {
            if (field !== '') choose(field);
          }).open();
        })
    );

    menu.showAtMouseEvent(event);
  });

  return button;
}
