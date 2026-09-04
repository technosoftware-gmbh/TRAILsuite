/**
 * Renders a photo spot's motifs, sample frames and access details inside
 * the note itself, as an `apt-photo-spot` fenced code block. The printed
 * location guide's double page, minus the parts a book can do better and
 * plus the parts it cannot.
 *
 * Like the two older blocks it takes no arguments and works out which note
 * it is in from the rendering context's own path, so a block is
 * copy-pasteable between photo spot notes and cannot be pointed at the
 * wrong one.
 *
 * It is also an editing surface. Motifs and samples are added, edited,
 * reordered and deleted from here, and a motif is ticked off as captured
 * from here, because this is where you are already looking when any of
 * those become true. Every mutation reads the whole spot, changes one
 * thing, and writes it all back through updatePhotoSpotNote(): one save
 * path, no partial writes. The access details are deliberately NOT edited
 * here -- they are flat scalars that Obsidian's own property editor
 * already handles well, and a second editor for them would be a second
 * thing to keep in step.
 */
import { App, MarkdownPostProcessorContext, MarkdownRenderChild, Notice, setIcon } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { readTravelBoard } from '../../vault/read-entities';
import { photoSpotView } from '../photo-spot-view';
import {
  formatDayTitle,
  parseGeoPoint,
  SUN_ELEVATIONS,
  sunPosition,
  sunTimes,
  SunTimes,
} from 'trail-core';
import { renderChip } from '../../ui/components/chip';
import { exportPhotoSpotSheet } from './export-photo-spot';
import {
  deviceTimeZone,
  GEAR_ICONS,
  gearLabel,
  logisticsRows,
  motifCapture,
  motifCoordinates,
  motifDirection,
  motifOffset,
  motifSeason,
  sunRows,
} from '../photo-spot-text';
import { formatClockIn, hour12For } from '../../shared/clock';
import { renderLightChip, renderRelationBadge, SunContext } from './light-badges';
import { startOfLocalDay, sunBandSegments } from '../../shared/sun-band';
import { lightWindowRange } from '../solar';
import {
  capturedMotifCount,
  ParsedPhotoSpot,
  ParsedPhotoSpotMotif,
  ParsedPhotoSpotSample,
  primaryMotif,
} from '../photo-spot-note';
import { PhotoSpotInput, photoSpotToInput, updatePhotoSpotNote } from '../write-photo-spot';
import { TravelPlace } from '../../vault/types';
import { renderImageCard } from '../../ui/components/image-resolve';
import {
  emptyMotif,
  emptySample,
  MotifEditorModal,
  SampleEditorModal,
} from './photo-spot-editor-modals';

import { APT_PHOTO_SPOT_BLOCK_LANG } from '../photo-spot-block-lang';
import { formatMediumDate } from '../../shared/display';

export { APT_PHOTO_SPOT_BLOCK_LANG };

interface RowAction {
  icon: string;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}

/** The hover-revealed edit/reorder/delete cluster. Same affordance the itinerary block puts on its own rows. */
function renderRowActions(row: HTMLElement, actions: RowAction[]): void {
  const wrap = row.createDiv({ cls: 'apt-photo-spot-actions' });
  for (const action of actions) {
    const btn = wrap.createDiv({
      cls: 'apt-photo-spot-action-btn',
      attr: { role: 'button', tabindex: '0', 'aria-label': action.label, title: action.label },
    });
    setIcon(btn, action.icon);
    btn.toggleClass('is-disabled', action.disabled === true);
    if (action.disabled) continue;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      action.onClick();
    });
  }
}

function renderAddButton(container: HTMLElement, label: string, onClick: () => void): void {
  const btn = container.createEl('button', {
    cls: 'apt-photo-spot-add-btn',
    text: `+ ${label}`,
  });
  btn.addEventListener('click', () => onClick());
}

