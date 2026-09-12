/**
 * What a note shows on a cover: the line under its title, the one picture that
 * stands for it, and the rest of them.
 *
 * `image:` and `gallery:` are not a trip's and not a ship's -- every note this
 * plugin draws a card for may carry one, and until the prospect wanted them
 * only the trip and the vehicle read them into a parsed shape. Everything else
 * reached into frontmatter at the moment it needed a picture, which is how a
 * place could carry a gallery nothing would ever look at.
 *
 * The gallery's entry shape is the trip's, deliberately: it was already a
 * format written into notes, and a second spelling of "a picture and its
 * caption" would be a second thing to keep in step.
 *
 * `description:` is the same property a Person, a Company and a ship already
 * carry -- one line, in the words a brochure would use, with the long version
 * in the note's own `> [!SUMMARY]` block. Reading it here is what gives a
 * place, a city, a state and a country a subtitle on their prospect.
 *
 * `highlights:` was a trip's alone, and being a trip's was the only thing
 * wrong with it: the three or four lines somebody would read out to say why
 * this is worth doing are what an excursion's page opens with too, and they
 * had nowhere to live but inside the summary, where a prospect printed them
 * as prose. It is the trip's own property, read the trip's own way, so a
 * vault that spells it something else spells it once.
 */
import { ParsedTripPicture } from '../trips/trip-note';
import { APERtrailSettings } from '../settings/types';
import { findValue, readTextLines } from '@technosoftware/trail-core';

export interface NoteCover {
  /** One line under the title. Null when the note says nothing. */
  description: string | null;
  /** The one picture that stands for it, exactly as the note wrote it: a vault path, a wikilink or a URL. */
  image: string | null;
  /** The rest of them, in the order they were chosen. */
  gallery: ParsedTripPicture[];
  /** Why this is worth doing, one line each, in the note's own order. Empty when it says nothing. */
  highlights: string[];
}

export function readNoteCover(fm: Record<string, unknown>, settings: APERtrailSettings): NoteCover {
  const description = findValue(fm, settings.descriptionProperty);
  const raw = findValue(fm, settings.imageProperty);
  const entries = findValue(fm, settings.tripGalleryProperty);

  return {
    highlights: readTextLines(findValue(fm, settings.tripHighlightsProperty)),
    description:
      typeof description === 'string' && description.trim() !== '' ? description.trim() : null,
    image: typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null,
    gallery: Array.isArray(entries)
      ? entries.flatMap((entry) => {
          if (typeof entry !== 'object' || entry === null) return [];
          const row = entry as Record<string, unknown>;
          const image = row[settings.galleryImageField];
          if (typeof image !== 'string' || image.trim() === '') return [];
          const caption = row[settings.galleryCaptionField];
          return [
            {
              image: image.trim(),
              caption: typeof caption === 'string' && caption.trim() !== '' ? caption.trim() : null,
            },
          ];
        })
      : [],
  };
}
