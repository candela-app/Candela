import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from 'react-native-svg';
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
  dailyPolylineSegments,
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
} from '@candela/shared/rn';
import { listMyGameSessions, listPatientGameSessions, type StoredGameSessionRecord } from '../lib/api';
import { useLayout } from '../lib/layout';
import { colors } from '../lib/theme';
import { ChevronUpIcon } from './icons';

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
}: {
  points: DailyPlotPoint[];
  metric: AnalyticsMetricId;
  agg: DailyAggMode;
  width: number;
  height: number;
  fs: (n: number) => number;
  color: string;
  scale: AnalyticsTimeScale;
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
  const played = points.filter(dailyHasPlay);
  const values = played.map((p) => yValueForDaily(p, metric, agg));
  const max = Math.max(...values, metric === 'accuracy' || metric.includes('Rate') ? 100 : 0.01);
  const min = 0;
  const innerH = Math.max(1, height - pad.t - pad.b);
  const x = (i: number) => plotPadL + (points.length <= 1 ? innerW / 2 : i * slot);
  const y = (v: number) => pad.t + innerH - ((v - min) / (max - min || 1)) * innerH;
  const segments = dailyPolylineSegments(points, x, y, metric, agg);
  const tip = selected != null && dailyHasPlay(points[selected]) ? points[selected] : null;
  const metricMeta = ANALYTICS_METRICS.find((m) => m.id === metric);
  const unit = metricMeta?.unit ?? '';
  const yAxis = metricMeta?.yAxis ?? metricMeta?.label ?? '';

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
              {metric === 'reaction' ? v.toFixed(2) : v.toFixed(0)}
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
            if (!dailyHasPlay(p)) return null;
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
            width: 180,
            backgroundColor: '#0F172A',
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: fs(11), flex: 1, marginRight: 8 }}>
              {formatPlotTooltip(tip.date, scale)} · {valueLabel}
            </Text>
            <Text style={{ color: '#94A3B8', fontWeight: '800', fontSize: fs(14), lineHeight: fs(16) }}>×</Text>
          </View>
          <Text style={{ color: '#CBD5E1', fontSize: fs(10), marginTop: 2 }}>
            {tip.sessionCount} session{tip.sessionCount === 1 ? '' : 's'}
          </Text>
          {tip.sessions.map((s) => (
            <Text key={s.sessionNumber} style={{ color: '#CBD5E1', fontSize: fs(10), marginTop: 2 }}>
              #{s.sessionNumber} · acc {s.accuracy}% · RT {s.avgReactionSec}s
            </Text>
          ))}
        </Pressable>
      ) : null}
    </View>
  );
}

