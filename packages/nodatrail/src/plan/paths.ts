/**
 * Which template each period level uses, and where its note goes.
 *
 * A projection over the settings object, so nothing else in the plugin has to
 * remember that `quarterlyPath` is the quarter's template.
 */
import {
  expandPeriodPath,
  periodFolder,
  periodTitleFromTemplate,
  type PeriodLevel,
} from 'trail-core';
import type { NODAtrailSettings } from '../settings/types';

export function templateFor(settings: NODAtrailSettings, level: PeriodLevel): string {
  switch (level) {
    case 'day':
      return settings.dailyPath;
    case 'week':
      return settings.weeklyPath;
    case 'month':
      return settings.monthlyPath;
    case 'quarter':
      return settings.quarterlyPath;
    case 'year':
      return settings.yearlyPath;
  }
}

/** The `type:` value that marks a note at this level. */
export function typeValueFor(settings: NODAtrailSettings, level: PeriodLevel): string {
  switch (level) {
    case 'day':
      return settings.dayTypeValue;
    case 'week':
      return settings.weekTypeValue;
    case 'month':
      return settings.monthTypeValue;
    case 'quarter':
      return settings.quarterTypeValue;
    case 'year':
      return settings.yearTypeValue;
  }
}

export function notePathFor(settings: NODAtrailSettings, level: PeriodLevel, date: Date): string {
  return expandPeriodPath(templateFor(settings, level), date);
}

export function noteFolderFor(settings: NODAtrailSettings, level: PeriodLevel, date: Date): string {
  return periodFolder(templateFor(settings, level), date);
}

export function noteTitleFor(settings: NODAtrailSettings, level: PeriodLevel, date: Date): string {
  return periodTitleFromTemplate(templateFor(settings, level), date);
}
