'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ALL_MODULE_IDS,
  ANALYTICS_SCALE_LABEL,
  ANALYTICS_SELECT_GAME,
  GAME_CATALOG,
  GAZE_HOLD_UNSUPPORTED_MESSAGE,
  TRUNCATED_HISTORY_NOTE,
  availableAnalyticsMetrics,
  buildGameSessionAnalytics,
  buildLevelAnalytics,
  isTherapyModuleId,
  levelsForTherapyModule,
  plotPointsForScale,
  resolveStrictLocalPeriod,
  resolvedTimeZone,
  sessionChartsAllowed,
  showGazeHoldUnsupported,
  zoomInScale,
  zoomOutScale,
  type AnalyticsMetricId,
  type AnalyticsTimeScale,
  type DailyAggMode,
  type RangedPracticeSummary,
  type StrictLocalPeriod,
} from '@candela/shared';
import {
  getPatientPracticeSummary,
  listPatientGameSessionOverview,
  type StoredGameSessionRecord,
} from '@/lib/api';
import { ChevronDownIcon } from '@/components/icons/VectorIcons';
import { Skeleton } from '@/components/common/Skeleton';
import {
  HowToReadCard,
  LevelAnalyticsBody,
  LineChart,
  toStored,
} from '@/components/shared/SessionAnalyticsPanel';
import { DoctorPeriodControls, type AnalyticsRangeChoice } from './DoctorPeriodControls';

const CARD =
  'rounded-[13px] border border-gray-200 bg-white p-[21px] shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)]';
const FIELD =
  'w-full min-w-0 rounded-[11px] border border-gray-200 bg-white px-3 py-2 text-[13px] font-semibold text-gray-900';

function formatActivityDate(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone,
  });
}

function moduleLabel(id: string): string {
  return isTherapyModuleId(id) ? GAME_CATALOG[id].name : id;
}

function RecordedPerformanceSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading recorded performance</span>
      <div className={`${CARD} space-y-4`}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="h-3 w-24 rounded-md" />
          </div>
          <Skeleton className="h-3.5 w-20 rounded-md" />
        </div>
        <div className="flex items-end gap-3 pt-2">
          <div className="flex h-44 flex-col justify-between py-2">
            <Skeleton className="h-2.5 w-7 rounded-md" />
            <Skeleton className="h-2.5 w-6 rounded-md" />
            <Skeleton className="h-2.5 w-5 rounded-md" />
          </div>
          <Skeleton className="h-44 flex-1 rounded-[11px]" />
        </div>
        <div className="flex justify-center pt-1">
          <Skeleton className="h-3 w-16 rounded-md" />
        </div>
      </div>
      <div className={`${CARD} space-y-3`}>
        <Skeleton className="h-5 w-36 rounded-md" />
        <Skeleton className="h-3.5 w-full rounded-md" />
        <Skeleton className="h-3.5 w-4/5 rounded-md" />
      </div>
    </div>
  );
}

