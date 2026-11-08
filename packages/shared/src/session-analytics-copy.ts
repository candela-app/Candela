import { validReactionSamples } from './game-logic';

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
  body: 'Sequential for this patient and does not reset if they change doctor. One module per chart. A level filter compares that level only. All levels stays inside the selected module.',
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
    title: 'Efficiency',
    meaning:
      'This module’s accuracy or path adherence, divided by this module’s mean time in seconds. It is not a score you can compare with another module.',
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

export type AnalyticsMetricDef = {
  id: AnalyticsMetricId;
  label: string;
  unit: string;
  direction: string;
  color: string;
  yAxis: string;
  meaning: string;
  trends: AnalyticsTrendRow[];
};

export const ANALYTICS_SELECT_GAME = {
  title: 'Choose a module',
  body: 'Charts stay blank until one module is selected. Each module keeps its own scores. Games are not averaged together.',
};

const METRIC_COLOR: Record<AnalyticsMetricId, string> = {
  accuracy: '#1F6F64',
  reaction: '#3E5C76',
  efficiency: '#1E4D7B',
  wrongTapRate: '#8C5A4F',
  missRate: '#5C5470',
  duration: '#6B4C9A',
};

const GAMES_WITHOUT_MISS = new Set(['bee_tracing', 'location_memory', 'direction_sense', 'familiar_faces']);

function metricDef(
  id: AnalyticsMetricId,
  label: string,
  unit: string,
  direction: string,
  yAxis: string,
  meaning: string,
  trends: AnalyticsTrendRow[],
): AnalyticsMetricDef {
  return { id, label, unit, direction, color: METRIC_COLOR[id], yAxis, meaning, trends };
}

function accuracyCopy(gameId: string): { label: string; yAxis: string; meaning: string } {
  if (gameId === 'bee_tracing') {
    return {
      label: 'Path adherence',
      yAxis: 'Path adherence (%)',
      meaning: 'Stored percent of the trace inside the corridor. It is not rounds divided by deviation events.',
    };
  }
  if (gameId === 'geoboard') {
    return {
      label: 'Pattern accuracy',
      yAxis: 'Pattern accuracy (%)',
      meaning: 'Correct patterns divided by correct patterns, wrong patterns, incomplete patterns, and timeouts.',
    };
  }
  if (gameId === 'rotatory') {
    return {
      label: 'Accuracy',
      yAxis: 'Accuracy (%)',
      meaning:
        'Correct targets divided by targets plus every wrong tap and wheel tap. A letter that was found after extra taps is not 100%.',
    };
  }
  if (gameId === 'pattern_match' || gameId === 'number_search') {
    return {
      label: 'Accuracy',
      yAxis: 'Accuracy (%)',
      meaning:
        'Correct hits divided by correct hits, wrong taps, empty taps, and timeouts. Each unfinished item when the timer ends counts as one timeout.',
    };
  }
  return {
    label: 'Accuracy',
    yAxis: 'Accuracy (%)',
    meaning: 'Correct responses divided by correct responses, wrong taps, misses, and timeouts stored for this module.',
  };
}

function reactionCopy(gameId: string): { label: string; yAxis: string; meaning: string } {
  if (gameId === 'bee_tracing') {
    return {
      label: 'Time to first grab',
      yAxis: 'Time to first grab (s)',
      meaning: 'Mean stored time from the round being ready until the first grab. Samples that are not a finite time at or above zero are ignored.',
    };
  }
  if (gameId === 'geoboard') {
    return {
      label: 'Time to finish a correct pattern',
      yAxis: 'Pattern time (s)',
      meaning: 'Mean stored time to complete a correct pattern. This is not an onset-to-tap reaction time.',
    };
  }
  if (gameId === 'rotatory' || gameId === 'sorting' || gameId === 'pursuit' || gameId === 'mobile_target') {
    return {
      label: 'Time to the correct hit',
      yAxis: 'Time to the correct hit (s)',
      meaning: 'Mean stored time until the correct hit, including hits that followed an earlier wrong tap. Non-finite and negative samples are ignored.',
    };
  }
  return {
    label: 'Time to the correct response',
    yAxis: 'Time to the correct response (s)',
    meaning: 'Mean stored time from the target appearing to the correct response. Non-finite and negative samples are ignored.',
  };
}

function efficiencyCopy(gameId: string): string {
  const score = gameId === 'bee_tracing' ? 'Path adherence' : 'Accuracy';
  return `${score} (%) divided by this module’s mean time in seconds. It describes only this module. It is not a score you can compare with another game.`;
}

