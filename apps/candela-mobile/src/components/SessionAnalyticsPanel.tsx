import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from 'react-native-svg';
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
  dailyMetricPlotted,
  dailyPolylineSegments,
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
  type SessionReport,
  type StoredGameSession,
  type TherapyModuleId,
} from '@candela/shared/rn';
import { listMyGameSessionOverview, listPatientGameSessionOverview, type StoredGameSessionRecord } from '../lib/api';
import { useLayout } from '../lib/layout';
import { colors } from '../lib/theme';
import { ChevronUpIcon } from './icons';

const cardShadow = {
  shadowColor: '#0f172a',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.14,
  shadowRadius: 18,
  elevation: 4,
};

function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatFilterDate(iso: string): string {
  return parseLocalISODate(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function toStored(row: StoredGameSessionRecord): StoredGameSession {
  return {
    ...row,
    gameId: row.gameId as TherapyModuleId,
    levelId: row.levelId ?? null,
    deviceTier: row.deviceTier ?? null,
  };
}

function LineChart({
  points,
  metric,
  agg,
  width,
  height,
  fs,
  color,
  scale,
  unit,
  yAxis,
  showGameName = false,
}: {
  points: DailyPlotPoint[];
  metric: AnalyticsMetricId;
  agg: DailyAggMode;
  width: number;
  height: number;
  fs: (n: number) => number;
  color: string;
  scale: AnalyticsTimeScale;
  unit: string;
  yAxis: string;
  showGameName?: boolean;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const pad = { l: 52, r: 12, t: 16, b: 28 };
  const plotPadL = 10;
  const viewportInner = Math.max(1, width - pad.l - pad.r);
  const visibleSlots = Math.max(2, analyticsVisibleSlots(scale));
  const slot = viewportInner / (visibleSlots - 1);
  const innerW = slot * Math.max(visibleSlots - 1, Math.max(1, points.length - 1));
  const plotW = plotPadL + innerW + pad.r;
  const played = points.filter((point) => dailyMetricPlotted(point, metric, agg));
  const values = played.map((p) => yValueForDaily(p, metric, agg));
  const max = Math.max(...values, metric === 'accuracy' || metric.includes('Rate') ? 100 : 0.01);
  const min = 0;
  const innerH = Math.max(1, height - pad.t - pad.b);
  const x = (i: number) => plotPadL + (points.length <= 1 ? innerW / 2 : i * slot);
  const y = (v: number) => pad.t + innerH - ((v - min) / (max - min || 1)) * innerH;
  const segments = dailyPolylineSegments(points, x, y, metric, agg);
  const tip = selected != null && dailyMetricPlotted(points[selected], metric, agg) ? points[selected] : null;

  const seriesKey = points.map((p) => p.date).join('|');
  useEffect(() => {
    setSelected(null);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
  }, [metric, agg, seriesKey, plotW]);

  if (points.length === 0) {
    return (
      <View
        style={{
          height,
          borderRadius: 12,
          backgroundColor: '#F9FAFB',
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: fs(12), fontWeight: '600', color: '#9CA3AF' }}>No graphs yet</Text>
      </View>
    );
  }

  const stroke = color;
  const valueLabel =
    tip != null
      ? `${yValueForDaily(tip, metric, agg).toFixed(metric === 'reaction' ? 2 : 1)}${unit}`
      : '';

  const yMid = pad.t + innerH / 2;

  return (
    <View style={{ position: 'relative' }}>
      <View style={{ flexDirection: 'row' }}>
      <Svg width={pad.l} height={height}>
        {[0, 0.5, 1].map((t) => {
          const v = min + (max - min) * (1 - t);
          const yy = pad.t + innerH * t;
          return (
            <SvgText key={t} x={pad.l - 6} y={yy + 4} textAnchor="end" fontSize={10} fill="#9CA3AF">
              {metric === 'reaction' ? v.toFixed(2) : metric === 'duration' ? v.toFixed(1) : v.toFixed(0)}
            </SvgText>
          );
        })}
        <SvgText
          x={12}
          y={yMid}
          rotation={-90}
          origin={`${12}, ${yMid}`}
          textAnchor="middle"
          fontSize={10}
          fill="#6B7280"
          fontWeight="600"
        >
          {yAxis}
        </SvgText>
      </Svg>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator
        style={{ flex: 1 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <Svg width={Math.max(plotW, viewportInner)} height={height}>
          {[0, 0.5, 1].map((t) => {
            const yy = pad.t + innerH * t;
            return (
              <Line
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
          {segments.map((poly, i) => (
            <Polyline key={i} points={poly} fill="none" stroke={stroke} strokeWidth={2.5} />
          ))}
          {points.map((p, i) => {
            if (!dailyMetricPlotted(p, metric, agg)) return null;
            const value = yValueForDaily(p, metric, agg);
            const px = x(i);
            const py = y(value);
            const label = `${value.toFixed(metric === 'reaction' ? 2 : 1)}${unit}`;
            const labelBelow = py < pad.t + 14;
            return (
              <G key={p.date}>
                <Circle cx={px} cy={py} r={selected === i ? 7 : 5} fill={stroke} />
                <SvgText
                  x={px}
                  y={labelBelow ? py + 16 : py - 10}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight="700"
                  fill={stroke}
                >
                  {label}
                </SvgText>
                <Circle
                  cx={px}
                  cy={py}
                  r={18}
                  fill="transparent"
                  onPress={() => setSelected((cur) => (cur === i ? null : i))}
                />
              </G>
            );
          })}
          {points.map((p, i) =>
            shouldDrawPlotTick(p.date, scale, i, points.length) ? (
              <SvgText key={`${p.date}-x`} x={x(i)} y={height - 14} textAnchor="middle" fontSize={10} fill="#6B7280">
                {formatPlotTick(p.date, scale)}
              </SvgText>
            ) : null,
          )}
        </Svg>
      </ScrollView>
      </View>
      <Text
        style={{
          textAlign: 'center',
          paddingLeft: pad.l,
          fontSize: fs(11),
          fontWeight: '600',
          color: '#6B7280',
        }}
      >
        {formatPlotAxisName(points, scale)}
      </Text>
      {tip ? (
        <Modal visible transparent animationType="none" onRequestClose={() => setSelected(null)}>
          <Pressable
            onPress={() => setSelected(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss tooltip"
            style={{ flex: 1 }}
          />
        </Modal>
      ) : null}
      {tip ? (
        <Pressable
          onPress={() => setSelected(null)}
          accessibilityRole="button"
          accessibilityLabel="Close tooltip"
          style={{
            position: 'absolute',
            zIndex: 2,
            left: pad.l,
            top: 4,
            width: showGameName ? Math.min(width - pad.l - 8, 300) : Math.min(width - pad.l - 8, 220),
            maxHeight: 250,
            backgroundColor: '#0F172A',
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: 'rgba(51, 65, 85, 0.8)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#1E293B' }}>
            <Text style={{ color: '#F1F5F9', fontWeight: '800', fontSize: fs(11), flex: 1, marginRight: 8 }} numberOfLines={1}>
              {formatPlotTooltip(tip.date, scale)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: '#34D399', fontWeight: '800', fontSize: fs(11) }}>{valueLabel}</Text>
              <Text style={{ color: '#94A3B8', fontWeight: '800', fontSize: fs(14), lineHeight: fs(16) }}>×</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#1E293B' }}>
            <Text style={{ width: 22, color: '#94A3B8', fontSize: fs(9), fontWeight: '700' }}>#</Text>
            {showGameName ? (
              <Text style={{ flex: 1, color: '#94A3B8', fontSize: fs(9), fontWeight: '700', paddingRight: 4 }}>Game</Text>
            ) : null}
            <Text style={{ width: 34, textAlign: 'right', color: '#94A3B8', fontSize: fs(9), fontWeight: '700' }}>Acc</Text>
            <Text style={{ width: 34, textAlign: 'right', color: '#94A3B8', fontSize: fs(9), fontWeight: '700' }}>RT</Text>
            <Text style={{ width: 32, textAlign: 'right', color: '#94A3B8', fontSize: fs(9), fontWeight: '700' }}>Time</Text>
          </View>
          <ScrollView
            style={{ maxHeight: 150 }}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            {tip.sessions.map((s) => (
              <View
                key={s.sessionNumber}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 4,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(30, 41, 59, 0.5)',
                }}
              >
                <Text style={{ width: 22, color: '#94A3B8', fontSize: fs(10), fontWeight: '600' }}>
                  #{s.sessionNumber}
                </Text>
                {showGameName ? (
                  <Text
                    style={{ flex: 1, color: '#67E8F9', fontSize: fs(10), fontWeight: '600', paddingRight: 4 }}
                    numberOfLines={1}
                  >
                    {s.gameName || '—'}
                  </Text>
                ) : null}
                <Text style={{ width: 34, textAlign: 'right', color: '#E2E8F0', fontSize: fs(10), fontWeight: '600' }}>
                  {s.accuracy}%
                </Text>
                <Text style={{ width: 34, textAlign: 'right', color: '#CBD5E1', fontSize: fs(10) }}>
                  {s.avgReactionSec}s
                </Text>
                <Text style={{ width: 32, textAlign: 'right', color: '#94A3B8', fontSize: fs(10) }}>
                  {s.durationSec}s
                </Text>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      ) : null}
    </View>
  );
}

export function DropdownField({
  label,
  value,
  options,
  onChange,
  fs,
  s,
  disabled = false,
  shadowed = false,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (next: string) => void;
  fs: (n: number) => number;
  s: (n: number) => number;
  disabled?: boolean;
  shadowed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((item) => item.value === value)?.label ?? options[0]?.label ?? '';
  return (
    <View>
      <Text style={{ fontSize: fs(11), fontWeight: '700', color: colors.muted, marginBottom: s(6) }}>{label}</Text>
      <Pressable
        onPress={() => {
          if (!disabled) setOpen(true);
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: s(12),
          paddingHorizontal: s(12),
          paddingVertical: s(10),
          backgroundColor: disabled ? '#F9FAFB' : colors.white,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: disabled ? 0.7 : 1,
          ...(shadowed
            ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 18, elevation: 4 }
            : null),
        }}
      >
        <Text style={{ fontSize: fs(14), fontWeight: '600', color: colors.text, flex: 1, marginRight: s(8) }}>
          {selected}
        </Text>
        <View style={{ transform: [{ rotate: '180deg' }] }}>
          <ChevronUpIcon size={fs(14)} color={colors.muted} />
        </View>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={() => undefined}
            style={{
              backgroundColor: colors.white,
              borderTopLeftRadius: s(20),
              borderTopRightRadius: s(20),
              maxHeight: '70%',
            }}
          >
            <Text style={{ fontSize: fs(16), fontWeight: '800', color: colors.text, padding: s(16) }}>{label}</Text>
            <ScrollView>
              {options.map((item) => {
                const active = item.value === value;
                return (
                  <Pressable
                    key={item.value || 'all'}
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                    style={{
                      paddingHorizontal: s(16),
                      paddingVertical: s(14),
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                      backgroundColor: active ? '#EFF6FF' : colors.white,
                    }}
                  >
                    <Text style={{ fontSize: fs(14), fontWeight: active ? '800' : '600', color: active ? colors.blue : colors.text }}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  fs,
  s,
  shadowed = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  fs: (n: number) => number;
  s: (n: number) => number;
  shadowed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => (value ? parseLocalISODate(value) : new Date()));
  const selected = value ? parseLocalISODate(value) : new Date();

  const fieldStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: s(12),
    paddingHorizontal: s(12),
    paddingVertical: s(10),
    backgroundColor: colors.white,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    minHeight: s(42),
    ...(shadowed
      ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 18, elevation: 4 }
      : null),
  };

  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: fs(11), fontWeight: '700', color: colors.muted, marginBottom: s(6) }}>{label}</Text>
        {createElement('input', {
          type: 'date',
          value,
          onChange: (event: { target: { value: string } }) => onChange(event.target.value),
          style: {
            width: '100%',
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 10,
            fontSize: 14,
            fontWeight: '600',
            ...(shadowed
              ? { boxShadow: '0 12px 32px -14px rgba(15, 23, 42, 0.35)' }
              : null),
          },
        })}
      </View>
    );
  }

  function applyDate(next: Date) {
    onChange(toLocalISODate(next));
  }

  function onNativeChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type === 'set' && date) applyDate(date);
      return;
    }
    if (date) setDraft(date);
  }

  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: fs(11), fontWeight: '700', color: colors.muted, marginBottom: s(6) }}>{label}</Text>
      <Pressable
        onPress={() => {
          setDraft(selected);
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={fieldStyle}
      >
        <Text
          style={{
            fontSize: fs(14),
            fontWeight: '600',
            color: value ? colors.text : colors.muted,
            flex: 1,
            marginRight: s(8),
          }}
        >
          {value ? formatFilterDate(value) : 'Any date'}
        </Text>
        {value ? (
          <Pressable
            onPress={() => onChange('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
          >
            <Text style={{ fontSize: fs(12), fontWeight: '700', color: colors.blue }}>Clear</Text>
          </Pressable>
        ) : (
          <View style={{ transform: [{ rotate: '180deg' }] }}>
            <ChevronUpIcon size={fs(14)} color={colors.muted} />
          </View>
        )}
      </Pressable>
      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={selected}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={onNativeChange}
        />
      ) : null}
      {Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable
            onPress={() => setOpen(false)}
            style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' }}
          >
            <Pressable
              onPress={() => undefined}
              style={{
                backgroundColor: colors.white,
                borderTopLeftRadius: s(20),
                borderTopRightRadius: s(20),
                paddingBottom: s(24),
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingHorizontal: s(16),
                  paddingTop: s(16),
                }}
              >
                <Pressable onPress={() => { onChange(''); setOpen(false); }}>
                  <Text style={{ fontSize: fs(14), fontWeight: '700', color: colors.muted }}>Clear</Text>
                </Pressable>
                <Text style={{ fontSize: fs(16), fontWeight: '800', color: colors.text }}>{label}</Text>
                <Pressable
                  onPress={() => {
                    applyDate(draft);
                    setOpen(false);
                  }}
                >
                  <Text style={{ fontSize: fs(14), fontWeight: '800', color: colors.blue }}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={draft}
                mode="date"
                display="spinner"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={onNativeChange}
                style={{ height: 180 }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

function HowToReadGuide({
  gameId,
  levelId,
  metrics,
  fs,
  s,
}: {
  gameId: string;
  levelId: string;
  metrics: AnalyticsMetricDef[];
  fs: (n: number) => number;
  s: (n: number) => number;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: s(13),
        padding: s(21),
        gap: s(21),
        ...cardShadow,
      }}
    >
      <Text style={{ fontSize: fs(21), fontWeight: '600', color: colors.ink }}>How to read this</Text>
      <View style={{ gap: s(8) }}>
        <Text style={{ fontSize: fs(13), fontWeight: '600', color: colors.ink }}>{ANALYTICS_DOTS_GUIDE.title}</Text>
        <Text style={{ fontSize: fs(13), color: colors.muted, lineHeight: fs(21) }}>{ANALYTICS_DOTS_GUIDE.body}</Text>
      </View>
      <View style={{ gap: s(8) }}>
        <Text style={{ fontSize: fs(13), fontWeight: '600', color: colors.ink }}>{ANALYTICS_SESSION_GUIDE.title}</Text>
        <Text style={{ fontSize: fs(13), color: colors.muted, lineHeight: fs(21) }}>{ANALYTICS_SESSION_GUIDE.body}</Text>
      </View>
      {metrics.map((guide) => (
        <View key={guide.id} style={{ gap: s(8) }}>
          <Text style={{ fontSize: fs(13), fontWeight: '600', color: colors.ink }}>
            {guide.label}
          </Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, lineHeight: fs(21) }}>{guide.meaning}</Text>
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: s(13), overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', backgroundColor: '#F9FAFB', paddingHorizontal: s(13), paddingVertical: s(8) }}>
              <Text style={{ flex: 1, fontSize: fs(13), fontWeight: '600', color: colors.muted }}>Pattern</Text>
              <Text style={{ flex: 1, fontSize: fs(13), fontWeight: '600', color: colors.muted }}>Reading</Text>
            </View>
            {guide.trends.map((row) => (
              <View
                key={row.pattern}
                style={{
                  flexDirection: 'row',
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  paddingHorizontal: s(13),
                  paddingVertical: s(8),
                  gap: s(8),
                }}
              >
                <Text style={{ flex: 1, fontSize: fs(13), fontWeight: '600', color: colors.ink }}>{row.pattern}</Text>
                <Text style={{ flex: 1, fontSize: fs(13), color: colors.muted }}>{row.reading}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
      {metrics.some((metric) => metric.id === 'wrongTapRate' || metric.id === 'missRate') ? (
        <Text style={{ fontSize: fs(13), color: colors.muted, lineHeight: fs(21) }}>{ANALYTICS_RATES_NOTE}</Text>
      ) : null}
      <Text style={{ fontSize: fs(13), color: colors.muted, lineHeight: fs(21) }}>
        {gameId
          ? `Filter: ${GAME_CATALOG[gameId as TherapyModuleId]?.name}${
              levelId
                ? ` · ${MODULE_LEVELS[gameId as TherapyModuleId]?.find((l) => l.id === levelId)?.name ?? levelId}`
                : ' · All levels (mixed)'
            }. Compare the same module.`
          : 'Pick a module to compare like-with-like. Mixing games on one line is noisy.'}
      </Text>
    </View>
  );
}

function formatReportDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Date not recorded';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function DoctorSessionList({
  rows,
  fs,
  s,
}: {
  rows: StoredGameSession[];
  fs: (n: number) => number;
  s: (n: number) => number;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const reports = rows.map((row) => formatSessionReport(row));
  const notice = mixedLevelNotice(reports.map((report) => report.levelName));
  return (
    <View style={{ gap: s(13) }}>
      <Text style={{ fontSize: fs(13), fontWeight: '600', color: colors.ink }}>Sessions</Text>
      {notice ? <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.muted }}>{notice}</Text> : null}
      {reports.map((report, index) => {
        const open = openId === report.id;
        const detailLines = formatDoctorDetail(rows[index]?.detail);
        return (
          <View
            key={report.id}
            style={{
              backgroundColor: colors.white,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: s(13),
              padding: s(21),
              ...cardShadow,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              onPress={() => setOpenId(open ? null : report.id)}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: s(13) }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fs(13), fontWeight: '600', color: colors.ink }}>{report.moduleName}</Text>
                  <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(4) }}>{report.levelName}</Text>
                  <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(4) }}>{formatReportDate(report.recordedAt)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: fs(13), fontWeight: '600', color: colors.ink }}>
                    {report.score.value == null ? 'Not stored' : `${report.score.value}%`}
                  </Text>
                  <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(4) }}>{report.score.label}</Text>
                  <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(4) }}>
                    {report.time.meanSec == null ? 'Time not stored' : formatReportSeconds(report.time.meanSec)}
                  </Text>
                </View>
              </View>
            </Pressable>
            {open ? <SessionReportDetail report={report} detailLines={detailLines} fs={fs} s={s} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function SessionReportDetail({
  report,
  detailLines,
  fs,
  s,
}: {
  report: SessionReport;
  detailLines: { label: string; value: string }[];
  fs: (n: number) => number;
  s: (n: number) => number;
}) {
  return (
    <View style={{ marginTop: s(13), paddingTop: s(13), borderTopWidth: 1, borderTopColor: colors.border, gap: s(8) }}>
      {report.counts.map((line) => (
        <Text key={line.label} style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.ink }}>
          {line.label}: {line.count}
          {line.rate == null ? '' : ` (${line.rate}%)`}
        </Text>
      ))}
      <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.ink }}>
        {report.time.label}:{' '}
        {report.time.meanSec == null
          ? 'Not stored'
          : `${formatReportSeconds(report.time.meanSec)}${report.time.medianSec == null ? '' : `, median ${formatReportSeconds(report.time.medianSec)}`}`}
      </Text>
      {report.duration.seconds == null ? null : (
        <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.ink }}>
          {report.duration.label}: {report.duration.seconds}s
        </Text>
      )}
      {report.efficiency == null ? null : (
        <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.ink }}>Efficiency: {report.efficiency}</Text>
      )}
      {report.deviceTier ? (
        <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.ink }}>Device: {report.deviceTier}</Text>
      ) : null}
      {report.contrastPercent == null ? null : (
        <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.ink }}>Contrast: {report.contrastPercent}%</Text>
      )}
      {report.notices.map((notice) => (
        <Text key={notice} style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.muted }}>
          {notice}
        </Text>
      ))}
      {detailLines.map((line, lineIndex) => (
        <Text key={`${line.label}-${lineIndex}`} style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.ink }}>
          {line.label}: {line.value}
        </Text>
      ))}
    </View>
  );
}

