export const ALL_MODULE_IDS = [
  'rotatory',
  'sorting',
  'bee_tracing',
  'pursuit',
  'mobile_target',
  'geoboard',
  'peripheral_view',
  'number_search',
  'pattern_match',
] as const;

export type TherapyModuleId = (typeof ALL_MODULE_IDS)[number];

export function isTherapyModuleId(id: string): id is TherapyModuleId {
  return (ALL_MODULE_IDS as readonly string[]).includes(id);
}
