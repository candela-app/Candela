export type AnalyticsMetricId = 'accuracy' | 'reaction' | 'efficiency' | 'wrongTapRate' | 'missRate';

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
  body: 'One date per dot. Same-day games stay as separate rows in the database; the plot averages them (or uses the best session if you pick Best of day). Hover or tap a dot to see every Session # that day. Do not treat two dots as a confident “getting better” line.',
};

export const ANALYTICS_SESSION_GUIDE = {
  title: 'Session #',
  body: 'Sequential for this patient and does not reset if they change doctor. Pick one module so the line compares like with like. Mixing games or devices on one line is noisy.',
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
    title: 'Efficiency (IP)',
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
      { pattern: 'Wrong taps ↓ but RT ↑ a lot', reading: 'More careful, not necessarily more skilled (efficiency catches this)' },
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
];
