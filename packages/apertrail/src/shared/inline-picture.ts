/**
 * A vault picture as something an `<img>` can use, downscaled on the way.
 *
 * Extracted from the trip document when the ship brochure became its second
 * consumer, which is this plugin's own bar for moving something: one consumer
 * is a helper inside its file, two is a shared one.
 */
import { App } from 'obsidian';
import { resolveImageFile } from '../ui/components/image-resolve';
import { ABSOLUTE_URL_RE } from './vault-file';

/**
 * Longest edge a picture is scaled to before it goes into the file.
 *
 * Wider than the field sheet's 1400, because this one has a hero picture
 * across the full 190 mm of an A4 page where that one has 52 mm thumbnails.
 * 1800 is over 240 dpi at that width, which is more than a page printed at
 * home resolves, and it keeps a twenty-picture gallery inside the few
 * megabytes a file has to stay under to be worth mailing.
 */
const MAX_IMAGE_EDGE = 1800;

/**
 * A picture as something an `<img>` can use, downscaled on the way.
 *
 * An external URL is left exactly as it stands: there are no bytes in the
 * vault to inline, and the URL goes on working wherever the file is copied
 * as long as there is a network -- which beats the alternative of printing
 * nothing. Everything else is read out of the vault and re-encoded, because
 * the whole point of the export is a file that needs nothing around it.
 *
 * Downscaling matters more than it looks: a gallery of twenty
 * straight-out-of-camera frames would be two hundred megabytes, which is not
 * a file anybody sends anywhere. Anything the canvas cannot read (an unusual
 * format, a file that has gone missing) comes back null, and the caption
 * prints without it.
 */
export async function inlinePicture(app: App, value: string): Promise<string | null> {
  if (ABSOLUTE_URL_RE.test(value)) return value;

  const file = resolveImageFile(app, value);
  if (!file) return null;

  try {
    const bytes = await app.vault.readBinary(file);
    const bitmap = await createImageBitmap(new Blob([bytes]));

    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = activeDocument.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    // A picture that cannot be read is not a reason to refuse the document.
    return null;
  }
}
