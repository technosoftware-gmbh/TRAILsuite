/**
 * Just enough of Obsidian's DOM and `Setting` to drive an editor modal in a
 * unit test.
 *
 * **Why this exists.** The item editors had no test at all: the boundary this
 * package drew put "App-dependent DOM building" out of scope, and two features
 * were then shipped through those editors on a green suite. A button that did
 * nothing was the result, and nothing in the suite could have said so.
 *
 * It is deliberately not jsdom. What these editors touch is a handful of
 * helpers Obsidian adds to `HTMLElement` (`createEl`, `createDiv`, `empty`)
 * plus the `Setting` builder, and a real DOM would bring a dependency and a
 * second environment to keep working for no more coverage. What is here is
 * what the editors call, and a call to anything else fails loudly rather than
 * silently returning undefined.
 */

export interface FakeEl {
  tag: string;
  cls: string[];
  text: string;
  attrs: Record<string, string>;
  children: FakeEl[];
  listeners: Record<string, ((event?: unknown) => void)[]>;
  checked?: boolean;
  value?: string;
  createEl(
    tag: string,
    options?: { cls?: string; text?: string; attr?: Record<string, string> }
  ): FakeEl;
  createDiv(options?: { cls?: string; text?: string }): FakeEl;
  createSpan(options?: { cls?: string; text?: string }): FakeEl;
  empty(): void;
  addClass(...cls: string[]): void;
  removeClass(...cls: string[]): void;
  setAttr(name: string, value: string): void;
  addEventListener(name: string, fn: (event?: unknown) => void): void;
  click(): void;
}

function addChild(
  parent: FakeEl,
  tag: string,
  options: { cls?: string; text?: string; attr?: Record<string, string> }
): FakeEl {
  const child = fakeEl(tag);
  if (options.cls) child.cls.push(...options.cls.split(' '));
  if (options.text) child.text = options.text;
  Object.assign(child.attrs, options.attr ?? {});
  parent.children.push(child);
  return child;
}

export function fakeEl(tag = 'div', onEmpty?: () => void): FakeEl {
  const el: FakeEl = {
    tag,
    cls: [],
    text: '',
    attrs: {},
    children: [],
    listeners: {},
    createEl(childTag, options = {}) {
      return addChild(el, childTag, options);
    },
    // Built here rather than delegating to createEl('div'): the repository's
    // own `obsidianmd/prefer-create-el` autofix rewrites that call into
    // `createDiv(...)`, which turns a delegating helper into infinite
    // recursion. An autofix that changes behaviour is worth a comment.
    createDiv(options = {}) {
      return addChild(el, 'div', options);
    },
    createSpan(options = {}) {
      return addChild(el, 'span', options);
    },
    empty() {
      onEmpty?.();
      el.children.length = 0;
    },
    addClass(...cls) {
      el.cls.push(...cls);
    },
    removeClass(...cls) {
      el.cls = el.cls.filter((name) => !cls.includes(name));
    },
    setAttr(name, value) {
      el.attrs[name] = value;
    },
    addEventListener(name, fn) {
      (el.listeners[name] ??= []).push(fn);
    },
    click() {
      for (const fn of el.listeners.click ?? []) fn();
    },
  };
  return el;
}

/** One control a `Setting` was given, kept so a test can find and work it. */
export interface FakeControl {
  kind: 'text' | 'textarea' | 'toggle' | 'dropdown' | 'button' | 'extraButton';
  text?: string;
  icon?: string;
  value?: string | boolean;
  options: Record<string, string>;
  click?: () => void;
  change?: (value: never) => void;
}

/** One row of an editor, as the fake `Setting` records it. */
export interface FakeSetting {
  name: string;
  desc: string;
  controls: FakeControl[];
}

/** Every row built since the last reset, in the order they were built. */
export const settings: FakeSetting[] = [];

export function resetSettings(): void {
  settings.length = 0;
}

/** The rows carrying a given name, which is how a test finds the one it means. */
export function rowsNamed(name: string): FakeSetting[] {
  return settings.filter((row) => row.name === name);
}

/** The first control of a kind on the first row with this name, or undefined. */
export function control(name: string, kind: FakeControl['kind']): FakeControl | undefined {
  return rowsNamed(name)[0]?.controls.find((entry) => entry.kind === kind);
}

