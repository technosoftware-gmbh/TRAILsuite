/**
 * A URL reduced to its host, for a card meta row that has no space for the
 * whole thing: "landquartfashionoutlet.ch" rather than the full link.
 *
 * Shared by the place cards and the company cards, which want the same
 * treatment of the same kind of value. Left as-is when it does not look
 * like a URL at all, since a note may hold something else there and a card
 * showing the raw value beats a card showing nothing.
 */
export function shortUrl(raw: string): string {
  const match = /^https?:\/\/(?:www\.)?([^/?#]+)/i.exec(raw.trim());
  return match ? match[1] : raw;
}
