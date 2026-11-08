'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ALL_MODULE_IDS,
  ANALYTICS_DOTS_GUIDE,
  ANALYTICS_RATES_NOTE,
  ANALYTICS_SELECT_GAME,
  ANALYTICS_SESSION_GUIDE,
  ANALYTICS_SCALE_LABEL,
  GAME_CATALOG,
  MODULE_LEVELS,
  analyticsQueryRange,
  analyticsVisibleSlots,
  availableAnalyticsMetrics,
  buildGameSessionAnalytics,
  buildLevelAnalytics,
  dailyLinePath,
  dailyMetricPlotted,
  formatPlotAxisName,
  formatPlotTick,
  formatPlotTooltip,
  levelsForTherapyModule,
  resolvedTimeZone,
  shouldDrawPlotTick,
  plotPointsForScale,
  formatDoctorDetail,
  formatPatientSummary,
  formatReportSeconds,
  formatSessionReport,
  levelContextMatchText,
  levelEmptyMessage,
  GAZE_HOLD_UNSUPPORTED_MESSAGE,
  mixedLevelNotice,
  TRUNCATED_HISTORY_NOTE,
  sessionChartsAllowed,
  showGazeHoldUnsupported,
  zoomInScale,
  zoomOutScale,
  yValueForDaily,
  type AnalyticsMetricDef,
  type AnalyticsMetricId,
  type AnalyticsTimeScale,
  type DailyAggMode,
  type DailyPlotPoint,
  type LevelAnalyticsOk,
  type LevelDailyPoint,
  type StoredGameSession,
  type TherapyModuleId,
} from '@candela/shared';
import { listMyGameSessionOverview, listPatientGameSessionOverview, type StoredGameSessionRecord } from '@/lib/api';

function toStored(row: StoredGameSessionRecord): StoredGameSession {
  return {
    ...row,
    gameId: row.gameId as TherapyModuleId,
    levelId: row.levelId ?? null,
    deviceTier: row.deviceTier ?? null,
  };
}

