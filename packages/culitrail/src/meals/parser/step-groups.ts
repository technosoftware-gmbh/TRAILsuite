/**
 * A body section's sub-headings and the raw lines under each.
 *
 * No idea of what a step is lives here. The reheating reader is the only
 * caller left and it has its own rule -- a block is usually one or two
 * sentences and yields one step -- so the walker is separated from the rule,
 * which is what stopped the two from drifting apart when there were two of
 * them.
 *
 * App-free.
 */
import { findHeading } from './body-sections';

const HEADING = /^(#{1,6})\s+(.+?)(?:\s+#+)?$/;

/** One group's own lines, before any decision about what a step is. */
export interface RawGroup {
  heading: string | null;
  headingLevel: number;
  lines: string[];
}

export interface RawSplit {
  before: string;
  groups: RawGroup[];
  after: string;
}

/** The section's sub-headings and the lines under each, with no step rule applied. */
export function splitIntoGroups(body: string, headingName: string): RawSplit {
  const lines = body.split('\n');
  const { index: headingIndex, level: headingLevel } = findHeading(lines, headingName);

  if (headingIndex < 0) return { before: body, groups: [], after: '' };

  const before = lines.slice(0, headingIndex).join('\n');
  const groups: RawGroup[] = [];
  let afterStart = lines.length;
  let currentHeading: string | null = null;
  let currentLevel = 0;
  let currentLines: string[] = [];

  const flush = (): void => {
    groups.push({ heading: currentHeading, headingLevel: currentLevel, lines: currentLines });
    currentLines = [];
  };

  for (let i = headingIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const heading = HEADING.exec(line);

    if (heading) {
      if (heading[1].length <= headingLevel) {
        afterStart = i;
        break;
      }
      flush();
      currentHeading = heading[2].trim();
      currentLevel = heading[1].length;
    } else {
      currentLines.push(line);
    }
  }
  flush();

  return { before, groups, after: lines.slice(afterStart).join('\n') };
}
