/**
 * The parts every printable sheet this plugin writes has in common: the page
 * itself, and the rule that nothing reaches paper unescaped or with a link
 * still spelled the way the vault spells it.
 *
 * Extracted when the trip cost sheet became the second export. One print
 * stylesheet rather than two, because two would have drifted in margins
 * first and in typeface second, and a photo spot sheet and a cost sheet
 * printed on the same day should look like they came from the same plugin.
 *
 * App-free.
 */
import {
  displayWikilinks,
  listIsOrdered,
  type ProseBlock,
  type ProseListItem,
} from '@technosoftware/trail-core';

/**
 * Escaping alone, for a caller that has a reason to want exactly that.
 *
 * A note is user input: a booking called `<script>` or an exposure line with
 * an ampersand in it must arrive as text, not as markup. There is no branch
 * that skips this, which is why a sheet is assembled from escaped fragments
 * rather than by interpolating a model into a template.
 *
 * The sheets themselves take `pageText` below, which is this plus a note's
 * links resolved. The one caller here is the document title, which is the
 * browser's tab rather than the page.
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
       see. This declaration says so and is the one an engine may decline:
       Chromium honours it, WebKit does not implement it. It is kept because it
       costs nothing where it is read, and the rule below is what a sheet
       actually relies on. */
    break-after: avoid; page-break-after: avoid;
  }
  /* The wrapper section() puts round a heading and the first block under it.
     A break-inside of avoid is the one every engine implements, so this is a
     box a renderer cannot decline to keep whole rather than a request it may
     refuse. It lives here rather than in a sheet's own stylesheet because the
     markup was copied from one sheet to another once without it, and a
     prospect printed from Safari then stranded its heading for weeks. */
  .section-head { break-inside: avoid; page-break-inside: avoid; }
  h3 { font-size: 12pt; margin: 0; }
  .meta { color: #565c66; font-size: 9pt; margin: 0 0 2mm; }
  .sep { padding: 0 2mm; color: #adb2ba; }
  .stars { color: #a8801f; letter-spacing: 0.5pt; }
  header { border-bottom: 1pt solid #14161a; padding-bottom: 3mm; margin-bottom: 4mm; }
  footer { margin-top: 6mm; padding-top: 2mm; border-top: 0.5pt solid #c9ccd2;
           font-size: 8.5pt; color: #6b7079; }
  footer p { margin: 0 0 1mm; }
  /* A note's own words, wherever a sheet prints them. Both sheets had styled
     their overview separately and identically; the markup is one function now,
     so the rules are one too. */
  .prose p { margin: 0 0 2.5mm; white-space: pre-line; }
  .prose ul, .prose ol { margin: 0 0 2.5mm; padding-left: 6mm; }
  .prose li { margin: 0 0 0.8mm; }
  /* A sub-list belongs to the line above it, so it opens tight against it and
     keeps the gap that separates one top-level item from the next. */
  .prose li > ul, .prose li > ol { margin: 0.8mm 0 0; }
  .prose > :last-child { margin-bottom: 0; }
  /* A summary is handed over as two boxes so its heading can keep one
     paragraph and the rest can break (see proseSections). The gap between
     them is the one a paragraph's own margin used to carry, which the rule
     above takes off the last child of each box. */
  .prose + .prose { margin-top: 2.5mm; }
  /* The three or four lines somebody would read out to say why this is worth
     doing. A star rather than a bullet because it is a claim rather than an
     item, and it prints where a colour does not. Shared since the prospect
     grew the same section: one list style for one kind of list. */
  .highlights { list-style: none; margin: 0; padding: 0; }
  .highlights li { break-inside: avoid; padding: 1.2mm 0 1.2mm 6mm; position: relative;
                   border-bottom: 0.3pt solid #e2e4e8; }
  .highlights li::before { content: "\\2605"; position: absolute; left: 0; color: #a8801f; }
`;

/**
 * A note's own words, ready for paper: links resolved to what a reader sees,
 * then escaped.
 *
 * Two rules that had drifted apart. Escaping was a funnel every sheet went
 * through; resolving was one call in `highlightsHtml`, plus whatever the core
 * had already done to a summary it parsed. So a link typed into a day note, a
 * description, a cabin's words or a picture's caption printed its brackets,
 * while the same link in the summary above it did not.
 *
 * Resolving belongs with escaping rather than at the call sites somebody
 * remembers, for the reason `displayWikilinks` gives: a link's target is a
 * fact about the vault and no use at all to the person holding the paper. A
 * sheet cannot be made consistent by remembering; it is made consistent by
 * there being one way through.
 *
 * `src` and `href` pass through here as well and are unaffected: a path is not
 * a wikilink, so there is nothing in one for this to rewrite.
 */
export function pageText(value: string): string {
  return escapeHtml(displayWikilinks(value));
}

/** One label and value in the row under a heading. Used by both sheets. */
export function metaLine(parts: (string | null)[]): string {
  const kept = parts.filter((part): part is string => !!part && part.trim() !== '');
  if (kept.length === 0) return '';
  return `<div class="meta">${kept.join('<span class="sep">&middot;</span>')}</div>`;
}

/**
 * The star-bulleted list both sheets open with, ready for paper.
 *
 * A highlight naming `[[Stavanger]]` is a highlight about Stavanger: see
 * `pageText`, which every line here and every other word on a sheet goes
 * through.
 */
export function highlightsHtml(lines: readonly string[]): string {
  const rows = lines.map((line) => `<li>${pageText(line)}</li>`).join('');
  return `<ul class="highlights">${rows}</ul>`;
}

/**
 * A note's own words as markup: paragraphs, and lists that keep their nesting.
 *
 * The counterpart of `proseBlocks` in the core, which does the reading. The
 * split is the one this file already stands for: the core says what the note
 * says, and everything that reaches paper is escaped here. A parser that
 * returned markup would have handed this function a string it could no longer
 * escape, and a note is user input.
 *
 * Wrap it in an element carrying `prose`, which is where the rules above hang.
 */
export function proseHtml(blocks: readonly ProseBlock[]): string {
  return blocks
    .map((block) =>
      block.kind === 'paragraph' ? `<p>${pageText(block.text)}</p>` : proseListHtml(block.items)
    )
    .join('');
}

/** One level of a list, and every level under it. */
function proseListHtml(items: readonly ProseListItem[]): string {
  const tag = listIsOrdered(items) ? 'ol' : 'ul';
  const rows = items
    .map(
      (item) =>
        `<li>${pageText(item.text)}${item.items.length > 0 ? proseListHtml(item.items) : ''}</li>`
    )
    .join('');
  return `<${tag}>${rows}</${tag}>`;
}

/**
 * A section: its heading, glued to the first thing under it.
 *
 * **Why the heading is wrapped rather than told to stay.** A break-after of
 * avoid on the heading says exactly the right thing, and is the one property
 * an engine is free to ignore. Headless Chromium honours it; whatever printed
 * the first real PDF did not, and left the overview's heading alone at the
 * foot of a page naming a section three centimetres away. Adding that
 * declaration was correct code standing where it could never run.
 *
 * A break-inside of avoid is the one every engine implements, so the heading
 * and the first block become a single box that cannot be split. That is also
 * why only the FIRST block goes in: gluing all eleven days of an itinerary
 * into one unbreakable box asks for a box taller than the page, which an
 * engine resolves by breaking it anyway -- back where we started, and with the
 * itinerary starting on a fresh page for no reason. One block is always small
 * enough to move, and moving it is the whole of what is needed.
 *
 * The heading's own top margin collapses out through the wrapper, so the
 * spacing above a section is what it always was.
 *
 * It is here rather than in a sheet because it was written twice already. The
 * second copy arrived without the stylesheet rule that gives the wrapper its
 * meaning, so the markup was emitted for weeks by a sheet no engine had been
 * told to keep whole. A helper whose correctness depends on a rule in another
 * file has to ship with that rule, and `PRINT_PAGE_STYLE` above carries it.
 *
 * No blocks means no section: a sheet leaves out a heading it has nothing to
 * put under, rather than printing an empty one.
 */
export function section(label: string, blocks: string[]): string {
  if (blocks.length === 0) return '';
  const [first, ...rest] = blocks;
  return `<div class="section-head"><h2>${pageText(label)}</h2>${first}</div>${rest.join('')}`;
}

/**
 * A summary as the blocks `section()` takes: the first one on its own, the
 * rest together.
 *
 * The split is about the fold. `section()` glues its first block to the
 * heading, so a summary handed over whole puts all of it inside a box no
 * engine may break -- fine for a trip's three sentences, wrong for an
 * excursion, whose summary is an operator's own page of prose and whose page
 * one then ends early to keep it together. Thomas, deciding it: an overview as
 * text can be breakable, it might anyway not fit on one page.
 *
 * So the heading keeps one paragraph with it and everything after that breaks
 * where the page runs out. One box for the rest rather than one per block,
 * because there is nothing to gain from pinning paragraph three to paragraph
 * four, and a box per block would make every block a last child and collapse
 * the spacing between them.
 */
export function proseSections(blocks: readonly ProseBlock[]): string[] {
  if (blocks.length === 0) return [];

  const box = (part: readonly ProseBlock[]): string =>
    `<div class="overview prose">${proseHtml(part)}</div>`;
  const [first, ...rest] = blocks;

  return rest.length === 0 ? [box([first])] : [box([first]), box(rest)];
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
