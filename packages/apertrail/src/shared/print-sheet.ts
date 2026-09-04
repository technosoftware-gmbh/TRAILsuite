/**
 * The parts every printable sheet this plugin writes has in common: the page
 * itself, and the rule that nothing reaches paper unescaped.
 *
 * Extracted when the trip cost sheet became the second export. One print
 * stylesheet rather than two, because two would have drifted in margins
 * first and in typeface second, and a photo spot sheet and a cost sheet
 * printed on the same day should look like they came from the same plugin.
 *
 * App-free.
 */

/**
 * Everything that reaches the page goes through here.
 *
 * A note is user input: a booking called `<script>` or an exposure line with
 * an ampersand in it must arrive as text, not as markup. There is no branch
 * that skips this, which is why a sheet is assembled from escaped fragments
 * rather than by interpolating a model into a template.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The page: A4, black on white, and nothing that needs the network.
 *
 * Deliberately not the plugin's own look. A sheet is printed or read on a
 * phone in a field, where Obsidian's theme variables do not exist and a dark
 * background is a waste of ink.
 */
export const PRINT_PAGE_STYLE = `
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0 auto; max-width: 190mm; padding: 10mm 0;
    color: #14161a; background: #fff;
    font: 11pt/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  h1 { font-size: 20pt; margin: 0 0 2mm; letter-spacing: -0.2pt; }
  h2 {
    font-size: 8.5pt; text-transform: uppercase; letter-spacing: 1pt;
    color: #6b7079; margin: 7mm 0 2.5mm; padding-bottom: 1mm;
    border-bottom: 0.5pt solid #c9ccd2;
    /* A heading alone at the foot of a page names a section the reader cannot
       see. It happened to the trip document's picture gallery, and every other
       section on all three sheets could do the same. */
    break-after: avoid; page-break-after: avoid;
  }
  h3 { font-size: 12pt; margin: 0; }
  .meta { color: #565c66; font-size: 9pt; margin: 0 0 2mm; }
  .sep { padding: 0 2mm; color: #adb2ba; }
  .stars { color: #a8801f; letter-spacing: 0.5pt; }
  header { border-bottom: 1pt solid #14161a; padding-bottom: 3mm; margin-bottom: 4mm; }
  footer { margin-top: 6mm; padding-top: 2mm; border-top: 0.5pt solid #c9ccd2;
           font-size: 8.5pt; color: #6b7079; }
  footer p { margin: 0 0 1mm; }
`;

/** One label and value in the row under a heading. Used by both sheets. */
export function metaLine(parts: (string | null)[]): string {
  const kept = parts.filter((part): part is string => !!part && part.trim() !== '');
  if (kept.length === 0) return '';
  return `<div class="meta">${kept.join('<span class="sep">&middot;</span>')}</div>`;
}

/** A rating as filled and hollow stars, which print where a colour does not. */
export function starsHtml(rating: number | null): string {
  if (rating === null || rating <= 0) return '';
  const filled = Math.min(5, Math.round(rating));
  return `<span class="stars">${'&#9733;'.repeat(filled)}${'&#9734;'.repeat(5 - filled)}</span>`;
}

/** The document around a sheet's own body and its own extra styles. */
export function printableDocument(input: { title: string; style: string; body: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(input.title)}</title>
<style>${PRINT_PAGE_STYLE}${input.style}</style>
</head>
<body>
${input.body}
</body>
</html>
`;
}
