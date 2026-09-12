/**
 * The people and companies behind the money: a tab each, searchable.
 *
 * **Here rather than in APERtrail**, where a CRM dashboard used to live. The
 * forms that create and edit a Person or a Company have always been NODAtrail's,
 * and a view that lists them in one plugin while the only way to change them is
 * in another is a split nobody can hold in their head. Written fresh: the two
 * packages may not share code even though both are PolyForm, and the shape they
 * do share is `trail-core`'s CRM contract.
 *
 * Reference data you maintain occasionally, so it gets a view of its own rather
 * than a strip on the Life dashboard. The whole list, not the first six: the
 * question this answers is "what do I have and is it right", and a capped list
 * answers neither.
 */
import { t } from '../../lang/I18nManager';
import { readCrmBoard, type CrmRecord } from '../../crm/read-crm-board';
import { card, emptyState, section, stat, statRow, tabs, type CardField } from '../kit/elements';
import { NodaView } from './base-view';
import { CRM_VIEW_TYPE } from './view-types';

const TABS = ['persons', 'companies'] as const;
type Tab = (typeof TABS)[number];

export class CrmView extends NodaView {
  private tab: Tab = 'persons';
  /** Narrows both lists. Held on the view rather than in the DOM, so a redraw keeps it. */
  private query = '';
  /** The element the list is drawn into, so filtering can replace it alone. */
  private listHost: HTMLElement | null = null;

  getViewType(): string {
    return CRM_VIEW_TYPE;
  }

  getDisplayText(): string {
    return t('crm.title');
  }

  getIcon(): string {
    return 'users';
  }

  protected toolbarActions() {
    return [
      { label: t('crm.newPerson'), icon: 'user-plus', onClick: () => this.deps.openNewPerson() },
      {
        label: t('crm.newCompany'),
        icon: 'building-2',
        onClick: () => this.deps.openNewCompany(),
      },
    ];
  }

  protected async renderBody(): Promise<void> {
    const settings = this.deps.getSettings();
    const board = readCrmBoard(this.deps.app, settings);

    const strip = statRow(this.body);
    stat(strip, t('crm.persons'), String(board.persons.length));
    stat(strip, t('crm.companies'), String(board.companies.length));
    // The one figure that is not a row count: a company nobody has classified
    // is a company in every dropdown in the vault, which is the thing this
    // view exists to let somebody fix.
    stat(
      strip,
      t('crm.unclassified'),
      String(
        [...board.persons, ...board.companies].filter((record) => record.roles.length === 0).length
      )
    );

    const body = tabs(
      this.body,
      TABS.map((tab) => t(`crm.tab.${tab}`)),
      TABS.indexOf(this.tab),
      (index) => {
        this.tab = TABS[index] ?? 'persons';
        void this.render();
      }
    );

    this.renderSearch(body);
    this.listHost = body.createDiv({ cls: 'nod-crm-list' });
    this.renderList();

    return Promise.resolve();
  }

  /**
   * The search field.
   *
   * Filtered on every keystroke without a redraw of the whole view: the list is
   * the only thing that changes, and rebuilding the field somebody is typing
   * into is the bug the meal gallery spent two fixes on.
   */
  private renderSearch(parent: HTMLElement): void {
    const bar = parent.createDiv({ cls: 'nod-crm-search' });
    const input = bar.createEl('input', { cls: 'nod-crm-search-input', type: 'search' });
    input.placeholder = t('crm.searchPlaceholder');
    input.value = this.query;
    input.addEventListener('input', () => {
      this.query = input.value;
      this.renderList();
    });
  }

  /**
   * Redraws only the list, keeping the search field and its caret.
   *
   * Its own element rather than a query for what to remove: the gallery in the
   * sibling plugin lost characters for exactly as long as its search field was
   * inside the part being replaced.
   */
  private renderList(): void {
    const host = this.listHost;
    if (!host) return;
    host.empty();

    const board = readCrmBoard(this.deps.app, this.deps.getSettings());
    const records = this.tab === 'persons' ? board.persons : board.companies;
    const matched = records.filter((record) => this.matches(record));

    if (matched.length === 0) {
      emptyState(host, this.query ? t('crm.noMatches') : t(`crm.empty.${this.tab}`));
      return;
    }

    const body = section(host, t(`crm.tab.${this.tab}`));
    for (const record of matched) this.renderRecord(body, record);
  }

  /** Name, roles and every contact field, because that is what a CRM card is for. */
  private matches(record: CrmRecord): boolean {
    const query = this.query.trim().toLowerCase();
    if (!query) return true;

    return [
      record.title,
      record.description,
      record.email,
      record.address,
      record.website,
      ...record.tags,
      ...record.roles,
    ]
      .filter((value): value is string => typeof value === 'string')
      .some((value) => value.toLowerCase().includes(query));
  }

  private renderRecord(parent: HTMLElement, record: CrmRecord): void {
    const fields: CardField[] = [];
    if (record.description) {
      fields.push({ label: t('crm.description'), value: record.description, icon: 'info' });
    }
    if (record.email) fields.push({ label: t('crm.email'), value: record.email, icon: 'mail' });
    if (record.address) {
      fields.push({ label: t('crm.address'), value: record.address, icon: 'map-pin' });
    }
    if (record.website) {
      fields.push({ label: t('crm.website'), value: record.website, icon: 'link' });
    }

    const chips = record.tags.map((tag) => ({ text: tag, tone: 'muted' as const }));
    // Nobody with no roles is in every list that filters on them, so it is
    // marked rather than left looking complete. Persons carry roles too now:
    // one can send an invoice as readily as a company can.
    if (record.roles.length === 0) {
      chips.push({ text: t('crm.anyRole'), tone: 'muted' as const });
    }

    card(parent, {
      // A company or a person is the one record here that routinely carries
      // its own icon, since it is what a logo would be if a vault had logos.
      icon: this.noteIcon(record.file, this.tab === 'persons' ? 'user' : 'building-2'),
      name: record.title,
      id: record.roles.length > 0 ? record.roles.join(', ') : null,
      fields,
      chips,
      actions: [
        {
          icon: 'pencil',
          label: t('common.edit'),
          onClick: () =>
            this.deps.openEditCrm(this.tab === 'persons' ? 'person' : 'company', {
              file: record.file,
              title: record.title,
              frontmatter: record.frontmatter,
            }),
        },
      ],
      onClick: () => void this.deps.openNote(record.file),
    });
  }
}