function DropdownField({
  label,
  value,
  options,
  onChange,
  fs,
  s,
  disabled = false,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (next: string) => void;
  fs: (n: number) => number;
  s: (n: number) => number;
  disabled?: boolean;
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

function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  fs,
  s,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  fs: (n: number) => number;
  s: (n: number) => number;
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
  fs,
  s,
}: {
  gameId: string;
  levelId: string;
  fs: (n: number) => number;
  s: (n: number) => number;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: s(16),
        padding: s(14),
        gap: s(14),
      }}
    >
      <Text style={{ fontSize: fs(16), fontWeight: '800', color: colors.text }}>How to read this</Text>
      <View style={{ gap: s(4) }}>
        <Text style={{ fontSize: fs(13), fontWeight: '800', color: colors.text }}>{ANALYTICS_DOTS_GUIDE.title}</Text>
        <Text style={{ fontSize: fs(12), color: colors.muted, lineHeight: fs(18) }}>{ANALYTICS_DOTS_GUIDE.body}</Text>
      </View>
      <View style={{ gap: s(4) }}>
        <Text style={{ fontSize: fs(13), fontWeight: '800', color: colors.text }}>{ANALYTICS_SESSION_GUIDE.title}</Text>
        <Text style={{ fontSize: fs(12), color: colors.muted, lineHeight: fs(18) }}>{ANALYTICS_SESSION_GUIDE.body}</Text>
      </View>
      {ANALYTICS_GRAPH_GUIDES.map((guide) => (
        <View key={guide.id} style={{ gap: s(8) }}>
          <Text style={{ fontSize: fs(13), fontWeight: '800', color: ANALYTICS_METRICS.find((m) => m.id === guide.id)?.color ?? colors.text }}>
            {guide.title}
          </Text>
          <Text style={{ fontSize: fs(12), color: colors.muted, lineHeight: fs(18) }}>{guide.meaning}</Text>
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: s(12), overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', backgroundColor: '#F9FAFB', paddingHorizontal: s(10), paddingVertical: s(8) }}>
              <Text style={{ flex: 1, fontSize: fs(11), fontWeight: '700', color: colors.muted }}>Pattern</Text>
              <Text style={{ flex: 1, fontSize: fs(11), fontWeight: '700', color: colors.muted }}>Reading</Text>
            </View>
            {guide.trends.map((row) => (
              <View
                key={row.pattern}
                style={{
                  flexDirection: 'row',
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  paddingHorizontal: s(10),
                  paddingVertical: s(8),
                  gap: s(8),
                }}
              >
                <Text style={{ flex: 1, fontSize: fs(11), fontWeight: '700', color: colors.text }}>{row.pattern}</Text>
                <Text style={{ flex: 1, fontSize: fs(11), color: colors.muted }}>{row.reading}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
      <Text style={{ fontSize: fs(11), color: '#9CA3AF', lineHeight: fs(16) }}>{ANALYTICS_RATES_NOTE}</Text>
      <Text style={{ fontSize: fs(11), color: '#9CA3AF' }}>
        {gameId
          ? `Filter: ${GAME_CATALOG[gameId as TherapyModuleId]?.name}${
              levelId
                ? ` · ${MODULE_LEVELS[gameId as TherapyModuleId]?.find((l) => l.id === levelId)?.name ?? levelId}`
                : ' · all levels'
            }. Compare the same module.`
          : 'Pick a module to compare like-with-like. Mixing games on one line is noisy.'}
      </Text>
    </View>
  );
}

export function SessionAnalyticsPanel({
  patientId,
}: {
  patientId?: string;
  patientName: string;
}) {
  const { fs, s, width, pad, isTablet } = useLayout();
  const chartWidth = Math.max(280, width - pad * 2 - s(32));
  const [gameId, setGameId] = useState('');
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
    const req = patientId ? listPatientGameSessions(patientId, params) : listMyGameSessions(params);
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

  return (
    <View style={{ gap: s(12) }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
        {[
          { label: 'Sessions', value: String(analytics.totals.sessionCount), color: '#2563EB' },
          { label: 'Last played', value: lastPlayed, color: '#D97706' },
          {
            label: 'Accuracy',
            value: analytics.totals.avgAccuracy != null ? `${analytics.totals.avgAccuracy}%` : '—',
            color: '#059669',
          },
          { label: 'Dates plotted', value: String(analytics.daily.length), color: '#7C3AED' },
        ].map((item) => (
          <View
            key={item.label}
            style={{
              flexGrow: 1,
              flexBasis: '47%',
              backgroundColor: colors.white,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: s(16),
              padding: s(12),
            }}
          >
            <Text style={{ fontSize: fs(10), fontWeight: '800', color: item.color, letterSpacing: 0.6 }}>
              {item.label.toUpperCase()}
            </Text>
            <Text style={{ fontSize: fs(20), fontWeight: '800', color: colors.text, marginTop: s(4) }}>{item.value}</Text>
          </View>
        ))}
      </View>

      <View
        style={{
          backgroundColor: colors.white,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: s(16),
          padding: s(14),
          gap: s(12),
        }}
      >
        <DropdownField
          label="Module"
          value={gameId}
          onChange={(next) => {
            setGameId(next);
            setLevelId('');
          }}
          fs={fs}
          s={s}
          options={[
            { value: '', label: 'All modules' },
            ...ALL_MODULE_IDS.map((id) => ({ value: id, label: GAME_CATALOG[id].name })),
          ]}
        />
        <DropdownField
          label="Level"
          value={levelId}
          onChange={setLevelId}
          disabled={!gameId}
          fs={fs}
          s={s}
          options={[
            { value: '', label: gameId ? 'All levels' : 'Pick a module first' },
            ...levelsForTherapyModule(gameId).map((level) => ({ value: level.id, label: level.name })),
          ]}
        />
        <View style={{ flexDirection: isTablet ? 'row' : 'column', gap: s(12) }}>
          <DateField
            label="From"
            value={from}
            onChange={setFrom}
            maximumDate={to ? parseLocalISODate(to) : undefined}
            fs={fs}
            s={s}
          />
          <DateField
            label="To"
            value={to}
            onChange={setTo}
            minimumDate={from ? parseLocalISODate(from) : undefined}
            fs={fs}
            s={s}
          />
        </View>
        <DropdownField
          label="Daily dot"
          value={agg}
          onChange={(next) => setAgg(next as DailyAggMode)}
          fs={fs}
          s={s}
          options={[
            { value: 'pooled', label: 'Pooled average (default)' },
            { value: 'best', label: 'Best of day' },
          ]}
        />
      </View>

      {error ? <Text style={{ color: colors.red, fontSize: fs(13) }}>{error}</Text> : null}
      {loading ? <Text style={{ color: colors.muted, fontSize: fs(13) }}>Loading sessions…</Text> : null}

      {!loading && !hasPlays ? (
        <View
          style={{
            backgroundColor: colors.white,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.border,
            borderRadius: s(16),
            padding: s(28),
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: fs(14), fontWeight: '800', color: colors.text }}>No graphs yet</Text>
          <Text style={{ fontSize: fs(12), color: colors.muted, marginTop: s(6), textAlign: 'center' }}>
            Finish a play to see a weekly plot. Use − / + to zoom to month or year.
          </Text>
        </View>
      ) : (
        <>
          <View
            style={{
              backgroundColor: colors.white,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: s(16),
              padding: s(12),
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ fontSize: fs(12), fontWeight: '700', color: colors.muted }}>Time scale</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
              <Pressable
                onPress={() => setScale((prev) => zoomOutScale(prev))}
                disabled={scale === 'year'}
                accessibilityRole="button"
                accessibilityLabel="Zoom out"
                style={{
                  width: s(32),
                  height: s(32),
                  borderRadius: s(8),
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: scale === 'year' ? 0.4 : 1,
                }}
              >
                <Text style={{ fontSize: fs(18), fontWeight: '800', color: colors.text }}>−</Text>
              </Pressable>
              <Text style={{ minWidth: s(64), textAlign: 'center', fontSize: fs(14), fontWeight: '800', color: colors.text }}>
                {ANALYTICS_SCALE_LABEL[scale]}
              </Text>
              <Pressable
                onPress={() => setScale((prev) => zoomInScale(prev))}
                disabled={scale === 'week'}
                accessibilityRole="button"
                accessibilityLabel="Zoom in"
                style={{
                  width: s(32),
                  height: s(32),
                  borderRadius: s(8),
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: scale === 'week' ? 0.4 : 1,
                }}
              >
                <Text style={{ fontSize: fs(18), fontWeight: '800', color: colors.text }}>+</Text>
              </Pressable>
            </View>
          </View>
        {ANALYTICS_METRICS.map((item) => (
          <View
            key={item.id}
            style={{
              backgroundColor: colors.white,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: s(16),
              padding: s(14),
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: s(8) }}>
              <View style={{ flex: 1, marginRight: s(8) }}>
                <Text style={{ fontSize: fs(14), fontWeight: '800', color: item.color }}>{item.label}</Text>
                <Text style={{ fontSize: fs(11), color: colors.muted, marginTop: s(2) }}>{item.direction}</Text>
              </View>
              {analytics.preliminary ? (
                <Text style={{ fontSize: fs(10), color: colors.muted }}>Preliminary</Text>
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
            />
          </View>
        ))}
        </>
      )}

      <HowToReadGuide gameId={gameId} levelId={levelId} fs={fs} s={s} />
    </View>
  );
}