function renderMotifMeta(container: HTMLElement, motif: ParsedPhotoSpotMotif): void {
  const meta = container.createDiv({ cls: 'apt-photo-spot-motif-meta' });

  meta.createSpan({
    cls: `apt-photo-spot-role apt-photo-spot-role--${motif.role}`,
    text: t(`photoSpot.role.${motif.role}`),
  });

  // Same four parts the field sheet prints, in the same order and the same
  // words: they are one answer to "what is this motif", rendered twice.
  for (const part of [
    motifCoordinates(motif),
    motifDirection(motif),
    motif.lens,
    motifSeason(motif),
  ]) {
    if (part) meta.createSpan({ text: part });
  }
}

export interface PhotoSpotBlockDeps {
  getSettings: () => APERtrailSettings;
}

/**
 * A MarkdownRenderChild rather than a bare render function, for the same
 * reason the itinerary block is one: writing frontmatter and redrawing
 * immediately reads STALE data. processFrontMatter() resolves once the
 * file is written, but metadataCache updates asynchronously afterwards, so
 * a redraw fired from the write's own promise renders the frontmatter as
 * it was before the edit. Redrawing on the cache's own 'changed' event
 * instead removes the race, and the child's lifecycle takes the listener
 * down with the block.
 */
class PhotoSpotRenderer extends MarkdownRenderChild {
  /**
   * The day the sun panel is showing. Instance state rather than a
   * parameter, so stepping through days survives the redraws that the
   * capture toggle and the editors trigger.
   */
  private shownDate = new Date();

  constructor(
    private readonly app: App,
    private readonly el: HTMLElement,
    private readonly sourcePath: string,
    private readonly deps: PhotoSpotBlockDeps
  ) {
    super(el);
  }

  onload(): void {
    this.registerEvent(
      this.app.metadataCache.on('changed', (file) => {
        if (file.path === this.sourcePath) this.render();
      })
    );
    this.render();
  }

  /**
   * Every edit goes through here: read the spot as it currently stands,
   * let the caller change one thing, write the whole thing back. No caller
   * ever assembles a partial input, so a field nobody touched cannot be
   * dropped by an edit somewhere else on the note.
   */
  private async mutate(place: TravelPlace, change: (input: PhotoSpotInput) => void): Promise<void> {
    const input = photoSpotToInput(place);
    change(input);
    try {
      await updatePhotoSpotNote(this.app, this.deps.getSettings(), place.file, input);
    } catch (err) {
      new Notice(err instanceof Error ? err.message : t('photoSpot.saveFailed'));
    }
  }

