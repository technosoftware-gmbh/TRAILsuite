/**
 * What the leg editor offers, and why it never insists.
 *
 * Three fields on a leg name things the vault may or may not have a note for:
 * who runs it, which ship, which cabin. Each one suggests what the vault knows
 * and accepts anything typed -- the rule `carrier` has had from the start,
 * because most airlines will never be a note and an overnight coach never will.
 *
 * The narrowing is the point. Choose Hurtigruten and the ship list is her
 * ships; name the ship and the cabin list is her cabins. But **a filter that
 * empties a list is worse than no filter**: somebody who typed "Helvetic Airs"
 * for an airline that is not in their CRM must still see every ship they have,
 * not none. So a carrier that matches no operator narrows nothing.
 *
 * Cabins are the one exception, and deliberately: with no ship named there is
 * nothing to be the cabins OF, and offering every cabin in the vault would be
 * a list of other ships' rooms. Empty is the honest answer there.
 *
 * Pure, and free of the vault: it takes the titles and cabins it needs.
 */

/** A vehicle as this module wants it: what it is called, who runs it, and what it is sold in. */
export interface SuggestableVehicle {
  title: string;
  operatorTitle: string | null;
  cabins: { name: string }[];
}

const fold = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase();

/**
 * The ships to offer for a leg whose carrier reads `carrier`.
 *
 * Every ship when the carrier is blank, and every ship when it names an
 * operator no vehicle has -- see this file's own note on why an empty list is
 * the wrong answer to a filter that matched nothing.
 */
export function vehiclesForCarrier(
  vehicles: readonly SuggestableVehicle[],
  carrier: string | null
): SuggestableVehicle[] {
  const wanted = fold(carrier);
  if (wanted === '') return [...vehicles];

  const operated = vehicles.filter((vehicle) => fold(vehicle.operatorTitle) === wanted);
  return operated.length > 0 ? operated : [...vehicles];
}

/**
 * The cabin names to offer for a leg on `vehicleTitle`.
 *
 * Empty when no ship is named or the name matches none, which is the honest
 * answer: a cabin belongs to a ship, and a list of every cabin in the vault
 * would be other ships' rooms.
 */
export function cabinsForVehicle(
  vehicles: readonly SuggestableVehicle[],
  vehicleTitle: string | null
): string[] {
  const wanted = fold(vehicleTitle);
  if (wanted === '') return [];

  const found = vehicles.find((vehicle) => fold(vehicle.title) === wanted);
  return found ? found.cabins.map((cabin) => cabin.name) : [];
}