const TIP_WIDTH = 220;
const DASHBOARD_SHADOW = 'shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)]';
const CARD = `rounded-[13px] border border-gray-200 bg-white p-[21px] ${DASHBOARD_SHADOW}`;
const FIELD = `w-full min-w-0 rounded-[13px] border border-gray-200 bg-white px-[13px] py-[8px] text-[13px] font-semibold text-gray-900 ${DASHBOARD_SHADOW}`;
const LABEL = 'flex items-center gap-[8px] text-[13px] font-semibold text-gray-500';
const STACK = 'flex min-w-0 flex-col gap-[8px] text-[13px] font-semibold text-gray-500';

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
  unit,
  yAxis,
  showGameName = false,
}: {
  points: DailyPlotPoint[];
  metric: AnalyticsMetricId;
  agg: DailyAggMode;
  color: string;
  scale: AnalyticsTimeScale;
  unit: string;
  yAxis: string;
  showGameName?: boolean;
}) {
  const height = 236;
  const pad = { l: 58, r: 16, t: 16, b: 28 };
  const plotPadL = 10;
  const tipWidth = showGameName ? 330 : 240;
  const viewportInner = 640 - pad.l - pad.r;
  const visibleSlots = Math.max(2, analyticsVisibleSlots(scale));
  const slot = viewportInner / (visibleSlots - 1);
  const innerW = slot * Math.max(visibleSlots - 1, Math.max(1, points.length - 1));
  const plotW = plotPadL + innerW + pad.r;
  const played = points.filter((point) => dailyMetricPlotted(point, metric, agg));
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
  const tip = hover != null && dailyMetricPlotted(points[hover], metric, agg) ? points[hover] : null;
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
    if (hover == null || !svgRef.current || !dailyMetricPlotted(points[hover], metric, agg)) {
      setTipBox(null);
      return;
    }
    const place = (tipH: number) => {
      const clampedH = Math.min(250, tipH);
      const origin = viewBoxToScreen(
        svgRef.current!,
        x(hover),
        y(yValueForDaily(points[hover], metric, agg)),
      );
      const margin = 8;
      const gap = 12;
      let left = origin.x - tipWidth / 2;
      left = Math.min(window.innerWidth - tipWidth - margin, Math.max(margin, left));
      const placeBelow = origin.y - margin < clampedH + gap;
      let top = placeBelow ? origin.y + gap : origin.y - clampedH - gap;
      top = Math.min(window.innerHeight - clampedH - margin, Math.max(margin, top));
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
      <div className="flex h-[89px] items-center justify-center rounded-[13px] border border-dashed border-gray-200 bg-gray-50">
        <p className="text-[13px] font-semibold text-gray-400">No graphs yet</p>
      </div>
    );
  }

  const yMid = pad.t + innerH / 2;

  const openDot = (i: number, event: { stopPropagation: () => void; pointerType?: string }) => {
    if (!dailyMetricPlotted(points[i], metric, agg)) return;
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
            if (!dailyMetricPlotted(p, metric, agg)) return null;
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
              className="pointer-events-auto fixed z-[80] rounded-xl bg-slate-900/95 backdrop-blur-xs p-3 text-[11px] text-white shadow-2xl border border-slate-700/60 flex flex-col"
              onMouseEnter={() => {
                // Keep tooltip visible while hovering inside
              }}
              onMouseLeave={() => {
                if (!touchOpenRef.current) setHover(null);
              }}
              style={{
                width: tipWidth,
                maxHeight: 250,
                left: tipBox?.left ?? 0,
                top: tipBox?.top ?? 0,
                visibility: tipBox ? 'visible' : 'hidden',
              }}
            >
              {tipBox?.placeBelow ? (
                <div className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 bg-slate-900 border-l border-t border-slate-700/60" />
              ) : (
                <div className="absolute left-1/2 bottom-0 h-2 w-2 -translate-x-1/2 translate-y-1 rotate-45 bg-slate-900 border-r border-b border-slate-700/60" />
              )}
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 gap-2 shrink-0">
                <p className="font-bold text-slate-100 truncate">
                  {formatPlotTooltip(tip.date, scale)}
                </p>
                <span className="font-mono font-bold text-emerald-400 text-xs shrink-0">
                  {valueLabel}
                </span>
              </div>

              <div className="mt-1.5 overflow-y-auto overflow-x-hidden max-h-[180px] pr-0.5 [scrollbar-width:thin] [scrollbar-color:#475569_transparent]">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead className="sticky top-0 bg-slate-900 z-10 shadow-xs">
                    <tr className="text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[9px]">
                      <th className="pb-1 bg-slate-900 font-semibold">#</th>
                      {showGameName && <th className="pb-1 bg-slate-900 font-semibold">Game</th>}
                      <th className="pb-1 bg-slate-900 font-semibold text-right">Acc</th>
                      <th className="pb-1 bg-slate-900 font-semibold text-right">RT</th>
                      <th className="pb-1 bg-slate-900 font-semibold text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {tip.sessions.map((s) => (
                      <tr key={s.sessionNumber} className="text-slate-200 hover:bg-slate-800/40 transition-colors">
                        <td className="py-1 font-mono text-slate-400">#{s.sessionNumber}</td>
                        {showGameName && (
                          <td className="py-1 font-medium text-cyan-300 max-w-[110px] truncate" title={s.gameName || ''}>
                            {s.gameName || '—'}
                          </td>
                        )}
                        <td className="py-1 text-right font-medium">{s.accuracy}%</td>
                        <td className="py-1 text-right text-slate-300">{s.avgReactionSec}s</td>
                        <td className="py-1 text-right text-slate-400">{s.durationSec}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

function formatReportDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Date not recorded';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function DoctorSessionList({ rows }: { rows: StoredGameSession[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const reports = rows.map((row) => formatSessionReport(row));
  const notice = mixedLevelNotice(reports.map((report) => report.levelName));
  return (
    <section className="space-y-[13px]">
      <h3 className="text-[13px] font-semibold text-gray-900">Sessions</h3>
      {notice ? <p className="text-[13px] leading-[21px] text-gray-500">{notice}</p> : null}
      <ul className="space-y-[8px]">
        {reports.map((report, index) => {
          const open = openId === report.id;
          const detailLines = formatDoctorDetail(rows[index]?.detail);
          return (
            <li key={report.id} className={CARD}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : report.id)}
                className="flex w-full items-start justify-between gap-[13px] text-left"
              >
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-gray-900">{report.moduleName}</span>
                  <span className="mt-[4px] block text-[13px] text-gray-500">{report.levelName}</span>
                  <span className="mt-[4px] block text-[13px] text-gray-500">{formatReportDate(report.recordedAt)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[13px] font-semibold text-gray-900">
                    {report.score.value == null ? 'Not stored' : `${report.score.value}%`}
                  </span>
                  <span className="mt-[4px] block text-[13px] text-gray-500">{report.score.label}</span>
                  <span className="mt-[4px] block text-[13px] text-gray-500">
                    {report.time.meanSec == null ? 'Time not stored' : formatReportSeconds(report.time.meanSec)}
                  </span>
                </span>
              </button>
              {open ? (
                <div className="mt-[13px] space-y-[8px] border-t border-gray-200 pt-[13px] text-[13px] leading-[21px] text-gray-600">
                  {report.counts.map((line) => (
                    <p key={line.label}>
                      {line.label}: {line.count}
                      {line.rate == null ? '' : ` (${line.rate}%)`}
                    </p>
                  ))}
                  <p>
                    {report.time.label}:{' '}
                    {report.time.meanSec == null
                      ? 'Not stored'
                      : `${formatReportSeconds(report.time.meanSec)}${report.time.medianSec == null ? '' : `, median ${formatReportSeconds(report.time.medianSec)}`}`}
                  </p>
                  {report.duration.seconds == null ? null : (
                    <p>
                      {report.duration.label}: {report.duration.seconds}s
                    </p>
                  )}
                  {report.efficiency == null ? null : <p>Efficiency: {report.efficiency}</p>}
                  {report.deviceTier ? <p>Device: {report.deviceTier}</p> : null}
                  {report.contrastPercent == null ? null : <p>Contrast: {report.contrastPercent}%</p>}
                  {report.notices.map((noticeText) => (
                    <p key={noticeText}>{noticeText}</p>
                  ))}
                  {detailLines.map((line, lineIndex) => (
                    <p key={`${line.label}-${lineIndex}`}>
                      {line.label}: {line.value}
                    </p>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function HowToReadCard({
  gameId,
  levelId,
  metrics,
}: {
  gameId: string;
  levelId: string;
  metrics: AnalyticsMetricDef[];
}) {
  return (
    <div className={`${CARD} space-y-[21px] text-[13px] leading-[21px] text-gray-600 min-w-0 overflow-hidden`}>
      <p className="text-[21px] font-semibold text-gray-900">How to read this</p>
      <section className="space-y-[8px]">
        <p className="font-semibold text-gray-900">{ANALYTICS_DOTS_GUIDE.title}</p>
        <p>{ANALYTICS_DOTS_GUIDE.body}</p>
      </section>
      <section className="space-y-[8px]">
        <p className="font-semibold text-gray-900">{ANALYTICS_SESSION_GUIDE.title}</p>
        <p>{ANALYTICS_SESSION_GUIDE.body}</p>
      </section>
      {metrics.map((guide) => (
        <section key={guide.id} className="space-y-[8px]">
          <p className="font-semibold text-gray-900">{guide.label}</p>
          <p>{guide.meaning}</p>
          <div className="overflow-x-auto rounded-[13px] border border-gray-200">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-[13px] py-[8px] font-semibold">Pattern</th>
                  <th className="px-[13px] py-[8px] font-semibold">Reading</th>
                </tr>
              </thead>
              <tbody>
                {guide.trends.map((row) => (
                  <tr key={row.pattern} className="border-t border-gray-100">
                    <td className="px-[13px] py-[8px] font-semibold text-gray-900 whitespace-nowrap">{row.pattern}</td>
                    <td className="px-[13px] py-[8px]">{row.reading}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {metrics.some((metric) => metric.id === 'wrongTapRate' || metric.id === 'missRate') ? (
        <p className="text-gray-500">{ANALYTICS_RATES_NOTE}</p>
      ) : null}
      {gameId ? (
        <p className="text-gray-500">
          Filter: {GAME_CATALOG[gameId as TherapyModuleId]?.name}
          {levelId ? ` · ${MODULE_LEVELS[gameId as TherapyModuleId]?.find((l) => l.id === levelId)?.name ?? levelId}` : ' · All levels (mixed)'}.
          Compare the same module; do not mix devices without noting device tier.
        </p>
      ) : (
        <p className="text-gray-500">Pick a module to compare like-with-like. Mixing games on one line is noisy.</p>
      )}
    </div>
  );
}

function LevelTrend({ points }: { points: LevelDailyPoint[] }) {
  if (points.length === 0) return null;
  const width = 640;
  const height = 180;
  const pad = { l: 36, r: 12, t: 16, b: 28 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const x = (index: number) => pad.l + (points.length <= 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const y = (value: number) => pad.t + innerH - (value / 100) * innerH;
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point.performance)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img" aria-label="Level performance trend">
      {[0, 50, 100].map((tick) => (
        <text key={tick} x={pad.l - 6} y={y(tick) + 4} textAnchor="end" fontSize="10" fill="#9CA3AF">
          {tick}
        </text>
      ))}
      <path d={path} fill="none" stroke="#2563eb" strokeWidth="2.5" />
      {points.map((point, index) => (
        <g key={point.date}>
          <circle cx={x(index)} cy={y(point.performance)} r="4" fill="#2563eb" />
          <text x={x(index)} y={height - 8} textAnchor="middle" fontSize="10" fill="#6B7280">
            {point.date.slice(5)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function LevelAnalyticsBody({
  result,
  rows,
  showPatientHistory,
  showContext,
}: {
  result: LevelAnalyticsOk;
  rows: StoredGameSession[];
  showPatientHistory: boolean;
  showContext: boolean;
}) {
  const gazeEmpty = result.gameId === 'computer_vision' && result.sessionCount === 0;
  const performance =
    result.sessionCount === 0 || result.performanceValue == null || result.performanceLabel == null
      ? null
      : `${result.performanceLabel} ${result.performanceValue}%`;
  const history = rows.slice().sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  return (
    <div className="space-y-[13px]">
      <div className={CARD}>
        <p className="text-[13px] font-semibold text-gray-900">{result.levelName}</p>
        {gazeEmpty ? (
          <p className="mt-[8px] text-[13px] leading-[21px] text-gray-600">{GAZE_HOLD_UNSUPPORTED_MESSAGE}</p>
        ) : result.sessionCount === 0 ? (
          <p className="mt-[8px] text-[13px] leading-[21px] text-gray-600">{levelEmptyMessage(result.levelName)}</p>
        ) : (
          <div className="mt-[13px] grid gap-[13px] sm:grid-cols-3">
            <p className="text-[13px] leading-[21px] text-gray-600">
              {performance ?? 'Performance not available'}
            </p>
            <p className="text-[13px] leading-[21px] text-gray-600">{result.sessionCount} completed</p>
            <p className="text-[13px] leading-[21px] text-gray-600">
              {result.lastCompletedAt ? formatReportDate(result.lastCompletedAt) : 'Date not recorded'}
            </p>
          </div>
        )}
      </div>
      {result.sessionCount > 0 ? (
        <div className={`${CARD} min-w-0`}>
          <p className="text-[13px] font-semibold text-gray-900">{result.performanceLabel ?? 'Performance'}</p>
          <p className="mt-[8px] text-[13px] leading-[21px] text-gray-500">
            This line uses only {result.levelName}. A day is omitted when its sessions have no valid measurement. Those sessions stay in the count and the list.
          </p>
          {result.daily.length > 0 ? <LevelTrend points={result.daily} /> : (
            <p className="mt-[13px] text-[13px] leading-[21px] text-gray-600">No performance points for this level.</p>
          )}
          {result.daily.length > 0 ? (
            <ul className="mt-[13px] space-y-[8px]">
              {result.daily.map((point) => (
                <li key={point.date} className="text-[13px] leading-[21px] text-gray-600">
                  {point.date}: {point.performance}% · {point.sessionCount} completed
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {result.sessionCount > 0 ? (
        <div className={CARD}>
          <p className="text-[13px] font-semibold text-gray-900">{result.reactionLabel}</p>
          <p className="mt-[8px] text-[13px] leading-[21px] text-gray-600">
            {result.reactionMeanSec == null ? 'Not stored' : formatReportSeconds(result.reactionMeanSec)}
          </p>
        </div>
      ) : null}
      {showContext
        ? result.contextMatches.map((match) => (
            <p key={match.measurement} className="text-[13px] leading-[21px] text-gray-500">
              {levelContextMatchText(match)}
            </p>
          ))
        : null}
      {showPatientHistory && history.length > 0 ? (
        <section className="space-y-[13px]">
          <h3 className="text-[13px] font-semibold text-gray-900">Sessions</h3>
          <ul className="space-y-[8px]">
            {history.map((row) => {
              const summary = formatPatientSummary(formatSessionReport(row));
              return (
                <li key={row.id} className={CARD}>
                  <p className="text-[13px] font-semibold text-gray-900">{summary.levelName}</p>
                  <p className="mt-[4px] text-[13px] text-gray-500">{formatReportDate(row.recordedAt)}</p>
                  <p className="mt-[4px] text-[13px] text-gray-600">{summary.scoreText ?? 'Performance not available'}</p>
                  {summary.timeText ? <p className="mt-[4px] text-[13px] text-gray-600">{summary.timeText}</p> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function SessionAnalyticsPanel({
  patientId,
  heading,
  initialRows,
  lockedLevel,
}: {
  patientId?: string;
  patientName: string;
  heading?: string;
  variant?: 'light' | 'shell';
  initialRows?: StoredGameSessionRecord[];
  lockedLevel?: { gameId: string; levelId: string };
}) {
  const [gameId, setGameId] = useState<string>(lockedLevel?.gameId ?? '');
  const [levelId, setLevelId] = useState(lockedLevel?.levelId ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [agg, setAgg] = useState<DailyAggMode>('pooled');
  const [scale, setScale] = useState<AnalyticsTimeScale>('week');
  const [rows, setRows] = useState<StoredGameSessionRecord[]>(initialRows ?? []);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState('');
  const [loadedKey, setLoadedKey] = useState('');
  const timeZone = resolvedTimeZone();
  const activeGameId = lockedLevel?.gameId || gameId;
  const activeLevelId = lockedLevel?.levelId || levelId;
  const levelMode = Boolean(activeLevelId);
  const requestKey = JSON.stringify({ patientId: patientId || '', gameId: activeGameId, levelId: activeLevelId, from, to, timeZone });

  useEffect(() => {
    if (!activeGameId) {
      setTruncated(false);
      return;
    }
    let cancelled = false;
    setTruncated(false);
    const range = analyticsQueryRange(from, to, timeZone);
    const params = {
      gameId: activeGameId,
      levelId: activeLevelId || undefined,
      from: range.from,
      to: range.to,
    };
    const req = patientId
      ? listPatientGameSessionOverview(patientId, params)
      : listMyGameSessionOverview(params);
    req
      .then((overview) => {
        if (!cancelled) {
          setRows(overview.sessions);
          setTruncated(overview.truncated);
          setError('');
          setLoadedKey(requestKey);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setTruncated(false);
          setError('Could not load sessions');
          setLoadedKey(requestKey);
        }
      })
    return () => {
      cancelled = true;
    };
  }, [patientId, activeGameId, activeLevelId, from, to, requestKey, timeZone]);

  const stored = useMemo(() => (activeGameId ? rows.map(toStored) : []), [rows, activeGameId]);
  const analytics = useMemo(
    () => buildGameSessionAnalytics(stored, { timeZone }),
    [stored, timeZone],
  );
  const loaded = loadedKey === requestKey;
  const levelResult = useMemo(() => {
    if (!levelMode || !loaded || !activeGameId) return null;
    return buildLevelAnalytics({
      gameId: activeGameId,
      levelId: activeLevelId,
      timeZone,
      rows: stored,
    });
  }, [levelMode, loaded, activeGameId, activeLevelId, timeZone, stored]);
  const identityError = levelResult?.status === 'invalid';
  const hasPlays = Boolean(activeGameId) && loaded && !levelMode && analytics.totals.sessionCount > 0;
  const chartsAllowed = Boolean(activeGameId) && sessionChartsAllowed(activeGameId, stored);
  const gazeUnsupported = Boolean(activeGameId) && loaded && !levelMode && showGazeHoldUnsupported(activeGameId, stored);
  const showCharts = hasPlays && chartsAllowed;
  const metrics = useMemo(
    () => (showCharts ? availableAnalyticsMetrics(gameId, stored) : []),
    [showCharts, gameId, stored],
  );
  const plotPoints = useMemo(
    () =>
      plotPointsForScale(stored, analytics.daily, scale, {
        from: from || undefined,
        to: to || undefined,
        timeZone,
      }),
    [stored, analytics.daily, scale, from, to, timeZone],
  );

  return (
    <div className="space-y-[34px] w-full min-w-0">
      <div className="space-y-[13px]">
        {heading ? <h2 className="text-[21px] font-semibold text-gray-900 text-balance">{heading}</h2> : null}
        {activeGameId && !levelMode ? (
          <p className="text-[13px] leading-[21px] text-gray-500">
            All levels (mixed). This view combines every level of this module.
          </p>
        ) : null}
        {activeGameId && truncated ? (
          <p className="text-[13px] leading-[21px] text-gray-900">{TRUNCATED_HISTORY_NOTE}</p>
        ) : null}
        <div className={lockedLevel ? 'grid grid-cols-2 gap-[13px]' : 'grid grid-cols-4 gap-[13px]'}>
          {lockedLevel ? null : (
            <label className={STACK}>
              Module
              <select
                value={gameId}
                onChange={(e) => {
                  setGameId(e.target.value);
                  setLevelId('');
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
          )}
          {lockedLevel ? null : (
            <label className={STACK}>
              Level
              <select
                value={levelId}
                onChange={(e) => setLevelId(e.target.value)}
                disabled={!gameId}
                className={`${FIELD} disabled:bg-gray-50 disabled:text-gray-400`}
              >
                <option value="">{gameId ? 'All levels (mixed)' : 'Pick a module first'}</option>
                {levelsForTherapyModule(gameId).map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className={STACK}>
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={FIELD} />
          </label>
          <label className={STACK}>
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={FIELD} />
          </label>
        </div>
      </div>

      {levelMode ? null : <div className="flex flex-wrap items-center justify-between gap-[13px]">
        <label className={LABEL}>
          Daily dot
          <select
            value={agg}
            onChange={(e) => setAgg(e.target.value as DailyAggMode)}
            className={FIELD}
          >
            <option value="pooled">Pooled average (default)</option>
            <option value="best">Best of day</option>
          </select>
        </label>
        <div className="flex items-center gap-[8px]">
          <p className="text-[13px] font-semibold text-gray-500">Time scale</p>
          <button
            type="button"
            aria-label="Previous time scale"
            disabled={scale === 'week'}
            onClick={() => setScale((prev) => zoomInScale(prev))}
            className={`inline-flex size-[34px] items-center justify-center rounded-[13px] border border-gray-200 bg-white text-[21px] leading-none text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 ${DASHBOARD_SHADOW}`}
          >
            −
          </button>
          <span className="min-w-[55px] text-center text-[13px] font-semibold text-gray-900">
            {ANALYTICS_SCALE_LABEL[scale]}
          </span>
          <button
            type="button"
            aria-label="Next time scale"
            disabled={scale === 'year'}
            onClick={() => setScale((prev) => zoomOutScale(prev))}
            className={`inline-flex size-[34px] items-center justify-center rounded-[13px] border border-gray-200 bg-white text-[21px] leading-none text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 ${DASHBOARD_SHADOW}`}
          >
            +
          </button>
        </div>
      </div>}

      {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
      {identityError ? (
        <p className="text-[13px] text-red-600">These sessions are not limited to the selected level, so this level was not summarized.</p>
      ) : null}

      {patientId && loaded && stored.length > 0 && !identityError ? <DoctorSessionList rows={stored} /> : null}

      {!activeGameId ? (
        <div className={`${CARD} text-center`}>
          <p className="text-[13px] font-semibold text-gray-900">{ANALYTICS_SELECT_GAME.title}</p>
          <p className="mt-[8px] text-[13px] leading-[21px] text-gray-500">{ANALYTICS_SELECT_GAME.body}</p>
        </div>
      ) : !loaded ? (
        <div className={`${CARD} text-center`}>
          <p className="text-[13px] font-semibold text-gray-900">Loading sessions</p>
          <p className="mt-[8px] text-[13px] leading-[21px] text-gray-500">Loading this module’s finished plays.</p>
        </div>
      ) : levelMode ? (
        levelResult?.status === 'ok' ? (
          <LevelAnalyticsBody
            result={levelResult}
            rows={stored}
            showPatientHistory={!patientId}
            showContext={Boolean(patientId)}
          />
        ) : null
      ) : (
        <>
          {gazeUnsupported ? (
            <div className={CARD}>
              <p className="text-[13px] leading-[21px] text-gray-600">{GAZE_HOLD_UNSUPPORTED_MESSAGE}</p>
            </div>
          ) : null}
          {hasPlays && !chartsAllowed && !gazeUnsupported ? (
            <div className={CARD}>
              <p className="text-[13px] leading-[21px] text-gray-600">
                These sessions are listed separately. They are not plotted together because they are not all Gaze Hold.
              </p>
            </div>
          ) : null}
          {!showCharts && !gazeUnsupported && !hasPlays ? (
            <div className={`${CARD} text-center`}>
              <p className="text-[13px] font-semibold text-gray-900">No graphs yet</p>
              <p className="mt-[8px] text-[13px] leading-[21px] text-gray-500">
                Finish a play of this module to see a weekly plot. Use − / + to zoom to month or year.
              </p>
            </div>
          ) : null}
          {showCharts ? (
        <div className="space-y-[13px]">
          {metrics.map((item) => (
            <div key={item.id} className={`${CARD} min-w-0 overflow-visible`}>
              <div className="mb-[13px] flex items-start justify-between gap-[13px] min-w-0">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-gray-900 break-words">{item.label}</p>
                  <p className="mt-[8px] text-[13px] leading-[21px] text-gray-500">{item.direction}</p>
                </div>
                {analytics.preliminary ? (
                  <p className="shrink-0 text-[13px] text-gray-500">Preliminary</p>
                ) : null}
              </div>
              <LineChart
                points={plotPoints}
                metric={item.id}
                agg={agg}
                color={item.color}
                scale={scale}
                unit={item.unit}
                yAxis={item.yAxis}
              />
            </div>
          ))}
        </div>
          ) : null}
        </>
      )}

      {showCharts ? <HowToReadCard gameId={gameId} levelId={levelId} metrics={metrics} /> : null}
    </div>
  );
}
