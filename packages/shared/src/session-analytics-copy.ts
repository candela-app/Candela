export type AnalyticsMetricId = 'accuracy' | 'reaction' | 'efficiency' | 'wrongTapRate' | 'missRate' | 'duration';

export const ANALYTICS_X_AXIS = 'Date';

export const ANALYTICS_METRICS: {
  id: AnalyticsMetricId;
  label: string;
  unit: string;
  direction: string;
  color: string;
  yAxis: string;
}[] = [
  { id: 'accuracy', label: 'Accuracy', unit: '%', direction: 'Should be higher', color: '#1F6F64', yAxis: 'Accuracy (%)' },
  { id: 'reaction', label: 'Avg reaction time', unit: 's', direction: 'Should be less', color: '#3E5C76', yAxis: 'Reaction time (s)' },
  { id: 'efficiency', label: 'Efficiency', unit: '', direction: 'Should be higher', color: '#1E4D7B', yAxis: 'Efficiency' },
  { id: 'wrongTapRate', label: 'Wrong-tap rate', unit: '%', direction: 'Should be less', color: '#8C5A4F', yAxis: 'Wrong-tap rate (%)' },
  { id: 'missRate', label: 'Miss rate', unit: '%', direction: 'Should be less', color: '#5C5470', yAxis: 'Miss rate (%)' },
  { id: 'duration', label: 'Time to finish', unit: 's', direction: 'Should be less', color: '#6B4C9A', yAxis: 'Time to finish (s)' },
];

export type AnalyticsTrendRow = { pattern: string; reading: string };

export type AnalyticsGraphGuide = {
  id: AnalyticsMetricId;
  title: string;
  meaning: string;
  trends: AnalyticsTrendRow[];
};

export const ANALYTICS_DOTS_GUIDE = {
  title: 'The dots',
  body: 'The chart opens on the last 7 calendar days. Use + to go week → month → year (one dot per month). Use − to go back. Scroll sideways for older periods. Days or months with no play have no dot. Module, level, and From–To filters apply to every chart, including time to finish.',
};

export const ANALYTICS_SESSION_GUIDE = {
  title: 'Session #',
  body: 'Sequential for this patient and does not reset if they change doctor. Pick one module so the line compares like with like. Optionally pick a level; leave Level on All levels for the whole module. Mixing games or devices on one line is noisy.',
};

export const ANALYTICS_RATES_NOTE =
  'That is why you store counts and rates, and plot rates. Raw counts can fall just because the session had fewer trials.';

export const ANALYTICS_GRAPH_GUIDES: AnalyticsGraphGuide[] = [
  {
    id: 'accuracy',
    title: 'Accuracy',
    meaning:
      'Share of attempts that were correct. Formula: correct ÷ (correct + wrong taps + misses + timeouts).',
    trends: [
      { pattern: 'Accuracy ↑, RT stable', reading: 'Finding the target more reliably' },
      { pattern: 'Accuracy ↑, RT ↓', reading: 'Real improvement (also check Efficiency)' },
      { pattern: 'Accuracy ↑, RT ↑ a lot', reading: 'Slowing down to stay correct — not necessarily more skilled' },
      {
        pattern: 'Accuracy ↓ after a hard level or new device',
        reading: 'Compare like-with-like before calling it a setback',
      },
    ],
  },
  {
    id: 'reaction',
    title: 'Avg reaction time',
    meaning:
      'Mean time to a correct hit, in seconds. Wrong taps, misses, and timeouts are not in this average.',
    trends: [
      { pattern: 'RT ↓, accuracy stable or ↑', reading: 'Faster search without giving up correctness' },
      { pattern: 'RT ↓, accuracy ↓', reading: 'Rushing — look at wrong taps and misses' },
      { pattern: 'RT ↑, accuracy ↑', reading: 'More careful; Efficiency tells you if skill actually rose' },
      { pattern: 'One slow day only', reading: 'Normal noise — don’t treat 2 dots as a trend' },
    ],
  },
  {
    id: 'efficiency',
    title: 'Efficiency (Index of Performance)',
    meaning:
      'Accuracy (%) ÷ mean reaction time (seconds). Higher means both faster and more accurate. Use this when Accuracy and RT move in opposite directions.',
    trends: [
      { pattern: 'Efficiency ↑', reading: 'Better speed–accuracy together' },
      { pattern: 'Accuracy ↑ but Efficiency flat/↓', reading: 'They got more careful, not faster' },
      { pattern: 'RT ↓ but Efficiency flat/↓', reading: 'Faster but sloppier' },
      {
        pattern: 'Efficiency is the “getting better” line',
        reading: 'Trust it when Accuracy and RT disagree',
      },
    ],
  },
  {
    id: 'wrongTapRate',
    title: 'Wrong-tap rate',
    meaning: 'Share of attempts that hit the wrong target. Lower is better.',
    trends: [
      { pattern: 'Wrong taps ↓, RT stable, accuracy ↑', reading: 'Better discrimination' },
      { pattern: 'Wrong taps ↓ but RT ↑ a lot', reading: 'More careful, not necessarily more skilled (Efficiency catches this)' },
      { pattern: 'Accuracy ↑ but wrong + miss flat', reading: 'Check if they just did fewer trials' },
    ],
  },
  {
    id: 'missRate',
    title: 'Miss rate',
    meaning: 'Share of attempts with no hit in time (empty space / timeout). Lower is better.',
    trends: [
      { pattern: 'Misses ↓, wrong taps stable', reading: 'Better aiming / motor control' },
      { pattern: 'Wrong taps ↓, RT stable, accuracy ↑', reading: 'Better discrimination' },
      { pattern: 'Accuracy ↑ but wrong + miss flat', reading: 'Check if they just did fewer trials' },
    ],
  },
  {
    id: 'duration',
    title: 'Time to finish',
    meaning:
      'How long the sitting lasted, in seconds (stored durationSec). Default: mean of finished plays in that day (or month on year scale). Best of day: shortest sitting. Same module, level, and From–To filters as the other charts. Not the same as avg reaction time (that is time to a correct hit). Compare like-with-like: same module and level. A session that hit a time cap looks stuck, not “fast.”',
    trends: [
      { pattern: 'Time to finish ↓, accuracy stable or ↑', reading: 'Faster finish without giving up correctness' },
      { pattern: 'Time to finish ↓, accuracy ↓', reading: 'Rushing — look at wrong taps and misses' },
      { pattern: 'Time to finish ↑, accuracy ↑', reading: 'More careful; Efficiency / RT say if skill rose' },
      { pattern: 'Time to finish stuck at the time limit', reading: 'They are hitting the cap, not finishing faster' },
    ],
  },
];
