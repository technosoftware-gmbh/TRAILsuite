/**
 * A full-screen image overlay, and the one-liner that makes an existing
 * `<img>` open it.
 *
 * Meal images are rendered small so they do not push the ingredients below
 * the fold. The lightbox is what makes that acceptable: a photo is worth
 * looking at properly when somebody chooses to, and worth staying out of the
 * way the rest of the time.
 */
import { t } from '../lang/I18nManager';

export function openLightbox(source: string): void {
  const overlay = activeDocument.body.createDiv({ cls: 'culi-lightbox-overlay' });

  const close = () => {
    overlay.remove();
    activeDocument.removeEventListener('keydown', onKey);
  };

  // Registered on the document rather than the overlay because the overlay
  // never holds focus, and removed again by close() so a lightbox that has
  // been dismissed does not keep listening for the rest of the session.
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close();
  };
  activeDocument.addEventListener('keydown', onKey);

  const closeButton = overlay.createEl('button', {
    cls: 'culi-lightbox-close',
    text: '×',
    attr: { 'aria-label': t('ui.lightbox.close') },
  });
  closeButton.addEventListener('click', close);

  const image = overlay.createEl('img', { cls: 'culi-lightbox-img', attr: { src: source } });
  // Clicking the backdrop closes; clicking the picture itself does not, which
  // is what lets somebody drag or long-press the image without dismissing it.
  image.addEventListener('click', (event) => event.stopPropagation());
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
}

export function makeLightboxable(image: HTMLImageElement): void {
  image.addClass('culi-lightbox-trigger');
  image.addEventListener('click', () => openLightbox(image.src));
}
