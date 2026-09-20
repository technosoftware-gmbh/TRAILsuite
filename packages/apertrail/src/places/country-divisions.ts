/**
 * A country's first-level divisions, as a reader of that country would list
 * them.
 *
 * Pure, and separate from the page that prints it, for the reason
 * `ui/gallery/card-actions.ts` is separate from the menu it fills: the
 * membership of this list is a decision, and a decision taken inside DOM
 * building is one no test can reach. It returns what each entry IS and not
 * what it is called, so the words live at the edge that renders them and this
 * can be checked without a locale.
 *
 * **City-states ride along with the states.** They are not State notes and
 * they are deliberately not in `country.states` -- a city that is its own
 * division stays a city, and making that collection hold both would push the
 * union into every consumer. But Hamburg IS a Bundesland, and a list of German
 * ones that stopped at Hessen would be wrong on the page whatever the type
 * says. This is the one place the two are put back together, and each entry
 * says which it is so the page can name it accordingly.
 */
import { TravelCountry } from '../vault/types';

export interface CountryDivision {
  title: string;
  /** The division is a city that is its own: a Stadtstaat, a federal district. */
  cityState: boolean;
}

/** The states, then the city-states, each half already alphabetical from the board. */
export function countryDivisions(country: TravelCountry): CountryDivision[] {
  return [
    ...country.states.map((state) => ({ title: state.title, cityState: false })),
    ...country.cities
      .filter((city) => city.cityState)
      .map((city) => ({ title: city.title, cityState: true })),
  ];
}