  private render(): void {
    const { el } = this;
    el.empty();
    el.addClass('apt-photo-spot');

    const settings = this.deps.getSettings();
    const board = readTravelBoard(this.app, settings);
    const place = board.places.find(
      (candidate) => candidate.kind === 'photospot' && candidate.file.path === this.sourcePath
    );

    if (!place || !place.photoSpot) {
      el.createDiv({ cls: 'apt-itinerary-empty', text: t('photoSpot.notAPhotoSpot') });
      return;
    }

    const spot = place.photoSpot;
    const view = photoSpotView(spot, place.geoLocation);
    const anchor = parseGeoPoint(place.geoLocation);
    const sun: SunContext | null = settings.sunTimesEnabled
      ? {
          date: this.shownDate,
          timeZone: spot.timezone ?? undefined,
          hour12: hour12For(settings.clockFormat),
        }
      : null;
    const motifNames = spot.motifs
      .map((motif) => motif.name)
      .filter((name): name is string => !!name);

    const heading = el.createDiv({ cls: 'apt-photo-spot-heading apt-photo-spot-heading--action' });
    heading.createSpan({ text: t('photoSpot.motifs') });
    // The count the gallery and dashboard cards already carry, put where
    // the question is actually asked. A spot whose motifs nobody has
    // written down yet says nothing rather than "0 of 0", which would read
    // as a score rather than as an empty note.
    if (spot.motifs.length > 0) {
      heading.createSpan({
        cls: 'apt-photo-spot-progress',
        text: t('photoSpot.capturedCount', {
          captured: capturedMotifCount(spot),
          total: spot.motifs.length,
        }),
      });
    }
    renderAddButton(heading, t('photoSpot.addMotif'), () => {
      new MotifEditorModal(this.app, emptyMotif(), (motif) => {
        void this.mutate(place, (input) => input.motifs.push(motif));
      }).open();
    });

    // The sheet is written for the date the sun panel is showing, not for
    // today: stepping to the morning you are actually going and exporting
    // from there is the whole reason the stepper is a stepper.
    const sheet = heading.createEl('button', {
      cls: 'apt-photo-spot-add-btn apt-photo-spot-sheet-btn',
    });
    setIcon(sheet.createSpan({ cls: 'apt-chip-icon' }), 'printer');
    sheet.createSpan({ text: t('photoSpot.export.button') });
    sheet.addEventListener('click', () => {
      void exportPhotoSpotSheet(this.app, this.deps.getSettings(), place, this.shownDate);
    });

    // What the note is usually opened for, before the motif cards it would
    // otherwise be a long scroll past: when the main motif's light happens
    // next, in the spot's own zone. The panel further down still answers
    // "and what about a week on Thursday".
    if (sun && anchor) this.renderNextLight(el, spot, anchor, sun);

    if (view.sections.length === 0) {
      el.createDiv({ cls: 'apt-itinerary-empty', text: t('photoSpot.noMotifs') });
    } else {
      view.sections.forEach((section, index) => {
        this.renderMotif(el, place, section.motif, section.samples, section.offset, {
          anchor,
          sun,
          index,
          count: view.sections.length,
          motifNames,
        });
      });
    }

    if (view.looseSamples.length > 0) {
      el.createDiv({ cls: 'apt-photo-spot-heading', text: t('photoSpot.otherSamples') });
      const strip = el.createDiv({ cls: 'apt-photo-spot-samples' });
      for (const sample of view.looseSamples) {
        this.renderSample(strip, place, sample, motifNames);
      }
    }

    // The panel needs somewhere to measure from, so a spot with no
    // coordinates gets no panel rather than one computed at Null Island.
    if (sun && anchor) {
      this.renderSunPanel(el, sunTimes(sun.date, anchor.lat, anchor.lon), sun, anchor);
    }

    const rows = logisticsRows(place, spot);
    if (rows.length > 0) {
      el.createDiv({ cls: 'apt-photo-spot-heading', text: t('photoSpot.onSite') });
      const grid = el.createDiv({ cls: 'apt-photo-spot-logi' });
      for (const row of rows) {
        const cell = grid.createDiv({ cls: 'apt-photo-spot-logi-cell' });
        setIcon(cell.createSpan({ cls: 'apt-photo-spot-logi-icon' }), row.icon);
        const body = cell.createDiv();
        body.createDiv({ cls: 'apt-photo-spot-logi-label', text: row.label });
        const value = body.createDiv({
          cls: row.muted ? 'apt-photo-spot-logi-value is-muted' : 'apt-photo-spot-logi-value',
        });
        if (row.href) {
          value.createEl('a', {
            text: row.value,
            href: row.href,
            attr: { target: '_blank', rel: 'noopener' },
          });
        } else {
          value.setText(row.value);
        }
      }
    }
  }

