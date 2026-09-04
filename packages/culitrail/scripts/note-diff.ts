/**
 * A unified diff, so a dry run says what it would do rather than how many
 * things it would do to how many files.
 *
 * Written here rather than pulled in, because the repository has no diff
 * dependency and a script whose whole promise is "look at this before you let
 * it write" should not be the reason it gains one. The quadratic LCS is fine on
 * files this size: a meal note is forty lines.
 *
 * Its own module beside `note-text.ts` rather than inside one of the scripts,
 * for the reason that file gives: a second script wanting the same diff would
 * otherwise either copy it, and the copy would drift, or import a whole
 * migration it has no other use for. Nothing here knows what a meal is.
 */
export function unifiedDiff(before: string, after: string, label: string, context = 3): string {
  const a = before.split('\n');
  const b = after.split('\n');

  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0)
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const ops: { kind: ' ' | '-' | '+'; text: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ kind: ' ', text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ kind: '-', text: a[i++] });
    } else {
      ops.push({ kind: '+', text: b[j++] });
    }
  }
  while (i < a.length) ops.push({ kind: '-', text: a[i++] });
  while (j < b.length) ops.push({ kind: '+', text: b[j++] });

  const keep = new Set<number>();
  ops.forEach((op, index) => {
    if (op.kind === ' ') return;
    for (let k = index - context; k <= index + context; k++) {
      if (k >= 0 && k < ops.length) keep.add(k);
    }
  });
  if (keep.size === 0) return '';

  const aAt: number[] = [];
  const bAt: number[] = [];
  let aLine = 1;
  let bLine = 1;
  for (const op of ops) {
    aAt.push(aLine);
    bAt.push(bLine);
    if (op.kind !== '+') aLine++;
    if (op.kind !== '-') bLine++;
  }

  const out = [`--- a/${label}`, `+++ b/${label}`];
  const indices = [...keep].sort((x, y) => x - y);

  let cursor = 0;
  while (cursor < indices.length) {
    let end = cursor;
    while (end + 1 < indices.length && indices[end + 1] === indices[end] + 1) end++;

    const hunk = indices.slice(cursor, end + 1).map((index) => ops[index]);
    const removed = hunk.filter((op) => op.kind !== '+').length;
    const added = hunk.filter((op) => op.kind !== '-').length;

    out.push(`@@ -${aAt[indices[cursor]]},${removed} +${bAt[indices[cursor]]},${added} @@`);
    for (const op of hunk) out.push(`${op.kind}${op.text}`);
    cursor = end + 1;
  }

  return out.join('\n');
}
