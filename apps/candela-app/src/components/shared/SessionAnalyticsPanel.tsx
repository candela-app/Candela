'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ALL_MODULE_IDS,
  ANALYTICS_DOTS_GUIDE,
  ANALYTICS_GRAPH_GUIDES,
  ANALYTICS_METRICS,
  ANALYTICS_RATES_NOTE,
  ANALYTICS_SESSION_GUIDE,
  ANALYTICS_SCALE_LABEL,
  GAME_CATALOG,
  MODULE_LEVELS,
  analyticsVisibleSlots,
  buildGameSessionAnalytics,
  dailyHasPlay,
  dailyLinePath,
  formatPlotAxisName,
  formatPlotTick,
  formatPlotTooltip,
  levelsForTherapyModule,
  shouldDrawPlotTick,
  plotPointsForScale,
  zoomInScale,
  zoomOutScale,
  yValueForDaily,
  type AnalyticsMetricId,
  type AnalyticsTimeScale,
  type DailyAggMode,
  type DailyPlotPoint,
  type StoredGameSession,
  type TherapyModuleId,
} from '@candela/shared';
import { listMyGameSessions, listPatientGameSessions, type StoredGameSessionRecord } from '@/lib/api';

function toStored(row: StoredGameSessionRecord): StoredGameSession {
  return {
    ...row,
    gameId: row.gameId as TherapyModuleId,
    levelId: row.levelId ?? null,
    deviceTier: row.deviceTier ?? null,
  };
}

const TIP_WIDTH = 220;

function viewBoxToScreen(svg: SVGSVGElement, vx: number, vy: number): { x: number; y: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) {
    const r = svg.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  const pt = svg.createSVGPoint();
  pt.x = vx;
  pt.y = vy;
  const mapped = pt.matrixTransform(ctm);
  return { x: mapped.x, y: mapped.y };
}