  /**
   * The next time the spot's main motif gets the light it asks for.
   *
   * Today when that window is still ahead, tomorrow once it has passed:
   * "golden hour was at 20:42" is a fact about a day that is over, and the
   * question being asked is when to go.
   *
   * Nothing is drawn for a spot whose motifs name no light, and nothing for
   * a date on which that light does not happen. Both are ordinary, and
   * neither is worth a row saying so.
   */
  private renderNextLight(
    container: HTMLElement,
    spot: ParsedPhotoSpot,
    anchor: { lat: number; lon: number },
    sun: SunContext
  ): void {
    const motif = primaryMotif(spot);
    if (!motif || motif.light.length === 0) return;
    const point = parseGeoPoint(motif.geoLocation) ?? anchor;
    const window = motif.light[0];

    const now = new Date();
    const today = lightWindowRange(window, now, point.lat, point.lon);
    const upcoming =
      today && (today.end ?? today.start).valueOf() >= now.valueOf()
        ? { range: today, tomorrow: false }
        : (() => {
            const next = lightWindowRange(
              window,
              new Date(now.valueOf() + 86400000),
              point.lat,
              point.lon
            );
            return next ? { range: next, tomorrow: true } : null;
          })();
    if (!upcoming) return;

    const { range } = upcoming;
    const clock = (moment: Date): string => formatClockIn(moment, sun.timeZone, sun.hour12);
    const time =
      range.end && range.end.valueOf() !== range.start.valueOf()
        ? `${clock(range.start)} - ${clock(range.end)}`
        : clock(range.start);

    const row = container.createDiv({ cls: 'apt-photo-spot-next-light' });
    setIcon(row.createSpan({ cls: 'apt-photo-spot-next-light-icon' }), 'sun');
    row.createSpan({
      text: t(upcoming.tomorrow ? 'photoSpot.nextLightTomorrow' : 'photoSpot.nextLightToday', {
        light: t(`photoSpot.light.${window}`),
        time,
        motif: motif.name ?? t('photoSpot.unnamedMotif'),
      }),
    });
  }

  private renderSample(
    container: HTMLElement,
    place: TravelPlace,
    sample: ParsedPhotoSpotSample,
    motifNames: string[]
  ): void {
    if (!sample.image) return;
    const card = container.createDiv({ cls: 'apt-photo-spot-sample' });
    renderImageCard(card, this.app, sample.image);

    const caption = card.createDiv({ cls: 'apt-photo-spot-sample-caption' });
    if (sample.light) {
      caption.createDiv({
        cls: 'apt-photo-spot-sample-light',
        text: t(`photoSpot.light.${sample.light}`),
      });
    }
    if (sample.exposure) {
      caption.createDiv({ cls: 'apt-photo-spot-sample-exposure', text: sample.exposure });
    }
    if (sample.credit) {
      caption.createDiv({ cls: 'apt-photo-spot-sample-credit', text: sample.credit });
    }

    // Located by content within the current read rather than by a stored
    // index: the block renders samples grouped by motif, so a display
    // position says nothing about where the entry sits in the note.
    const indexOf = (input: PhotoSpotInput): number =>
      input.samples.findIndex(
        (candidate) =>
          candidate.image === sample.image &&
          (candidate.motifName ?? null) === (sample.motifName ?? null) &&
          (candidate.exposure ?? null) === (sample.exposure ?? null)
      );

    renderRowActions(card, [
      {
        icon: 'pencil',
        label: t('photoSpot.editSample'),
        onClick: () => {
          new SampleEditorModal(
            this.app,
            {
              image: sample.image ?? '',
              motifName: sample.motifName,
              light: sample.light,
              exposure: sample.exposure,
              credit: sample.credit,
            },
            (edited) => {
              void this.mutate(place, (input) => {
                const at = indexOf(input);
                if (at >= 0) input.samples[at] = edited;
              });
            },
            motifNames
          ).open();
        },
      },
      {
        icon: 'trash-2',
        label: t('photoSpot.deleteSample'),
        onClick: () => {
          void this.mutate(place, (input) => {
            const at = indexOf(input);
            if (at >= 0) input.samples.splice(at, 1);
          });
        },
      },
    ]);
  }