function LevelTrend({ points, width }: { points: LevelDailyPoint[]; width: number }) {
  if (points.length === 0) return null;
  const height = 160;
  const pad = { l: 28, r: 8, t: 12, b: 24 };
  const innerW = Math.max(1, width - pad.l - pad.r);
  const innerH = height - pad.t - pad.b;
  const x = (index: number) => pad.l + (points.length <= 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const y = (value: number) => pad.t + innerH - (value / 100) * innerH;
  const poly = points.map((point, index) => `${x(index)},${y(point.performance)}`).join(' ');
  return (
    <Svg width={width} height={height}>
      <Polyline points={poly} fill="none" stroke="#2563eb" strokeWidth={2.5} />
      {points.map((point, index) => (
        <Circle key={point.date} cx={x(index)} cy={y(point.performance)} r={4} fill="#2563eb" />
      ))}
    </Svg>
  );
}

function LevelAnalyticsBody({
  result,
  rows,
  showPatientHistory,
  showContext,
  chartWidth,
}: {
  result: LevelAnalyticsOk;
  rows: StoredGameSession[];
  showPatientHistory: boolean;
  showContext: boolean;
  chartWidth: number;
}) {
  const { fs, s } = useLayout();
  const gazeEmpty = result.gameId === 'computer_vision' && result.sessionCount === 0;
  const performance =
    result.sessionCount === 0 || result.performanceValue == null || result.performanceLabel == null
      ? null
      : `${result.performanceLabel} ${result.performanceValue}%`;
  const history = rows.slice().sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  const card = {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: s(13),
    padding: s(21),
    ...cardShadow,
  };
  return (
    <View style={{ gap: s(13) }}>
      <View style={card}>
        <Text style={{ fontSize: fs(13), fontWeight: '600', color: colors.ink }}>{result.levelName}</Text>
        {gazeEmpty ? (
          <Text style={{ marginTop: s(8), fontSize: fs(13), lineHeight: fs(21), color: colors.muted }}>{GAZE_HOLD_UNSUPPORTED_MESSAGE}</Text>
        ) : result.sessionCount === 0 ? (
          <Text style={{ marginTop: s(8), fontSize: fs(13), lineHeight: fs(21), color: colors.muted }}>{levelEmptyMessage(result.levelName)}</Text>
        ) : (
          <View style={{ marginTop: s(13), gap: s(8) }}>
            <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.ink }}>{performance ?? 'Performance not available'}</Text>
            <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.ink }}>{result.sessionCount} completed</Text>
            <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.ink }}>
              {result.lastCompletedAt ? formatReportDate(result.lastCompletedAt) : 'Date not recorded'}
            </Text>
          </View>
        )}
      </View>
      {result.sessionCount > 0 ? (
        <View style={card}>
          <Text style={{ fontSize: fs(13), fontWeight: '600', color: colors.ink }}>{result.performanceLabel ?? 'Performance'}</Text>
          <Text style={{ marginTop: s(8), fontSize: fs(13), lineHeight: fs(21), color: colors.muted }}>
            This line uses only {result.levelName}. A day is omitted when its sessions have no valid measurement. Those sessions stay in the count and the list.
          </Text>
          {result.daily.length > 0 ? <LevelTrend points={result.daily} width={chartWidth} /> : (
            <Text style={{ marginTop: s(13), fontSize: fs(13), lineHeight: fs(21), color: colors.ink }}>No performance points for this level.</Text>
          )}
          {result.daily.map((point) => (
            <Text key={point.date} style={{ marginTop: s(8), fontSize: fs(13), lineHeight: fs(21), color: colors.ink }}>
              {point.date}: {point.performance}% · {point.sessionCount} completed
            </Text>
          ))}
        </View>
      ) : null}
      {result.sessionCount > 0 ? (
        <View style={card}>
          <Text style={{ fontSize: fs(13), fontWeight: '600', color: colors.ink }}>{result.reactionLabel}</Text>
          <Text style={{ marginTop: s(8), fontSize: fs(13), lineHeight: fs(21), color: colors.ink }}>
            {result.reactionMeanSec == null ? 'Not stored' : formatReportSeconds(result.reactionMeanSec)}
          </Text>
        </View>
      ) : null}
      {showContext
        ? result.contextMatches.map((match) => (
            <Text key={match.measurement} style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.muted }}>
              {levelContextMatchText(match)}
            </Text>
          ))
        : null}
      {showPatientHistory && history.length > 0 ? (
        <View style={{ gap: s(8) }}>
          <Text style={{ fontSize: fs(13), fontWeight: '600', color: colors.ink }}>Sessions</Text>
          {history.map((row) => {
            const summary = formatPatientSummary(formatSessionReport(row));
            return (
              <View key={row.id} style={card}>
                <Text style={{ fontSize: fs(13), fontWeight: '600', color: colors.ink }}>{summary.levelName}</Text>
                <Text style={{ marginTop: s(4), fontSize: fs(13), color: colors.muted }}>{formatReportDate(row.recordedAt)}</Text>
                <Text style={{ marginTop: s(4), fontSize: fs(13), color: colors.ink }}>{summary.scoreText ?? 'Performance not available'}</Text>
                {summary.timeText ? <Text style={{ marginTop: s(4), fontSize: fs(13), color: colors.ink }}>{summary.timeText}</Text> : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export function SessionAnalyticsPanel({
  patientId,
  heading,
  lockedLevel,
}: {
  patientId?: string;
  patientName: string;
  heading?: string;
  lockedLevel?: { gameId: string; levelId: string };
}) {
  const { fs, s, width, pad } = useLayout();
  const chartWidth = Math.max(280, width - pad * 2 - s(32));
  const [gameId, setGameId] = useState(lockedLevel?.gameId ?? '');
  const [levelId, setLevelId] = useState(lockedLevel?.levelId ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [agg, setAgg] = useState<DailyAggMode>('pooled');
  const [scale, setScale] = useState<AnalyticsTimeScale>('week');
  const [rows, setRows] = useState<StoredGameSessionRecord[]>([]);
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
    const req = patientId ? listPatientGameSessionOverview(patientId, params) : listMyGameSessionOverview(params);
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
  const analytics = useMemo(() => buildGameSessionAnalytics(stored, { timeZone }), [stored, timeZone]);
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
    <View style={{ gap: s(34) }}>
      <View style={{ gap: s(13) }}>
        {heading ? <Text style={{ fontSize: fs(21), fontWeight: '600', color: colors.ink }}>{heading}</Text> : null}
        {activeGameId && !levelMode ? (
          <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.muted }}>
            All levels (mixed). This view combines every level of this module.
          </Text>
        ) : null}
        {activeGameId && truncated ? (
          <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.ink }}>{TRUNCATED_HISTORY_NOTE}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: s(13) }}>
          {lockedLevel ? null : <View style={{ flexGrow: 1, minWidth: s(144) }}>
            <DropdownField
              label="Module"
              value={gameId}
              onChange={(next) => {
                setGameId(next);
                setLevelId('');
              }}
              fs={fs}
              s={s}
              shadowed
              options={[
                { value: '', label: ANALYTICS_SELECT_GAME.title },
                ...ALL_MODULE_IDS.map((id) => ({ value: id, label: GAME_CATALOG[id].name })),
              ]}
            />
          </View>}
          {lockedLevel ? null : <View style={{ flexGrow: 1, minWidth: s(144) }}>
            <DropdownField
              label="Level"
              value={levelId}
              onChange={setLevelId}
              disabled={!gameId}
              fs={fs}
              s={s}
              shadowed
              options={[
                { value: '', label: gameId ? 'All levels (mixed)' : 'Pick a module first' },
                ...levelsForTherapyModule(gameId).map((level) => ({ value: level.id, label: level.name })),
              ]}
            />
          </View>}
          <View style={{ flexGrow: 1, minWidth: s(144) }}>
            <DateField
              label="From"
              value={from}
              onChange={setFrom}
              maximumDate={to ? parseLocalISODate(to) : undefined}
              fs={fs}
              s={s}
            />
          </View>
          <View style={{ flexGrow: 1, minWidth: s(144) }}>
            <DateField
              label="To"
              value={to}
              onChange={setTo}
              minimumDate={from ? parseLocalISODate(from) : undefined}
              fs={fs}
              s={s}
            />
          </View>
        </View>
      </View>

      {levelMode ? null : <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: s(13) }}>
        <View style={{ flexGrow: 1, minWidth: s(144) }}>
          <DropdownField
            label="Daily dot"
            value={agg}
            onChange={(next) => setAgg(next as DailyAggMode)}
            fs={fs}
            s={s}
            shadowed
            options={[
              { value: 'pooled', label: 'Pooled average (default)' },
              { value: 'best', label: 'Best of day' },
            ]}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
          <Text style={{ fontSize: fs(13), fontWeight: '600', color: colors.muted }}>Time scale</Text>
          <Pressable
            onPress={() => setScale((prev) => zoomInScale(prev))}
            disabled={scale === 'week'}
            accessibilityRole="button"
            accessibilityLabel="Previous time scale"
            style={{
              width: s(34),
              height: s(34),
              borderRadius: s(13),
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.white,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: scale === 'week' ? 0.4 : 1,
              ...cardShadow,
            }}
          >
            <Text style={{ fontSize: fs(21), fontWeight: '600', color: colors.ink }}>−</Text>
          </Pressable>
          <Text style={{ minWidth: s(55), textAlign: 'center', fontSize: fs(13), fontWeight: '600', color: colors.ink }}>
            {ANALYTICS_SCALE_LABEL[scale]}
          </Text>
          <Pressable
            onPress={() => setScale((prev) => zoomOutScale(prev))}
            disabled={scale === 'year'}
            accessibilityRole="button"
            accessibilityLabel="Next time scale"
            style={{
              width: s(34),
              height: s(34),
              borderRadius: s(13),
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.white,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: scale === 'year' ? 0.4 : 1,
              ...cardShadow,
            }}
          >
            <Text style={{ fontSize: fs(21), fontWeight: '600', color: colors.ink }}>+</Text>
          </Pressable>
        </View>
      </View>}

      {error ? <Text style={{ color: colors.red, fontSize: fs(13) }}>{error}</Text> : null}
      {identityError ? (
        <Text style={{ color: colors.red, fontSize: fs(13) }}>
          These sessions are not limited to the selected level, so this level was not summarized.
        </Text>
      ) : null}

      {patientId && loaded && stored.length > 0 && !identityError ? <DoctorSessionList rows={stored} fs={fs} s={s} /> : null}

      {!activeGameId ? (
        <View
          style={{
            backgroundColor: colors.white,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: s(13),
            padding: s(21),
            alignItems: 'center',
            ...cardShadow,
          }}
        >
          <Text style={{ fontSize: fs(13), fontWeight: '600', color: colors.ink }}>{ANALYTICS_SELECT_GAME.title}</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(8), textAlign: 'center', lineHeight: fs(21) }}>
            {ANALYTICS_SELECT_GAME.body}
          </Text>
        </View>
      ) : !loaded ? (
        <View
          style={{
            backgroundColor: colors.white,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: s(13),
            padding: s(21),
            alignItems: 'center',
            ...cardShadow,
          }}
        >
          <Text style={{ fontSize: fs(13), fontWeight: '600', color: colors.ink }}>Loading sessions</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(8), textAlign: 'center', lineHeight: fs(21) }}>
            Loading this module’s finished plays.
          </Text>
        </View>
      ) : levelMode ? (
        levelResult?.status === 'ok' ? (
          <LevelAnalyticsBody
            result={levelResult}
            rows={stored}
            showPatientHistory={!patientId}
            showContext={Boolean(patientId)}
            chartWidth={chartWidth}
          />
        ) : null
      ) : (
        <View style={{ gap: s(13) }}>
          {gazeUnsupported ? (
            <View style={{ backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: s(13), padding: s(21), ...cardShadow }}>
              <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.ink }}>{GAZE_HOLD_UNSUPPORTED_MESSAGE}</Text>
            </View>
          ) : null}
          {hasPlays && !chartsAllowed && !gazeUnsupported ? (
            <View style={{ backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: s(13), padding: s(21), ...cardShadow }}>
              <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.ink }}>
                These sessions are listed separately. They are not plotted together because they are not all Gaze Hold.
              </Text>
            </View>
          ) : null}
          {!showCharts && !gazeUnsupported && !hasPlays ? (
            <View style={{ backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: s(13), padding: s(21), alignItems: 'center', ...cardShadow }}>
              <Text style={{ fontSize: fs(13), fontWeight: '600', color: colors.ink }}>No graphs yet</Text>
              <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(8), textAlign: 'center', lineHeight: fs(21) }}>
                Finish a play of this module to see a weekly plot. Use − / + to zoom to month or year.
              </Text>
            </View>
          ) : null}
          {showCharts ? (
        <View style={{ gap: s(13) }}>
        {metrics.map((item) => (
          <View
            key={item.id}
            style={{
              backgroundColor: colors.white,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: s(13),
              padding: s(21),
              ...cardShadow,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: s(13) }}>
              <View style={{ flex: 1, marginRight: s(8) }}>
                <Text style={{ fontSize: fs(13), fontWeight: '600', color: colors.ink }}>{item.label}</Text>
                <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(8), lineHeight: fs(21) }}>{item.direction}</Text>
              </View>
              {analytics.preliminary ? (
                <Text style={{ fontSize: fs(13), color: colors.muted }}>Preliminary</Text>
              ) : null}
            </View>
            <LineChart
              points={plotPoints}
              metric={item.id}
              agg={agg}
              width={chartWidth}
              height={s(220)}
              fs={fs}
              color={item.color}
              scale={scale}
              unit={item.unit}
              yAxis={item.yAxis}
            />
          </View>
        ))}
        </View>
          ) : null}
        </View>
      )}

      {showCharts ? <HowToReadGuide gameId={gameId} levelId={levelId} metrics={metrics} fs={fs} s={s} /> : null}
    </View>
  );
}
