'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ALL_MODULE_IDS,
  ANALYTICS_DOTS_GUIDE,
  ANALYTICS_GRAPH_GUIDES,
  ANALYTICS_METRICS,
  ANALYTICS_RATES_NOTE,
  ANALYTICS_SESSION_GUIDE,
  ANALYTICS_X_AXIS,
  GAME_CATALOG,
  buildGameSessionAnalytics,
  sampleDailyPlotPoints,
  yValueForDaily,
  type AnalyticsMetricId,
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

function formatDay(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
}

function LineChart({
  points,
  metric,
  agg,
  color,
  sample,
}: {
  points: DailyPlotPoint[];
  metric: AnalyticsMetricId;
  agg: DailyAggMode;
  color: string;
  sample?: boolean;
}) {
  const width = 640;
  const height = 236;
  const pad = { l: 58, r: 16, t: 16, b: 48 };
  const values = points.map((p) => yValueForDaily(p, metric, agg));
  const max = Math.max(...values, metric === 'accuracy' || metric.includes('Rate') ? 100 : 0.01);
  const min = 0;
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => pad.t + innerH - ((v - min) / (max - min || 1)) * innerH;
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(yValueForDaily(p, metric, agg)).toFixed(1)}`)
    .join(' ');
  const [hover, setHover] = useState<number | null>(null);
  const tip = hover != null ? points[hover] : null;
  const metricMeta = ANALYTICS_METRICS.find((m) => m.id === metric);
  const unit = metricMeta?.unit ?? '';
  const yAxis = metricMeta?.yAxis ?? metricMeta?.label ?? '';
  const valueLabel =
    tip != null
      ? `${yValueForDaily(tip, metric, agg).toFixed(metric === 'reaction' ? 2 : 1)}${unit}`
      : '';

  if (points.length === 0) {
    return (
      <div className="h-40 rounded-xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center">
        <p className="text-xs font-semibold text-gray-400">No sessions in this range</p>
      </div>
    );
  }

  const cx = hover != null ? x(hover) : 0;
  const cy = hover != null ? y(yValueForDaily(points[hover], metric, agg)) : 0;
  const yMid = pad.t + innerH / 2;

  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-52">
        {[0, 0.5, 1].map((t) => {
          const v = min + (max - min) * (1 - t);
          const yy = pad.t + innerH * t;
          return (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={yy} y2={yy} stroke="#E5E7EB" strokeDasharray="4 4" />
              <text x={pad.l - 6} y={yy + 4} textAnchor="end" fontSize="10" fill="#9CA3AF">
                {metric === 'reaction' ? v.toFixed(2) : v.toFixed(0)}
              </text>
            </g>
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
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeDasharray={sample ? '6 4' : undefined}
        />
        {points.map((p, i) => (
          <g key={p.date}>
            <circle
              cx={x(i)}
              cy={y(yValueForDaily(p, metric, agg))}
              r={hover === i ? 6 : 4}
              fill={color}
            />
            <circle
              cx={x(i)}
              cy={y(yValueForDaily(p, metric, agg))}
              r={14}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          </g>
        ))}
        {points.map((p, i) => (
          <text key={`${p.date}-x`} x={x(i)} y={height - 22} textAnchor="middle" fontSize="10" fill="#6B7280">
            {formatDay(p.date)}
          </text>
        ))}
        <text x={pad.l + innerW / 2} y={height - 6} textAnchor="middle" fontSize="11" fill="#6B7280" fontWeight="600">
          {ANALYTICS_X_AXIS}
        </text>
      </svg>
      {tip ? (
        <div
          className="pointer-events-none absolute z-10 w-max max-w-[220px] -translate-x-1/2 -translate-y-[calc(100%+10px)]"
          style={{ left: `${(cx / width) * 100}%`, top: `${(cy / height) * 100}%` }}
        >
          <div className="rounded-lg bg-slate-900 px-3 py-2 text-[11px] text-white shadow-lg">
            <p className="font-bold">
              {formatDay(tip.date)} · {valueLabel}
            </p>
            <p className="text-slate-300 mt-0.5">
              {tip.sessionCount} session{tip.sessionCount === 1 ? '' : 's'}
              {sample ? ' · sample' : ''}
            </p>
            {tip.sessions.map((s) => (
              <p key={s.sessionNumber} className="text-slate-300 mt-0.5">
                #{s.sessionNumber} · acc {s.accuracy}% · RT {s.avgReactionSec}s
              </p>
            ))}
          </div>
          <div className="mx-auto h-2 w-2 -mt-1 rotate-45 bg-slate-900" />
        </div>
      ) : null}
    </div>
  );
}

function HowToReadCard({ card, gameId }: { card: string; gameId: string }) {
  return (
    <div className={`rounded-2xl border ${card} p-4 text-sm text-gray-600 space-y-5`}>
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
          Filter: {GAME_CATALOG[gameId as TherapyModuleId]?.name}. Compare the same module; do not mix devices without
          noting device tier.
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
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [agg, setAgg] = useState<DailyAggMode>('pooled');
  const [rows, setRows] = useState<StoredGameSessionRecord[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = {
      gameId: gameId || undefined,
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
  }, [patientId, gameId, from, to]);

  const analytics = useMemo(
    () => buildGameSessionAnalytics(rows.map(toStored), { maxDates: 10 }),
    [rows],
  );
  const lastPlayed = analytics.totals.lastPlayedAt
    ? new Date(analytics.totals.lastPlayedAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';
  const isSample = !loading && analytics.daily.length === 0;
  const plotPoints = useMemo(
    () => (isSample ? sampleDailyPlotPoints() : analytics.daily),
    [isSample, analytics.daily],
  );

  const card = variant === 'shell' ? 'bg-white border-shell-border' : 'bg-white border-gray-100';

  return (
    <div className="space-y-5">
      <div className={`rounded-2xl border ${card} p-4 grid grid-cols-2 lg:grid-cols-4 gap-3`}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Sessions</p>
          <p className="text-2xl font-extrabold text-gray-900">{analytics.totals.sessionCount}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Last played</p>
          <p className="text-2xl font-extrabold text-gray-900">{lastPlayed}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Accuracy</p>
          <p className="text-2xl font-extrabold text-gray-900">
            {analytics.totals.avgAccuracy != null ? `${analytics.totals.avgAccuracy}%` : '—'}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-violet-600">Dates plotted</p>
          <p className="text-2xl font-extrabold text-gray-900">{analytics.daily.length}</p>
        </div>
      </div>

      <div className={`rounded-2xl border ${card} p-4 flex flex-wrap gap-3 items-end`}>
        <label className="text-xs font-semibold text-gray-600">
          Module
          <select
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            className="mt-1 block rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white"
          >
            <option value="">All modules</option>
            {ALL_MODULE_IDS.map((id) => (
              <option key={id} value={id}>
                {GAME_CATALOG[id].name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-gray-600">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-gray-600">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-gray-600">
          Daily dot
          <select
            value={agg}
            onChange={(e) => setAgg(e.target.value as DailyAggMode)}
            className="mt-1 block rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white"
          >
            <option value="pooled">Pooled average (default)</option>
            <option value="best">Best of day</option>
          </select>
        </label>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-gray-500">Loading sessions…</p> : null}

      <div className="space-y-4">
        {ANALYTICS_METRICS.map((item) => (
          <div key={item.id} className={`rounded-2xl border ${card} p-4`}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold" style={{ color: item.color }}>
                  {item.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{item.direction}</p>
              </div>
              {isSample ? (
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 shrink-0">
                  Sample
                </p>
              ) : analytics.preliminary ? (
                <p className="text-[10px] text-gray-400 shrink-0">Preliminary</p>
              ) : null}
            </div>
            <LineChart points={plotPoints} metric={item.id} agg={agg} color={item.color} sample={isSample} />
          </div>
        ))}
      </div>

      <HowToReadCard card={card} gameId={gameId} />
    </div>
  );
}