/** Metric catalog for one module. An empty game id returns nothing. */
export function analyticsMetricsForGame(gameId: string): AnalyticsMetricDef[] {
  if (!gameId) return [];
  const accuracy = accuracyCopy(gameId);
  const reaction = reactionCopy(gameId);
  const metrics: AnalyticsMetricDef[] = [
    metricDef('accuracy', accuracy.label, '%', 'Should be higher', accuracy.yAxis, accuracy.meaning, [
      { pattern: 'The line rises', reading: 'More of this module’s scored attempts were successful' },
      { pattern: 'The line falls after a new level', reading: 'Compare that level on its own before calling it a setback' },
    ]),
    metricDef('reaction', reaction.label, 's', 'Should be less', reaction.yAxis, reaction.meaning, [
      { pattern: 'Time falls and accuracy holds', reading: 'Faster on this module without giving up the score above' },
      { pattern: 'Time falls and accuracy falls', reading: 'Rushing on this module' },
    ]),
    metricDef(
      'efficiency',
      'Efficiency',
      '',
      'Should be higher',
      'Efficiency',
      efficiencyCopy(gameId),
      [
        { pattern: 'Efficiency rises', reading: 'This module’s score and its own mean time improved together' },
        { pattern: 'Accuracy rises and efficiency does not', reading: 'More careful on this module, not faster' },
      ],
    ),
  ];
  if (gameId !== 'bee_tracing') {
    metrics.push(
      metricDef(
        'wrongTapRate',
        gameId === 'geoboard' ? 'Wrong-pattern rate' : 'Wrong-tap rate',
        '%',
        'Should be less',
        gameId === 'geoboard' ? 'Wrong-pattern rate (%)' : 'Wrong-tap rate (%)',
        gameId === 'geoboard'
          ? 'Share of stored attempts that were a wrong dot or a wrong shape.'
          : 'Share of stored attempts that hit a stimulus that was not the target.',
        [{ pattern: 'The rate falls and accuracy rises', reading: 'Better discrimination on this module' }],
      ),
    );
  }
  if (!GAMES_WITHOUT_MISS.has(gameId)) {
    metrics.push(
      metricDef(
        'missRate',
        gameId === 'geoboard' ? 'Incomplete-pattern rate' : 'Miss rate',
        '%',
        'Should be less',
        gameId === 'geoboard' ? 'Incomplete-pattern rate (%)' : 'Miss rate (%)',
        gameId === 'geoboard'
          ? 'Share of stored attempts that were an incomplete pattern and not a timeout.'
          : 'Share of stored attempts that were an empty-space or background tap.',
        [{ pattern: 'The rate falls and wrong taps stay flat', reading: 'Better aim on this module' }],
      ),
    );
  }
  metrics.push(
    metricDef(
      'duration',
      'Time to finish',
      's',
      'Should be less',
      'Time to finish (s)',
      'Mean stored sitting length. It is not the time-to-respond series. A sitting that hit a time cap stays long.',
      [
        { pattern: 'Sitting time falls and accuracy holds', reading: 'A shorter sitting on this module' },
        { pattern: 'Sitting time stays at the time limit', reading: 'The clock ran out' },
      ],
    ),
  );
  return metrics;
}

export function reactionTimeAvailable(row: { reactionMs?: number[] | null; avgReactionSec?: number }): boolean {
  const samples = row.reactionMs;
  if (Array.isArray(samples) && samples.length > 0) return validReactionSamples(samples).length > 0;
  return Number.isFinite(row.avgReactionSec) && (row.avgReactionSec ?? 0) > 0;
}

export function positiveReactionTime(row: { reactionMs?: number[] | null; avgReactionSec?: number }): boolean {
  const samples = row.reactionMs;
  if (Array.isArray(samples) && samples.length > 0) {
    const valid = validReactionSamples(samples);
    if (valid.length === 0) return false;
    return valid.reduce((sum, ms) => sum + ms, 0) / valid.length > 0;
  }
  return Number.isFinite(row.avgReactionSec) && (row.avgReactionSec ?? 0) > 0;
}

/** Drops a chart when the persisted row does not contain the value it would plot. */
export function availableAnalyticsMetrics(
  gameId: string,
  rows: Array<{ reactionMs?: number[]; avgReactionSec?: number; durationSec?: number }>,
): AnalyticsMetricDef[] {
  if (!gameId || rows.length === 0) return [];
  return analyticsMetricsForGame(gameId).filter((metric) => {
    if (metric.id === 'reaction') return rows.some(reactionTimeAvailable);
    if (metric.id === 'efficiency') return rows.some(positiveReactionTime);
    if (metric.id === 'duration') return rows.some((row) => (row.durationSec ?? 0) > 0);
    return true;
  });
}
