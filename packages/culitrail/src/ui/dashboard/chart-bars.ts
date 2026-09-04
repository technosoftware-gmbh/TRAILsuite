/**
 * A small SVG bar chart with a two-tick y-axis and x-axis labels.
 *
 * Two decisions here are worth not undoing.
 *
 * The bar height is the only value computed at runtime, so it travels as a CSS
 * custom property driving a `scaleY` transform rather than an inline style
 * assignment, which the plugin does not do anywhere.
 *
 * The axis text is HTML outside the SVG, not SVG `<text>`. The bars stretch
 * with `preserveAspectRatio: none` so they fill whatever width the card has,
 * and that same non-uniform stretch would distort any text inside the viewBox
 * into something unreadable. A horizontal gridline survives it; a letter does
 * not.
 */

export interface ChartBar {
  axisLabel: string;
  /** The native tooltip. The only place a bucket's exact figure is stated. */
  hoverLabel: string;
  value: number;
  onClick?: (event: MouseEvent) => void;
}

export interface ChartOptions {
  /** Label every Nth bar. Keeps a dense chart's labels from colliding. */
  labelEvery?: number;
}

/** Width the viewBox gives each bar, of which the bar itself uses 8. */
const SLOT = 10;
const HEIGHT = 40;

/** A bucket of zero still gets a hairline, so it reads as an empty day rather than a gap. */
const EMPTY_SCALE = 0.02;

export function renderBarChart(
  container: HTMLElement,
  bars: ChartBar[],
  options: ChartOptions = {}
): void {
  if (bars.length === 0) return;

  const labelEvery = options.labelEvery ?? 1;
  // At least 1, so a range where nothing was eaten does not divide by zero
  // and every bar renders as the hairline instead.
  const max = Math.max(1, ...bars.map((bar) => bar.value));

  const wrap = container.createDiv({ cls: 'culi-dashboard-chart-wrap' });
  const plot = wrap.createDiv({ cls: 'culi-dashboard-chart-plot' });

  const yAxis = plot.createDiv({ cls: 'culi-dashboard-chart-yaxis' });
  yAxis.createSpan({ cls: 'culi-dashboard-chart-yaxis-tick', text: String(max) });
  yAxis.createSpan({ cls: 'culi-dashboard-chart-yaxis-tick', text: '0' });

  const svg = plot.createSvg('svg', {
    cls: 'culi-dashboard-chart',
    attr: { viewBox: `0 0 ${bars.length * SLOT} ${HEIGHT}`, preserveAspectRatio: 'none' },
  });

  for (const y of [0.5, HEIGHT - 0.5]) {
    svg.createSvg('line', {
      cls: 'culi-dashboard-chart-gridline',
      attr: { x1: 0, y1: y, x2: bars.length * SLOT, y2: y },
    });
  }

  bars.forEach((bar, index) => {
    const rect = svg.createSvg('rect', {
      // An array rather than a space-separated string: `createSvg` hands `cls`
      // straight to `classList.add()`, which throws on a string containing a
      // space, unlike `createDiv` which splits it first.
      cls: bar.onClick
        ? ['culi-dashboard-chart-bar', 'culi-dashboard-chart-bar--clickable']
        : 'culi-dashboard-chart-bar',
      attr: { x: index * SLOT + 1, y: 0, width: 8, height: HEIGHT },
    });
    rect.setCssProps({
      '--culi-bar-scale': String(bar.value === 0 ? EMPTY_SCALE : bar.value / max),
    });
    rect.createSvg('title', {}, (element) => {
      element.textContent = bar.hoverLabel;
    });
    if (bar.onClick) rect.addEventListener('click', bar.onClick);
  });

  const xAxis = wrap.createDiv({ cls: 'culi-dashboard-chart-xaxis' });
  // Sits under the y-axis column so the first label lines up with the first bar
  // rather than with the tick numbers.
  xAxis.createDiv({ cls: 'culi-dashboard-chart-xaxis-spacer' });
  bars.forEach((bar, index) => {
    xAxis.createDiv({
      cls: 'culi-dashboard-chart-xaxis-label',
      text: index % labelEvery === 0 ? bar.axisLabel : '',
    });
  });
}
