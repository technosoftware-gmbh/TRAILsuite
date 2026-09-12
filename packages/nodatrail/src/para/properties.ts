/**
 * The one mapping from settings to the property names each PARA parser needs.
 *
 * One place, so that four readers, four writers and the health check cannot
 * disagree about which setting names a project's goals. Every one of these is a
 * projection rather than a copy: the settings object stays the single source.
 */
import type { NODAtrailSettings } from '../settings/types';
import type {
  GoalProperties,
  ParaCommonProperties,
  ProjectProperties,
  ResourceProperties,
} from './parse';
import type { TypeProperties } from './write';

export function commonProperties(settings: NODAtrailSettings): ParaCommonProperties {
  return {
    imageProperty: settings.imageProperty,
    priorityProperty: settings.priorityProperty,
    archivedProperty: settings.archivedProperty,
  };
}

export function goalProperties(settings: NODAtrailSettings): GoalProperties {
  return {
    ...commonProperties(settings),
    areaProperty: settings.goalAreaProperty,
    statusProperty: settings.goalStatusProperty,
    deadlineProperty: settings.deadlineProperty,
    achievedProperty: settings.achievedProperty,
    closedProperty: settings.closedProperty,
  };
}

export function projectProperties(settings: NODAtrailSettings): ProjectProperties {
  return {
    ...commonProperties(settings),
    goalsProperty: settings.projectGoalsProperty,
    areaProperty: settings.projectAreaProperty,
    statusProperty: settings.projectStatusProperty,
    deadlineProperty: settings.deadlineProperty,
    completedProperty: settings.completedProperty,
    closedProperty: settings.closedProperty,
  };
}

export function resourceProperties(settings: NODAtrailSettings): ResourceProperties {
  return {
    ...commonProperties(settings),
    areaProperty: settings.resourceAreaProperty,
    topicProperty: settings.resourceTopicProperty,
    sourceProperty: settings.resourceSourceProperty,
    tagProperty: settings.resourceTagProperty,
  };
}

export function typeProperties(settings: NODAtrailSettings, typeValue: string): TypeProperties {
  return { typePropertyName: settings.typePropertyName, typeValue };
}