function LineChart({
  points,
  metric,
  agg,
  color,
  scale,
}: {
  points: DailyPlotPoint[];
  metric: AnalyticsMetricId;
  agg: DailyAggMode;
  color: string;
  scale: AnalyticsTimeScale;
}) {
  const height = 236;
  const pad = { l: 58, r: 16, t: 16, b: 28 };
  const plotPadL = 10;
  const viewportInner = 640 - pad.l - pad.r;
  const visibleSlots = Math.max(2, analyticsVisibleSlots(scale));
  const slot = viewportInner / (visibleSlots - 1);
  const innerW = slot * Math.max(visibleSlots - 1, Math.max(1, points.length - 1));
  const plotW = plotPadL + innerW + pad.r;
  const played = points.filter(dailyHasPlay);
  const values = played.map((p) => yValueForDaily(p, metric, agg));
  const max = Math.max(...values, metric === 'accuracy' || metric.includes('Rate') ? 100 : 0.01);
  const min = 0;
  const innerH = height - pad.t - pad.b;
  const x = (i: number) => plotPadL + (points.length <= 1 ? innerW / 2 : i * slot);
  const y = (v: number) => pad.t + innerH - ((v - min) / (max - min || 1)) * innerH;
  const path = dailyLinePath(points, x, y, metric, agg);
  const [hover, setHover] = useState<number | null>(null);
  const [tipBox, setTipBox] = useState<{ left: number; top: number; placeBelow: boolean } | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const touchOpenRef = useRef(false);
  const tip = hover != null && dailyHasPlay(points[hover]) ? points[hover] : null;
  const metricMeta = ANALYTICS_METRICS.find((m) => m.id === metric);
  const unit = metricMeta?.unit ?? '';
  const yAxis = metricMeta?.yAxis ?? metricMeta?.label ?? '';
  const valueLabel =
    tip != null
      ? `${yValueForDaily(tip, metric, agg).toFixed(metric === 'reaction' ? 2 : 1)}${unit}`
      : '';

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [points.length, plotW]);

  useEffect(() => {
    if (hover == null) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (chartRef.current?.contains(target) || tipRef.current?.contains(target)) return;
      setHover(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [hover]);

  useLayoutEffect(() => {
    if (hover == null || !svgRef.current || !dailyHasPlay(points[hover])) {
      setTipBox(null);
      return;
    }
    const place = (tipH: number) => {
      const origin = viewBoxToScreen(
        svgRef.current!,
        x(hover),
        y(yValueForDaily(points[hover], metric, agg)),
      );
      const margin = 8;
      const gap = 12;
      let left = origin.x - TIP_WIDTH / 2;
      left = Math.min(window.innerWidth - TIP_WIDTH - margin, Math.max(margin, left));
      const placeBelow = origin.y - margin < tipH + gap;
      let top = placeBelow ? origin.y + gap : origin.y - tipH - gap;
      top = Math.min(window.innerHeight - tipH - margin, Math.max(margin, top));
      return { left, top, placeBelow };
    };
    setTipBox(place(tipRef.current?.offsetHeight || 80));
    const onMove = () => setTipBox(place(tipRef.current?.offsetHeight || 80));
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [hover, points, metric, agg, scale]);

  if (points.length === 0) {
    return (
      <div className="h-40 rounded-xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center">
        <p className="text-xs font-semibold text-gray-400">No graphs yet</p>
      </div>
    );
  }

  const yMid = pad.t + innerH / 2;

  const openDot = (i: number, event: { stopPropagation: () => void; pointerType?: string }) => {
    if (!dailyHasPlay(points[i])) return;
    event.stopPropagation();
    touchOpenRef.current = event.pointerType === 'touch';
    setHover(i);
  };

  return (
    <div className="relative w-full min-w-0">
      <div
        ref={chartRef}
        className="relative w-full min-w-0 flex"
        onMouseLeave={() => {
          if (!touchOpenRef.current) setHover(null);
        }}
      >
      <svg width={pad.l} height={height} className="shrink-0 h-44 sm:h-52" viewBox={`0 0 ${pad.l} ${height}`}>
        {[0, 0.5, 1].map((t) => {
          const v = min + (max - min) * (1 - t);
          const yy = pad.t + innerH * t;
          return (
            <text key={t} x={pad.l - 6} y={yy + 4} textAnchor="end" fontSize="10" fill="#9CA3AF">
              {metric === 'reaction' ? v.toFixed(2) : metric === 'duration' ? v.toFixed(1) : v.toFixed(0)}
            </text>
          );
        })}
        <text
          transform={`translate(14 ${yMid}) rotate(-90)`}
          textAnchor="middle"
          fontSize="11"
          fill="#6B7280"
          fontWeight="600"
        >
          {yAxis}
        </text>
      </svg>
      <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto">
        <svg
          ref={svgRef}
          width={plotW}
          height={height}
          viewBox={`0 0 ${plotW} ${height}`}
          className="h-44 sm:h-52 overflow-visible"
          style={{ minWidth: '100%' }}
        >
          {[0, 0.5, 1].map((t) => {
            const yy = pad.t + innerH * t;
            return (
              <line
                key={t}
                x1={0}
                x2={plotW}
                y1={yy}
                y2={yy}
                stroke="#E5E7EB"
                strokeDasharray="4 4"
              />
            );
          })}
          {path ? (
            <path d={path} fill="none" stroke={color} strokeWidth="2.5" />
          ) : null}
          {points.map((p, i) => {
            if (!dailyHasPlay(p)) return null;
            const value = yValueForDaily(p, metric, agg);
            const px = x(i);
            const py = y(value);
            const label = `${value.toFixed(metric === 'reaction' ? 2 : 1)}${unit}`;
            const labelBelow = py < pad.t + 14;
            return (
              <g key={p.date}>
                <circle cx={px} cy={py} r={hover === i ? 6 : 4} fill={color} />
                <text
                  x={px}
                  y={labelBelow ? py + 16 : py - 10}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill={color}
                >
                  {label}
                </text>
                <circle
                  cx={px}
                  cy={py}
                  r={22}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => {
                    if (!touchOpenRef.current) setHover(i);
                  }}
                  onPointerDown={(event) => openDot(i, event)}
                />
              </g>
            );
          })}
          {points.map((p, i) =>
            shouldDrawPlotTick(p.date, scale, i, points.length) ? (
              <text key={`${p.date}-x`} x={x(i)} y={height - 14} textAnchor="middle" fontSize="10" fill="#6B7280">
                {formatPlotTick(p.date, scale)}
              </text>
            ) : null,
          )}
        </svg>
      </div>
      {portalReady && tip
        ? createPortal(
            <div
              ref={tipRef}
              className="pointer-events-none fixed z-[80] w-[220px] rounded-lg bg-slate-900 px-3 py-2 text-[11px] text-white shadow-lg"
              style={{
                left: tipBox?.left ?? 0,
                top: tipBox?.top ?? 0,
                visibility: tipBox ? 'visible' : 'hidden',
              }}
            >
              {tipBox?.placeBelow ? (
                <div className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 bg-slate-900" />
              ) : (
                <div className="absolute left-1/2 bottom-0 h-2 w-2 -translate-x-1/2 translate-y-1 rotate-45 bg-slate-900" />
              )}
              <p className="font-bold">
                {formatPlotTooltip(tip.date, scale)} · {valueLabel}
              </p>
              <p className="text-slate-300 mt-0.5">
                {tip.sessionCount} session{tip.sessionCount === 1 ? '' : 's'}
              </p>
              {tip.sessions.map((s) => (
                <p key={s.sessionNumber} className="text-slate-300 mt-0.5">
                  #{s.sessionNumber} · acc {s.accuracy}% · RT {s.avgReactionSec}s · {s.durationSec}s
                </p>
              ))}
            </div>,
            document.body,
          )
        : null}
      </div>
      <p
        className="w-full text-center text-[11px] font-semibold text-gray-500"
        style={{ paddingLeft: pad.l }}
      >
        {formatPlotAxisName(points, scale)}
      </p>
    </div>
  );
}

function HowToReadCard({ card, gameId, levelId }: { card: string; gameId: string; levelId: string }) {
  return (
    <div className={`rounded-2xl border ${card} p-4 text-sm text-gray-600 space-y-5 min-w-0 overflow-hidden`}>
      <p className="font-bold text-gray-900 text-base">How to read this</p>
      <section className="space-y-1">
        <p className="font-bold text-gray-900">{ANALYTICS_DOTS_GUIDE.title}</p>
        <p>{ANALYTICS_DOTS_GUIDE.body}</p>
      </section>
      <section className="space-y-1">
        <p className="font-bold text-gray-900">{ANALYTICS_SESSION_GUIDE.title}</p>
        <p>{ANALYTICS_SESSION_GUIDE.body}</p>
      </section>
      {ANALYTICS_GRAPH_GUIDES.map((guide) => (
        <section key={guide.id} className="space-y-2">
          <p className="font-bold" style={{ color: ANALYTICS_METRICS.find((m) => m.id === guide.id)?.color ?? '#111827' }}>
            {guide.title}
          </p>
          <p>{guide.meaning}</p>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Pattern</th>
                  <th className="px-3 py-2 font-semibold">Reading</th>
                </tr>
              </thead>
              <tbody>
                {guide.trends.map((row) => (
                  <tr key={row.pattern} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{row.pattern}</td>
                    <td className="px-3 py-2">{row.reading}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="text-xs text-gray-500">{ANALYTICS_RATES_NOTE}</p>
      {gameId ? (
        <p className="text-xs text-gray-500">
          Filter: {GAME_CATALOG[gameId as TherapyModuleId]?.name}
          {levelId ? ` · ${MODULE_LEVELS[gameId as TherapyModuleId]?.find((l) => l.id === levelId)?.name ?? levelId}` : ' · all levels'}.
          Compare the same module; do not mix devices without noting device tier.
        </p>
      ) : (
        <p className="text-xs text-gray-500">Pick a module to compare like-with-like. Mixing games on one line is noisy.</p>
      )}
    </div>
  );
}

export function SessionAnalyticsPanel({
  patientId,
  variant = 'light',
}: {
  patientId?: string;
  patientName: string;
  variant?: 'light' | 'shell';
}) {
  const [gameId, setGameId] = useState<string>('');
  const [levelId, setLevelId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [agg, setAgg] = useState<DailyAggMode>('pooled');
  const [scale, setScale] = useState<AnalyticsTimeScale>('week');
  const [rows, setRows] = useState<StoredGameSessionRecord[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = {
      gameId: gameId || undefined,
      levelId: gameId && levelId ? levelId : undefined,
      from: from || undefined,
      to: to || undefined,
    };
    const req = patientId
      ? listPatientGameSessions(patientId, params)
      : listMyGameSessions(params);
    req
      .then((list) => {
        if (!cancelled) {
          setRows(list);
          setError('');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setError('Could not load sessions');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, gameId, levelId, from, to]);

  const analytics = useMemo(() => buildGameSessionAnalytics(rows.map(toStored)), [rows]);
  const lastPlayed = analytics.totals.lastPlayedAt
    ? new Date(analytics.totals.lastPlayedAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';
  const hasPlays = analytics.totals.sessionCount > 0;
  const plotPoints = useMemo(
    () =>
      plotPointsForScale(rows.map(toStored), analytics.daily, scale, {
        from: from || undefined,
        to: to || undefined,
      }),
    [rows, analytics.daily, scale, from, to],
  );

  const card = variant === 'shell' ? 'bg-white border-shell-border' : 'bg-white border-gray-100';

  return (
    <div className="space-y-5 w-full min-w-0">
      <div className={`rounded-2xl border ${card} p-4 grid grid-cols-2 lg:grid-cols-4 gap-3`}>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Sessions</p>
          <p className="text-xl sm:text-2xl font-extrabold text-gray-900">{analytics.totals.sessionCount}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Last played</p>
          <p className="text-xl sm:text-2xl font-extrabold text-gray-900 break-words">{lastPlayed}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Accuracy</p>
          <p className="text-xl sm:text-2xl font-extrabold text-gray-900">
            {analytics.totals.avgAccuracy != null ? `${analytics.totals.avgAccuracy}%` : '—'}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-violet-600">Dates plotted</p>
          <p className="text-xl sm:text-2xl font-extrabold text-gray-900">{analytics.daily.length}</p>
        </div>
      </div>

      <div className={`rounded-2xl border ${card} p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3`}>
        <label className="text-xs font-semibold text-gray-600 min-w-0">
          Module
          <select
            value={gameId}
            onChange={(e) => {
              setGameId(e.target.value);
              setLevelId('');
            }}
            className="mt-1 block w-full min-w-0 max-w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white"
          >
            <option value="">All modules</option>
            {ALL_MODULE_IDS.map((id) => (
              <option key={id} value={id}>
                {GAME_CATALOG[id].name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-gray-600 min-w-0">
          Level
          <select
            value={levelId}
            onChange={(e) => setLevelId(e.target.value)}
            disabled={!gameId}
            className="mt-1 block w-full min-w-0 max-w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">{gameId ? 'All levels' : 'Pick a module first'}</option>
            {levelsForTherapyModule(gameId).map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-gray-600 min-w-0">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block w-full min-w-0 max-w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-gray-600 min-w-0">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block w-full min-w-0 max-w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-gray-600 min-w-0">
          Daily dot
          <select
            value={agg}
            onChange={(e) => setAgg(e.target.value as DailyAggMode)}
            className="mt-1 block w-full min-w-0 max-w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white"
          >
            <option value="pooled">Pooled average (default)</option>
            <option value="best">Best of day</option>
          </select>
        </label>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-gray-500">Loading sessions…</p> : null}

      {!loading && !hasPlays ? (
        <div className={`rounded-2xl border border-dashed ${card} p-10 text-center`}>
          <p className="text-sm font-bold text-gray-700">No graphs yet</p>
          <p className="text-xs text-gray-500 mt-1">Finish a play to see a weekly plot. Use − / + to zoom to month or year.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className={`rounded-2xl border ${card} p-3 flex items-center justify-between gap-3`}>
            <p className="text-xs font-semibold text-gray-600">Time scale</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Previous time scale"
                disabled={scale === 'week'}
                onClick={() => setScale((prev) => zoomInScale(prev))}
                className="h-8 w-8 rounded-lg border border-gray-200 text-lg font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                −
              </button>
              <span className="min-w-[4.5rem] text-center text-sm font-bold text-gray-900">
                {ANALYTICS_SCALE_LABEL[scale]}
              </span>
              <button
                type="button"
                aria-label="Next time scale"
                disabled={scale === 'year'}
                onClick={() => setScale((prev) => zoomOutScale(prev))}
                className="h-8 w-8 rounded-lg border border-gray-200 text-lg font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                +
              </button>
            </div>
          </div>
          {ANALYTICS_METRICS.map((item) => (
            <div key={item.id} className={`rounded-2xl border ${card} p-4 min-w-0 overflow-visible`}>
              <div className="mb-3 flex items-start justify-between gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="text-sm font-bold break-words" style={{ color: item.color }}>
                    {item.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.direction}</p>
                </div>
                {analytics.preliminary ? (
                  <p className="text-[10px] text-gray-400 shrink-0">Preliminary</p>
                ) : null}
              </div>
              <LineChart points={plotPoints} metric={item.id} agg={agg} color={item.color} scale={scale} />
            </div>
          ))}
        </div>
      )}

      <HowToReadCard card={card} gameId={gameId} levelId={levelId} />
    </div>
  );
}