export function DoctorPatientAnalytics({
  patientId,
  patientName,
}: {
  patientId: string;
  patientName: string;
}) {
  const timeZone = useMemo(() => resolvedTimeZone(), []);
  const [choice, setChoice] = useState<AnalyticsRangeChoice>('30d');
  const [period, setPeriod] = useState<StrictLocalPeriod>(() =>
    resolveStrictLocalPeriod({ timeZone }),
  );

  // Section A â€” Recent activity (lightweight summary only)
  const [summary, setSummary] = useState<RangedPracticeSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');
  const summarySeq = useRef(0);

  // Section B â€” Recorded performance (detail-free fetch for 1 selected module)
  const [gameId, setGameId] = useState('');
  const [levelId, setLevelId] = useState('');
  const [selectedMetricId, setSelectedMetricId] = useState<AnalyticsMetricId | ''>('');
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [agg, setAgg] = useState<DailyAggMode>('pooled');
  const [scale, setScale] = useState<AnalyticsTimeScale>('week');

  const [chartRows, setChartRows] = useState<StoredGameSessionRecord[]>([]);
  const [chartTruncated, setChartTruncated] = useState(false);
  const [chartLoadedKey, setChartLoadedKey] = useState('');
  const [chartError, setChartError] = useState('');

  // Fetch Section A period summary
  useEffect(() => {
    const seq = ++summarySeq.current;
    setSummaryLoading(true);
    setSummaryError('');
    getPatientPracticeSummary(patientId, {
      from: period.from,
      to: period.to,
      timeZone: period.timeZone,
    })
      .then((res) => {
        if (seq === summarySeq.current) setSummary(res);
      })
      .catch(() => {
        if (seq === summarySeq.current) {
          setSummary(null);
          setSummaryError('Could not load recent activity summary.');
        }
      })
      .finally(() => {
        if (seq === summarySeq.current) setSummaryLoading(false);
      });
  }, [patientId, period]);

  useEffect(() => {
    if (!gameId && summary?.last?.gameId && isTherapyModuleId(summary.last.gameId)) {
      setGameId(summary.last.gameId);
    }
  }, [gameId, summary]);

  // Fetch Section B detail-free rows when a module is selected
  const chartRequestKey = JSON.stringify({
    patientId,
    gameId,
    levelId,
    from: period.startInclusive,
    to: period.endExclusive,
  });

  useEffect(() => {
    if (!gameId) {
      setChartRows([]);
      setChartTruncated(false);
      setChartError('');
      setChartLoadedKey('');
      return;
    }
    let cancelled = false;
    setChartTruncated(false);
    setChartError('');
    listPatientGameSessionOverview(patientId, {
      gameId,
      levelId: levelId || undefined,
      from: period.startInclusive,
      to: period.endExclusive,
      includeDetail: false,
    })
      .then((overview) => {
        if (!cancelled) {
          setChartRows(overview.sessions);
          setChartTruncated(overview.truncated);
          setChartLoadedKey(chartRequestKey);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setChartRows([]);
          setChartTruncated(false);
          setChartError('Could not load module performance.');
          setChartLoadedKey(chartRequestKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, gameId, levelId, period.startInclusive, period.endExclusive, chartRequestKey]);

  const storedChartRows = useMemo(
    () => (gameId ? chartRows.map(toStored) : []),
    [chartRows, gameId],
  );
  const analytics = useMemo(
    () => buildGameSessionAnalytics(storedChartRows, { timeZone: period.timeZone }),
    [storedChartRows, period.timeZone],
  );
  const chartLoaded = chartLoadedKey === chartRequestKey;
  const levelMode = Boolean(levelId);

  const levelResult = useMemo(() => {
    if (!levelMode || !chartLoaded || !gameId) return null;
    return buildLevelAnalytics({
      gameId,
      levelId,
      timeZone: period.timeZone,
      rows: storedChartRows,
    });
  }, [levelMode, chartLoaded, gameId, levelId, period.timeZone, storedChartRows]);

  const identityError = levelResult?.status === 'invalid';
  const hasPlays = Boolean(gameId) && chartLoaded && !levelMode && analytics.totals.sessionCount > 0;
  const chartsAllowed = Boolean(gameId) && sessionChartsAllowed(gameId, storedChartRows);
  const gazeUnsupported =
    Boolean(gameId) && chartLoaded && !levelMode && showGazeHoldUnsupported(gameId, storedChartRows);
  const showCharts = hasPlays && chartsAllowed;

  const availableMetrics = useMemo(
    () => (showCharts ? availableAnalyticsMetrics(gameId, storedChartRows) : []),
    [showCharts, gameId, storedChartRows],
  );

  // Keep selectedMetricId synchronized to one compatible metric
  useEffect(() => {
    if (availableMetrics.length === 0) {
      setSelectedMetricId('');
      return;
    }
    if (!selectedMetricId || !availableMetrics.some((m) => m.id === selectedMetricId)) {
      setSelectedMetricId(availableMetrics[0].id);
    }
  }, [availableMetrics, selectedMetricId]);

  const activeMetric =
    availableMetrics.find((m) => m.id === selectedMetricId) ?? availableMetrics[0] ?? null;

  const plotPoints = useMemo(
    () =>
      plotPointsForScale(storedChartRows, analytics.daily, scale, {
        from: period.from,
        to: period.to,
        timeZone: period.timeZone,
      }),
    [storedChartRows, analytics.daily, scale, period.from, period.to, period.timeZone],
  );


  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-1">
        <p className="text-[13px] text-gray-500">
          Analytics for {patientName}. Gaze Hold sessions are not saved to analytics.
        </p>
      </div>

      {/* Unified Period Selector */}
      <div className="rounded-[13px] border border-gray-200 bg-gray-50/50 p-4">
        <DoctorPeriodControls
          choice={choice}
          period={period}
          onChange={(nextChoice, nextPeriod) => {
            setChoice(nextChoice);
            setPeriod(nextPeriod);
          }}
        />
      </div>

      {/* A. Recent activity */}
      <section aria-labelledby="patient-recent-activity" className="space-y-3">
        <h2 id="patient-recent-activity" className="text-[16px] font-semibold text-gray-900">
          Recent activity
        </h2>

        {summaryLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 animate-pulse">
            {[0, 1, 2].map((i) => (
              <div key={i} className={CARD}>
                <div className="h-3.5 w-28 rounded bg-slate-200/80" />
                <div className="mt-3 h-7 w-14 rounded bg-slate-200/80" />
                <div className="mt-2 h-3 w-36 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : summaryError ? (
          <div className={`${CARD} border-red-200 bg-red-50`}>
            <p className="text-[13px] text-red-700">{summaryError}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className={CARD}>
              <p className="text-[12px] font-semibold text-gray-500">Completed sessions</p>
              <p className="mt-2 text-[24px] font-bold leading-none tabular-nums text-gray-900">
                {summary?.sessionCount ?? 0}
              </p>
              <p className="mt-2 text-[12px] text-gray-500">In selected period</p>
            </div>

            <div className={CARD}>
              <p className="text-[12px] font-semibold text-gray-500">Last session</p>
              <p className="mt-2 text-[18px] font-bold leading-tight text-gray-900">
                {summary?.last ? formatActivityDate(summary.last.recordedAt, period.timeZone) : 'â€”'}
              </p>
              <p className="mt-2 truncate text-[12px] text-gray-500">
                {summary?.last
                  ? [
                      summary.last.gameName,
                      summary.last.levelId ? summary.last.levelName : '',
                    ]
                      .filter(Boolean)
                      .join(' Â· ')
                  : 'No completed sessions in this period'}
              </p>
            </div>

            <div className={CARD}>
              <p className="text-[12px] font-semibold text-gray-500">Modules played in this period</p>
              <p className="mt-2 text-[24px] font-bold leading-none tabular-nums text-gray-900">
                {summary?.distinctModulesCount ?? 0}
              </p>
              <p className="mt-2 truncate text-[12px] text-gray-500">
                {summary && summary.playedModuleIds.length > 0
                  ? summary.playedModuleIds.map(moduleLabel).join(', ')
                  : 'No modules played in this period'}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* B. Recorded performance */}
      <section aria-labelledby="patient-recorded-performance" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="patient-recorded-performance" className="text-[16px] font-semibold text-gray-900">
            Recorded performance
          </h2>
          <button
            type="button"
            onClick={() => setMoreFiltersOpen((open) => !open)}
            aria-expanded={moreFiltersOpen}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
          >
            More filters
            <ChevronDownIcon
              className={`size-3.5 text-gray-500 transition-transform ${
                moreFiltersOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>

        {/* Primary controls: Module + Metric */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-gray-600">
            Module
            <select
              value={gameId}
              onChange={(e) => {
                setGameId(e.target.value);
                setLevelId('');
                setSelectedMetricId('');
              }}
              className={FIELD}
            >
              <option value="">{ANALYTICS_SELECT_GAME.title}</option>
              {ALL_MODULE_IDS.map((id) => (
                <option key={id} value={id}>
                  {GAME_CATALOG[id].name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-gray-600">
            Metric
            <select
              value={activeMetric?.id ?? ''}
              onChange={(e) => setSelectedMetricId(e.target.value as AnalyticsMetricId)}
              disabled={levelMode || availableMetrics.length === 0}
              className={`${FIELD} disabled:bg-gray-50 disabled:text-gray-400`}
            >
              {levelMode ? (
                <option value="">Level view selected</option>
              ) : gameId && !chartLoaded ? (
                <option value="">Loading metricsâ€¦</option>
              ) : availableMetrics.length === 0 ? (
                <option value="">{gameId ? 'No compatible metrics' : 'Pick a module first'}</option>
              ) : (
                availableMetrics.map((metric) => (
                  <option key={metric.id} value={metric.id}>
                    {metric.label}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>

        {/* Secondary controls inside More filters */}
        {moreFiltersOpen ? (
          <div className="grid grid-cols-1 gap-3 rounded-[11px] border border-gray-200 bg-gray-50/70 p-3.5 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-gray-600">
              Level
              <select
                value={levelId}
                onChange={(e) => setLevelId(e.target.value)}
                disabled={!gameId}
                className={`${FIELD} disabled:bg-gray-100 disabled:text-gray-400`}
              >
                <option value="">{gameId ? 'All levels (mixed)' : 'Pick a module first'}</option>
                {levelsForTherapyModule(gameId).map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-gray-600">
              Daily aggregation
              <select
                value={agg}
                onChange={(e) => setAgg(e.target.value as DailyAggMode)}
                disabled={levelMode}
                className={`${FIELD} disabled:bg-gray-100 disabled:text-gray-400`}
              >
                <option value="pooled">Pooled average (default)</option>
                <option value="best">Best of day</option>
              </select>
            </label>

            <div className="flex flex-col gap-1.5 text-[12px] font-semibold text-gray-600">
              <span>Time scale</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Previous time scale"
                  disabled={levelMode || scale === 'week'}
                  onClick={() => setScale((prev) => zoomInScale(prev))}
                  className="inline-flex size-[36px] cursor-pointer items-center justify-center rounded-[10px] border border-gray-200 bg-white text-[18px] text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  âˆ’
                </button>
                <span className="min-w-[55px] text-center text-[13px] font-semibold text-gray-900">
                  {ANALYTICS_SCALE_LABEL[scale]}
                </span>
                <button
                  type="button"
                  aria-label="Next time scale"
                  disabled={levelMode || scale === 'year'}
                  onClick={() => setScale((prev) => zoomOutScale(prev))}
                  className="inline-flex size-[36px] cursor-pointer items-center justify-center rounded-[10px] border border-gray-200 bg-white text-[18px] text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {chartError ? <p className="text-[13px] text-red-600">{chartError}</p> : null}
        {chartTruncated ? (
          <p className="text-[13px] text-gray-700">{TRUNCATED_HISTORY_NOTE}</p>
        ) : null}
        {identityError ? (
          <p className="text-[13px] text-red-600">
            These sessions are not limited to the selected level, so this level was not summarized.
          </p>
        ) : null}

        {!gameId ? (
          summaryLoading ? (
            <RecordedPerformanceSkeleton />
          ) : (
            <div className={`${CARD} text-center`}>
              <p className="text-[13px] font-semibold text-gray-900">
                {summary?.last ? ANALYTICS_SELECT_GAME.title : 'No recorded sessions in this period'}
              </p>
              <p className="mt-2 text-[13px] leading-[21px] text-gray-500">
                {summary?.last
                  ? ANALYTICS_SELECT_GAME.body
                  : 'Completed session data will appear here when the patient has played during the selected period.'}
              </p>
            </div>
          )
        ) : !chartLoaded ? (
          <RecordedPerformanceSkeleton />
        ) : levelMode ? (
          levelResult?.status === 'ok' ? (
            <LevelAnalyticsBody
              result={levelResult}
              rows={storedChartRows}
              showPatientHistory={false}
              showContext={false}
            />
          ) : null
        ) : gazeUnsupported ? (
          <div className={CARD}>
            <p className="text-[13px] leading-[21px] text-gray-600">
              {GAZE_HOLD_UNSUPPORTED_MESSAGE}
            </p>
          </div>
        ) : hasPlays && !chartsAllowed ? (
          <div className={CARD}>
            <p className="text-[13px] leading-[21px] text-gray-600">
              These sessions are not plotted together because they are not all Gaze Hold.
            </p>
          </div>
        ) : !showCharts || !activeMetric ? (
          <div className={`${CARD} text-center`}>
            <p className="text-[13px] font-semibold text-gray-900">
              No recorded sessions in this period
            </p>
            <p className="mt-2 text-[13px] leading-[21px] text-gray-500">
              No completed plays for {moduleLabel(gameId)} between {period.from} and {period.to}.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`${CARD} min-w-0 overflow-visible`}>
              <div className="mb-3 flex items-start justify-between gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-gray-900 break-words">
                    {activeMetric.label}
                  </p>
                  <p className="mt-1 text-[13px] leading-[21px] text-gray-500">
                    {activeMetric.direction}
                  </p>
                </div>
                {analytics.preliminary ? (
                  <p className="shrink-0 text-[13px] text-gray-500">Preliminary</p>
                ) : null}
              </div>
              <LineChart
                points={plotPoints}
                metric={activeMetric.id}
                agg={agg}
                color={activeMetric.color}
                scale={scale}
                unit={activeMetric.unit}
                yAxis={activeMetric.yAxis}
              />
            </div>
            <HowToReadCard gameId={gameId} levelId={levelId} metrics={[activeMetric]} />
          </div>
        )}
      </section>


    </div>
  );
}
