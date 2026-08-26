/** Website shell tokens — mirrored from mobile theme / dashboard MODULE_CARDS. */

export const shellColors = {
  page: '#F4F7FC',
  white: '#FFFFFF',
  ink: '#1A1A1A',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  blue: '#2563EB',
  red: '#DC2626',
} as const;

export type ModuleCard = {
  uiId: string;
  title: string;
  body: string;
  badge: string;
  accent: string;
  bar: string;
};

export const MODULE_CARDS: ModuleCard[] = [
  {
    uiId: 'wheel',
    title: 'Rotatory Module',
    body: 'Dynamic wheel tracking & visual pursuit exercises',
    badge: 'For Tabs',
    accent: '#1D4ED8',
    bar: '#3B82F6',
  },
  {
    uiId: 'sorting',
    title: 'Sorting Module',
    body: 'Visual discrimination & sequential recognition',
    badge: 'For Tabs & Mobile',
    accent: '#7C3AED',
    bar: '#8B5CF6',
  },
  {
    uiId: 'tracing',
    title: 'Bee Path Tracing',
    body: 'Smooth pursuit tracking & visual-motor path control',
    badge: 'For Touch & Stylus',
    accent: '#D97706',
    bar: '#F59E0B',
  },
  {
    uiId: 'pursuit',
    title: 'Pursuit Module',
    body: 'Continuous visual pursuit & selective attention tracking',
    badge: 'For All Devices',
    accent: '#0891B2',
    bar: '#22D3EE',
  },
  {
    uiId: 'mobile_target',
    title: 'Bubble Chase',
    body: '2-target bouncing pursuit & dark field tracking',
    badge: 'For Mobile & Tabs',
    accent: '#059669',
    bar: '#34D399',
  },
  {
    uiId: 'geoboard',
    title: 'Draw a Pattern',
    body: 'Hand-eye coordination & visual spatial recall patterns',
    badge: 'For All Devices',
    accent: '#0D9488',
    bar: '#14B8A6',
  },
  {
    uiId: 'peripheral',
    title: 'Peripheral View',
    body: 'Hex-hive peripheral field awareness — left, right, or both',
    badge: 'Landscape only',
    accent: '#4338CA',
    bar: '#818CF8',
  },
  {
    uiId: 'number_search',
    title: 'Number Search',
    body: 'Find digits hidden in a crowded field of mixed letters',
    badge: 'For All Devices',
    accent: '#B45309',
    bar: '#F59E0B',
  },
];