  private renderMotif(
    container: HTMLElement,
    place: TravelPlace,
    motif: ParsedPhotoSpotMotif,
    samples: ParsedPhotoSpotSample[],
    offset: { km: number; compass: string } | null,
    ctx: {
      anchor: { lat: number; lon: number } | null;
      sun: SunContext | null;
      index: number;
      count: number;
      motifNames: string[];
    }
  ): void {
    const { anchor, sun } = ctx;
    const card = container.createDiv({
      cls: `apt-photo-spot-motif apt-photo-spot-motif--${motif.role}`,
    });

    // The block renders the main motif first; the note stores motifs in its
    // own order. Every edit addresses the entry by NAME rather than by the
    // position it happens to occupy on screen, so promoting a motif to main
    // never makes the buttons act on its neighbour.
    const indexOf = (input: PhotoSpotInput): number =>
      input.motifs.findIndex((candidate) => (candidate.name || null) === motif.name);

    const head = card.createDiv({ cls: 'apt-photo-spot-motif-head' });
    // Main and secondary differ by more than a border colour, so the main
    // one is findable at a glance on a spot carrying four or five motifs.
    setIcon(
      head.createSpan({ cls: 'apt-photo-spot-motif-icon' }),
      motif.role === 'main' ? 'camera' : 'aperture'
    );
    const headBody = head.createDiv({ cls: 'apt-photo-spot-motif-headbody' });
    // A nameless motif renders as such rather than as a blank row: the note
    // needs fixing, and an empty card looks like a rendering bug instead.
    headBody.createDiv({
      cls: motif.name ? 'apt-photo-spot-motif-name' : 'apt-photo-spot-motif-name is-unnamed',
      text: motif.name ?? t('photoSpot.unnamedMotif'),
    });
    renderMotifMeta(headBody, motif);

    renderRowActions(head, [
      {
        icon: 'pencil',
        label: t('photoSpot.editMotif'),
        onClick: () => {
          new MotifEditorModal(
            this.app,
            {
              name: motif.name ?? '',
              role: motif.role,
              geoLocation: motif.geoLocation ? [...motif.geoLocation] : null,
              direction: motif.direction,
              light: [...motif.light],
              season: [...motif.season],
              lens: motif.lens,
              gear: [...motif.gear],
              technique: motif.technique,
              note: motif.note,
              captured: motif.captured,
              capturedOn: motif.capturedOn,
            },
            (edited) => {
              void this.mutate(place, (input) => {
                const at = indexOf(input);
                if (at >= 0) input.motifs[at] = edited;
              });
            }
          ).open();
        },
      },
      {
        icon: 'chevron-up',
        label: t('photoSpot.moveUp'),
        disabled: ctx.index === 0,
        onClick: () => this.move(place, indexOf, -1),
      },
      {
        icon: 'chevron-down',
        label: t('photoSpot.moveDown'),
        disabled: ctx.index === ctx.count - 1,
        onClick: () => this.move(place, indexOf, 1),
      },
      {
        icon: 'trash-2',
        label: t('photoSpot.deleteMotif'),
        onClick: () => {
          void this.mutate(place, (input) => {
            const at = indexOf(input);
            if (at >= 0) input.motifs.splice(at, 1);
          });
        },
      },
    ]);

    if (motif.light.length > 0) {
      const chips = card.createDiv({ cls: 'apt-chips apt-photo-spot-light' });
      const point = parseGeoPoint(motif.geoLocation) ?? anchor;
      for (const window of motif.light) renderLightChip(chips, window, point, sun);
      renderRelationBadge(chips, motif, point, sun);
    }

    if (motif.note) card.createDiv({ cls: 'apt-photo-spot-motif-note', text: motif.note });

    if (motif.gear.length > 0) {
      const chips = card.createDiv({ cls: 'apt-chips apt-photo-spot-gear' });
      for (const item of motif.gear) {
        renderChip(chips, gearLabel(item), GEAR_ICONS[item.trim().toLowerCase()] ?? 'package');
      }
    }

    if (motif.technique) {
      const tip = card.createDiv({ cls: 'apt-photo-spot-tip' });
      setIcon(tip.createSpan({ cls: 'apt-photo-spot-tip-icon' }), 'lightbulb');
      tip.createDiv({ cls: 'apt-photo-spot-tip-text', text: motif.technique });
    }

    const strip = card.createDiv({ cls: 'apt-photo-spot-samples' });
    for (const sample of samples) this.renderSample(strip, place, sample, ctx.motifNames);
    // A sample points back at its motif by name, so a nameless motif has
    // nothing to attach one to. It gets no add button rather than an
    // orphan-making one.
    if (motif.name) {
      renderAddButton(strip, t('photoSpot.addSample'), () => {
        new SampleEditorModal(
          this.app,
          { ...emptySample(), motifName: motif.name },
          (sample) => {
            void this.mutate(place, (input) => input.samples.push(sample));
          },
          ctx.motifNames
        ).open();
      });
    }

    const foot = card.createDiv({ cls: 'apt-photo-spot-motif-foot' });
    const captured = foot.createEl('button', {
      cls: motif.captured
        ? 'apt-photo-spot-captured is-captured'
        : 'apt-photo-spot-captured is-open',
    });
    setIcon(captured.createSpan(), motif.captured ? 'check' : 'circle');
    captured.createSpan({ text: motifCapture(motif) });
    captured.addEventListener('click', () => {
      void this.mutate(place, (input) => {
        const at = indexOf(input);
        if (at < 0) return;
        const entry = input.motifs[at];
        // Ticking it off stamps today; un-ticking clears the date rather
        // than leaving a capture date on a motif that is open again.
        entry.captured = !entry.captured;
        entry.capturedOn = entry.captured ? formatDayTitle(new Date()) : null;
      });
    });

    const offsetText = motifOffset(offset, this.deps.getSettings().units);
    if (offsetText) foot.createSpan({ cls: 'apt-photo-spot-offset', text: offsetText });
  }