class FakeSettingBuilder {
  private readonly row: FakeSetting = { name: '', desc: '', controls: [] };
  settingEl = fakeEl();
  controlEl = fakeEl();

  constructor(_containerEl: unknown) {
    settings.push(this.row);
  }

  setName(name: string): this {
    this.row.name = name;
    return this;
  }
  setDesc(desc: string): this {
    this.row.desc = desc;
    return this;
  }
  setClass(): this {
    return this;
  }
  setHeading(): this {
    return this;
  }

  private add(kind: FakeControl['kind'], build: (control: FakeControl) => void): this {
    const entry: FakeControl = { kind, options: {} };
    this.row.controls.push(entry);
    build(entry);
    return this;
  }

  addText(cb: (component: unknown) => void): this {
    return this.add('text', (entry) => cb(component(entry)));
  }
  addTextArea(cb: (component: unknown) => void): this {
    return this.add('textarea', (entry) => cb(component(entry)));
  }
  addToggle(cb: (component: unknown) => void): this {
    return this.add('toggle', (entry) => cb(component(entry)));
  }
  addDropdown(cb: (component: unknown) => void): this {
    return this.add('dropdown', (entry) => cb(component(entry)));
  }
  addButton(cb: (component: unknown) => void): this {
    return this.add('button', (entry) => cb(component(entry)));
  }
  addExtraButton(cb: (component: unknown) => void): this {
    return this.add('extraButton', (entry) => cb(component(entry)));
  }
}

/** A component that answers every builder call these editors make, and records what it was told. */
function component(entry: FakeControl): Record<string, unknown> {
  const self: Record<string, unknown> = {
    setValue(value: string | boolean) {
      entry.value = value;
      return self;
    },
    setPlaceholder() {
      return self;
    },
    setButtonText(text: string) {
      entry.text = text;
      return self;
    },
    setIcon(icon: string) {
      entry.icon = icon;
      return self;
    },
    setTooltip() {
      return self;
    },
    setCta() {
      return self;
    },
    setDisabled() {
      return self;
    },
    addOption(value: string, label: string) {
      entry.options[value] = label;
      return self;
    },
    onChange(fn: (value: never) => void) {
      entry.change = fn;
      return self;
    },
    onClick(fn: () => void) {
      entry.click = fn;
      return self;
    },
    inputEl: fakeEl('input'),
  };
  return self;
}

/** The notices a run produced, so a test can see a refusal rather than only its absence. */
export const notices: string[] = [];

/** A button anywhere in the form, found by the text on it rather than by the row it sits in. */
export function buttonLabelled(text: string): FakeControl | undefined {
  return settings
    .flatMap((row) => row.controls)
    .find((entry) => entry.kind === 'button' && entry.text === text);
}

/**
 * The module a suite hands to `vi.mock('obsidian', ...)`.
 *
 * A function rather than a literal so the mock call itself stays at the top
 * level of the suite, which is where vitest hoists it to anyway.
 */
export function obsidianMock(): Record<string, unknown> {
  class Modal {
    /**
     * Emptying the container throws away the rows that were in it, which is
     * what the real one does and what a test asking "which rows are on screen
     * now" needs. Without it a re-render leaves every earlier render's rows in
     * the registry and a lookup finds a stale control.
     */
    contentEl = fakeEl('div', resetSettings);
    constructor(public app: unknown) {}
    open(): void {
      (this as unknown as { onOpen?: () => void }).onOpen?.();
    }
    close(): void {
      (this as unknown as { onClose?: () => void }).onClose?.();
    }
  }
  class Notice {
    constructor(message: string) {
      notices.push(message);
    }
  }
  class Base {}
  return {
    App: Base,
    Modal,
    Notice,
    Setting: FakeSettingBuilder,
    Component: Base,
    MarkdownRenderChild: Base,
    FuzzySuggestModal: Modal,
    SuggestModal: Modal,
    TFile: Base,
    Platform: { isMobile: false },
    normalizePath: (path: string) => path,
    stringifyYaml: () => '',
    getLanguage: () => 'en',
    setIcon: () => undefined,
    debounce: (fn: unknown) => fn,
  };
}
