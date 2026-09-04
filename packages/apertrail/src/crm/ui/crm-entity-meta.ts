/**
 * Builds the card meta row for a Person and a Company -- the CRM
 * counterpart of ui/dashboard/travel-entity-meta.ts, and shared the same
 * way between the CRM dashboard's sections and the combined gallery, so an
 * entity reads identically on both.
 *
 * Contact details lead, because that is what a CRM card is for. A person
 * card is the answer to "how do I reach them", not to "who are they".
 */
import { EntityCardMetaItem } from '../../ui/components/entity-card';
import { shortUrl } from '../../shared/short-url';
import { CrmCompany, CrmPerson } from '../types';

export function personMetaItems(person: CrmPerson): EntityCardMetaItem[] {
  const items: EntityCardMetaItem[] = [];
  if (person.description) items.push({ icon: 'info', text: person.description });
  if (person.tags.length > 0) items.push({ icon: 'tag', text: person.tags.join(', ') });
  if (person.email) items.push({ icon: 'mail', text: person.email });
  if (person.mobile) items.push({ icon: 'phone', text: person.mobile });
  if (person.address) items.push({ icon: 'navigation', text: person.address });
  return items;
}

export function companyMetaItems(company: CrmCompany): EntityCardMetaItem[] {
  const items: EntityCardMetaItem[] = [];
  if (company.description) items.push({ icon: 'info', text: company.description });
  if (company.tags.length > 0) items.push({ icon: 'tag', text: company.tags.join(', ') });
  if (company.website) items.push({ icon: 'link', text: shortUrl(company.website) });
  if (company.email) items.push({ icon: 'mail', text: company.email });
  if (company.phone) items.push({ icon: 'phone', text: company.phone });
  if (company.address) items.push({ icon: 'navigation', text: company.address });
  return items;
}