  private move(place: TravelPlace, indexOf: (input: PhotoSpotInput) => number, by: number): void {
    void this.mutate(place, (input) => {
      const at = indexOf(input);
      const to = at + by;
      if (at < 0 || to < 0 || to >= input.motifs.length) return;
      const [moved] = input.motifs.splice(at, 1);
      input.motifs.splice(to, 0, moved);
    });
  }

  /**
   * The day's light at the spot, as a row of boundaries.
   *
   * Deliberately says nothing when the sun never crosses one of them: at 69
   * degrees north in June there is no sunrise to print, and a panel full of
   * dashes would read as a failure rather than as a fact about the place.
   */
  private renderSunPanel(
    container: HTMLElement,
    times: SunTimes,
    sun: SunContext,
    anchor: { lat: number; lon: number }
  ): void {
    const heading = container.createDiv({
      cls: 'apt-photo-spot-heading apt-photo-spot-sun-heading',
    });
    heading.createSpan({ text: t('photoSpot.lightOn', { date: formatMediumDate(sun.date) }) });

    const nav = heading.createSpan({ cls: 'apt-photo-spot-sun-nav' });
    const shift = (days: number): void => {
      this.shownDate =
        days === 0 ? new Date() : new Date(this.shownDate.valueOf() + days * 86400000);
      this.render();
    };
    const step = (label: string, days: number): void => {
      const btn = nav.createEl('button', { cls: 'apt-photo-spot-sun-step', text: label });
      btn.addEventListener('click', () => shift(days));
    };
    step('‹', -1);
    step(t('photoSpot.today'), 0);
    step('›', 1);

    // Which zone these times are in, said out loud, at the far end of the
    // header. The zone is optional on the note and falls back to the
    // device's, and a spot in Iceland rendered in the reader's own zone
    // looks entirely plausible while being wrong by hours. An unlabelled
    // fallback is how "golden hour is at 03:40" happens with nothing on
    // screen admitting why.
    const noteZone = sun.timeZone?.trim();
    const zone = noteZone ? noteZone : t('photoSpot.deviceTimeZone', { zone: deviceTimeZone() });
    heading.createSpan({
      cls: 'apt-photo-spot-sun-where',
      text: t('photoSpot.sunWhere', {
        zone,
        lat: anchor.lat.toFixed(4),
        lon: anchor.lon.toFixed(4),
      }),
    });

    // The day drawn, above the day tabulated. The cells below answer "when
    // exactly"; the band answers "how long, and how late does it run", which
    // is the question asked while deciding whether a spot fits a day at all.
    const band = container.createDiv({ cls: 'apt-sunband apt-photo-spot-sunband' });
    for (const segment of sunBandSegments(sun.date, anchor, sun.timeZone)) {
      const seg = band.createDiv({ cls: `apt-sunband-seg is-${segment.kind}` });
      seg.setCssProps({ '--apt-sunband-share': (segment.end - segment.start).toFixed(6) });
    }

    // Ticks are placed from the band's own local midnight, so a spot in
    // another zone gets them in ITS clock rather than in the reader's.
    const dayStart = startOfLocalDay(sun.date, sun.timeZone).valueOf();
    const ticks = container.createDiv({ cls: 'apt-photo-spot-sun-ticks' });
    for (const hour of [4, 8, 12, 16, 20]) {
      const tick = ticks.createSpan({
        cls: 'apt-photo-spot-sun-tick',
        text: formatClockIn(new Date(dayStart + hour * 3600000), sun.timeZone, sun.hour12),
      });
      tick.setCssProps({ '--apt-tick-at': `${((hour / 24) * 100).toFixed(2)}%` });
    }

    const legend = container.createDiv({ cls: 'apt-photo-spot-sun-legend' });
    for (const kind of ['night', 'blue', 'golden', 'day'] as const) {
      const entry = legend.createSpan({ cls: 'apt-photo-spot-sun-legend-entry' });
      entry.createSpan({ cls: `apt-photo-spot-sun-swatch is-${kind}` });
      entry.createSpan({ text: t(`photoSpot.band.${kind}`) });
    }

    const panel = container.createDiv({ cls: 'apt-photo-spot-sun' });

    let drew = 0;
    for (const { label, start, end } of sunRows(times)) {
      if (!start) continue;
      drew += 1;
      const cell = panel.createDiv();
      cell.createDiv({ cls: 'apt-photo-spot-sun-label', text: label });
      cell.createDiv({
        cls: 'apt-photo-spot-sun-value',
        text: end
          ? `${formatClockIn(start, sun.timeZone, sun.hour12)} - ${formatClockIn(end, sun.timeZone, sun.hour12)}`
          : formatClockIn(start, sun.timeZone, sun.hour12),
      });
    }

    // Only solar noon survived, so the sun never crossed any of the
    // boundaries: polar day or polar night, and its altitude at noon (its
    // daily maximum) decides which side it stayed on.
    if (drew <= 1) {
      const noonAltitude = sunPosition(times.solarNoon, anchor.lat, anchor.lon).altitude;
      panel.createDiv({
        cls: 'apt-photo-spot-sun-polar',
        text:
          noonAltitude > SUN_ELEVATIONS.horizon
            ? t('photoSpot.polarDay')
            : t('photoSpot.polarNight'),
      });
    }

    container.createDiv({ cls: 'apt-photo-spot-sun-caveat', text: t('photoSpot.sunCaveat') });
  }
}

/** Same shape as the two older block registrars -- the registrar is passed in so the plugin instance owns the registration. */
export function registerPhotoSpotBlock(
  app: App,
  deps: PhotoSpotBlockDeps,
  register: (
    lang: string,
    handler: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void
  ) => void
): void {
  register(APT_PHOTO_SPOT_BLOCK_LANG, (_source, el, ctx) => {
    ctx.addChild(new PhotoSpotRenderer(app, el, ctx.sourcePath, deps));
  });
}
