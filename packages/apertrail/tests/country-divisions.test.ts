/**
 * What counts as a first-level division of a country.
 *
 * The membership is the decision, so it is tested away from the page that
 * prints it -- the split `card-actions.test.ts` exists for. It returns what
 * each entry IS rather than what it is called, which is what lets this run
 * without a locale loaded.
 *
 * The case that made it worth having: a Bundesland list for Germany that
 * stopped at Hessen, because Hamburg and Berlin are cities and `country.states`
 * deliberately holds only State notes.
 */
import { describe, expect, it } from 'vitest';
import { countryDivisions } from '../src/places/country-divisions';
import type { TravelCity, TravelCountry, TravelState } from '../src/vault/types';

function city(title: string, cityState: boolean): TravelCity {
  return { title, cityState } as TravelCity;
}

function state(title: string): TravelState {
  return { title } as TravelState;
}

function country(states: TravelState[], cities: TravelCity[]): TravelCountry {
  return { title: 'Germany', states, cities } as TravelCountry;
}

describe('countryDivisions', () => {
  it('is the states when the country has no city-state', () => {
    const divisions = countryDivisions(
      country([state('Hesse'), state('Bavaria')], [city('Wiesbaden', false)])
    );
    expect(divisions).toEqual([
      { title: 'Hesse', cityState: false },
      { title: 'Bavaria', cityState: false },
    ]);
  });

  /** Hamburg IS a Bundesland. A list that stopped at Hessen would be wrong on the page whatever the type says. */
  it('puts the city-states back among them, saying which they are', () => {
    const divisions = countryDivisions(
      country(
        [state('Hesse')],
        [city('Berlin', true), city('Hamburg', true), city('Wiesbaden', false)]
      )
    );
    expect(divisions).toEqual([
      { title: 'Hesse', cityState: false },
      { title: 'Berlin', cityState: true },
      { title: 'Hamburg', cityState: true },
    ]);
  });

  /** A country that uses no state level at all is still allowed to have one of these. */
  it('is the city-states alone when there are no state notes', () => {
    expect(countryDivisions(country([], [city('Singapore', true)]))).toEqual([
      { title: 'Singapore', cityState: true },
    ]);
  });

  it('is empty for a country with neither', () => {
    expect(countryDivisions(country([], [city('Oslo', false)]))).toEqual([]);
  });
});
