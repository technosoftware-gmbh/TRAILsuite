/**
 * The four words `tripItemEstimates()` needs and refuses to know itself.
 *
 * The estimate builder is pure and takes its labels as arguments, so that
 * every consumer of it would otherwise assemble the same four `t()` calls.
 * One file, so the costs block, the cost sheet and the itinerary all read a
 * leg the same way round.
 */
import { t } from '../../lang/I18nManager';
import { EstimateLabelWords } from './estimates';

export function estimateLabels(): EstimateLabelWords {
  return {
    joiner: t('itinerary.legJoiner'),
    legFallback: t('itinerary.unnamedLeg'),
    nightFallback: t('itinerary.unnamedNight'),
    stopFallback: t('itinerary.unnamedStop'),
  };
}
