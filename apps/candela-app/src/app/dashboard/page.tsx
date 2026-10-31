'use client';

import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { RotatoryWheelGame } from '@/components/rotatoryModule/RotatoryWheelGame';
import { SortingGame } from '@/components/sortingModule/SortingGame';
import { BeeTracingGame } from '@/components/beeTrackingModule/BeeTracingGame';
import { PursuitGame } from '@/components/pursuitModule/PursuitGame';
import { MobileTargetGame } from '@/components/mobileTargetModule/MobileTargetGame';
import { GeoboardGame } from '@/components/geoboardModule/GeoboardGame';
import { PeripheralViewGame } from '@/components/peripheralViewModule/PeripheralViewGame';
import { NumberSearchGame } from '@/components/numberSearchModule/NumberSearchGame';
import { PatternMatchGame } from '@/components/patternMatchModule/PatternMatchGame';
import { LocationMemoryGame } from '@/components/locationMemoryModule/LocationMemoryGame';
import { DirectionSenseGame } from '@/components/directionSenseModule/DirectionSenseGame';
import { GazeHoldGame } from '@/components/lookPursuitModule/GazeHoldGame';
import { FamiliarFacesGame } from '@/components/familiarFacesModule/FamiliarFacesGame';
import {
  AnalyticsIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  CloseIcon,
  CreditCardIcon,
  GearIcon,
  HistoryIcon,
  InfoIcon,
  EyeIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  SortOrderIcon,
  UserIcon,
} from '@/components/icons/VectorIcons';
import {
  GameMode,
  AlphabetVariant,
  SortingVariant,
  GeoboardBoardId,
  GEOBOARD_BOARDS,
  GEOBOARD_BOARD_IDS,
  requestFullScreenSafe,
  UI_MODULE_TO_CATALOG,
  CATALOG_TO_UI_MODULE,
  MODULE_LEVELS,
  resolveAllowedModuleIds,
  ALL_MODULE_IDS,
  GAME_CATALOG,
  GAME_FAMILIES,
  PEDIATRIC_GAME_FAMILIES,
  levelsForTherapyModule,
  getGameFamily,
  familyForModuleId,
  isTherapyFamilyId,
  resolveBeePathType,
  resolvePursuitPattern,
  resolveLookPursuitPattern,
  resolveFamiliarFacesLevelId,
  resolvePeripheralField,
  directionSensePrescribedAllows,
  normalizeDirectionSenseLevelId,
  buildGameSessionAnalytics,
  consistencyStreak,
  type PursuitMovementPattern,
  type PeripheralField,
  type TherapyModuleId,
} from '@candela/shared';
import { listMyGameSessions, type StoredGameSessionRecord } from '@/lib/api';
import streakFire from '@candela/shared/assets/lottie/streak-fire.json';
import { useAuth } from '@/lib/auth-context';
import { AppHeader } from '@/components/layout/AppHeader';
import { SessionAnalyticsPanel } from '@/components/shared/SessionAnalyticsPanel';
import { EditPatientNameModal } from '@/components/common/EditPatientNameModal';
import { CopyButton } from '@/components/ui/CopyButton';
import { DocIdRequestCard } from '@/components/docid/DocIdRequestCard';
import { MODULE_CARDS } from '@/lib/shell';
import type { LottieHandle } from 'lottie-react';

const StreakFire = dynamic(() => import('lottie-react').then((mod) => mod.Lottie), {
  ssr: false,
});

const VARIANT_TILE =
  'min-h-[140px] w-full rounded-2xl bg-white text-center flex flex-col justify-center items-center gap-2 p-4 border border-gray-200 shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)] hover:border-gray-300 cursor-pointer';

const EMPTY_LEVELS =
  'col-span-full bg-white rounded-2xl border border-gray-200 shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)] p-10 text-center w-full';

const CHOOSER_PANE = 'flex-1 min-h-0 overflow-hidden overscroll-none lg:overflow-visible';
const CHOOSER_SCROLL = 'relative z-0 max-h-full overflow-y-auto overscroll-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden lg:-mt-[81px] lg:h-[calc(100%+81px)] lg:max-h-none lg:pt-[81px]';

type ActiveView = 'module' | 'games' | 'family' | 'game' | 'analytics' | 'account' | 'settings' | 'history' | 'subscription' | 'help' | 'play_rotatory' | 'play_sorting' | 'play_bee_tracing' | 'play_pursuit' | 'play_mobile_target' | 'play_geoboard' | 'play_peripheral_view' | 'play_number_search' | 'play_pattern_match' | 'play_location_memory' | 'play_direction_sense' | 'play_computer_vision' | 'play_familiar_faces';

const DASHBOARD_SHADOW = 'shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)]';

function OpenArrow() {
  const timing = React.useRef({
    delay: Math.random() * 1.8,
    duration: 2.2 + Math.random() * 0.8,
  });

  return (
    <ArrowRightIcon
      className="open-hint size-3.5"
      style={{
        animation: `open-hint ${timing.current.duration}s cubic-bezier(0.22, 1, 0.36, 1) ${timing.current.delay}s infinite`,
      }}
    />
  );
}

function DigitReel({ digit, clock }: { digit: number; clock: string }) {
  const cells = [digit, ...Array.from({ length: 10 }, (_, index) => index % 10), digit];

  return (
    <span className="block h-4 overflow-hidden">
      <span
        className="digit-reel"
        style={{
          animation: `digit-reel ${clock}`,
          ['--reel-land' as string]: `-${cells.length - 1}rem`,
        }}
      >
        {cells.map((value, index) => (
          <span key={index} className="block h-4 text-center leading-4">
            {value}
          </span>
        ))}
      </span>
    </span>
  );
}

function PrescribedCount({
  count,
  duration,
  delay,
}: {
  count: number;
  duration: string;
  delay: number;
}) {
  if (count <= 0) {
    return (
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-gray-600">
        0
      </span>
    );
  }

  const digits = String(count).split('').map((value) => Number(value));

  return (
    <span className="inline-flex items-center gap-px overflow-hidden rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-blue-600">
      {digits.map((digit, index) => (
        <DigitReel
          key={`${digit}-${index}`}
          digit={digit}
          clock={`${duration}s linear ${(delay + index * 0.08).toFixed(2)}s infinite`}
        />
      ))}
    </span>
  );
}

function ShineLabel({ children, clock }: { children: React.ReactNode; clock: string }) {
  return (
    <span className="count-shine">
      {children}
      <span aria-hidden="true" className="count-shine-glint" style={{ animation: `count-shine ${clock}` }}>
        {children}
      </span>
    </span>
  );
}

function CatalogCue({ label, count }: { label: string; count: number }) {
  const cue = React.useRef({
    duration: (2.6 + Math.random() * 0.3).toFixed(2),
    delay: Number((Math.random() * 1.2).toFixed(2)),
  });
  const clock = `${cue.current.duration}s linear ${cue.current.delay.toFixed(2)}s infinite`;

  return (
    <>
      {count > 0 ? <ShineLabel clock={clock}>{label}</ShineLabel> : label}
      <PrescribedCount count={count} duration={cue.current.duration} delay={cue.current.delay} />
    </>
  );
}

function formatSessionDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins < 60) {
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = (seconds / 3600).toFixed(1);
  return `${hours}h`;
}

function formatSessionDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function sessionDayKey(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'unknown';
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

type HistoryMonth = { year: number; month: number };

function currentHistoryMonth(): HistoryMonth {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function todayHistoryDay(): string {
  return historyDayKey(currentHistoryMonth(), new Date().getDate());
}

function monthPrefix(cursor: HistoryMonth): string {
  return `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`;
}

function daysInHistoryMonth(cursor: HistoryMonth): number {
  return new Date(cursor.year, cursor.month + 1, 0).getDate();
}

function historyDayKey(cursor: HistoryMonth, day: number): string {
  return `${monthPrefix(cursor)}-${String(day).padStart(2, '0')}`;
}

const HISTORY_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function historyYearOptions(rows: StoredGameSessionRecord[], selectedYear?: number): number[] {
  const years = new Set<number>([new Date().getFullYear()]);
  if (selectedYear) years.add(selectedYear);
  for (const row of rows) {
    const day = sessionDayKey(row.recordedAt);
    if (day === 'unknown') continue;
    years.add(Number(day.slice(0, 4)));
  }
  return Array.from(years).sort((a, b) => a - b);
}

function weekdayLabel(cursor: HistoryMonth, day: number): string {
  return new Date(cursor.year, cursor.month, day).toLocaleDateString('en-GB', { weekday: 'short' });
}

function latestHistoryDay(
  rows: StoredGameSessionRecord[],
  gameId: string,
  levelId: string,
  prefix?: string,
): string {
  let latest = '';
  for (const row of rows) {
    if (gameId && row.gameId !== gameId) continue;
    if (levelId && (row.levelId ?? '') !== levelId) continue;
    const day = sessionDayKey(row.recordedAt);
    if (day === 'unknown') continue;
    if (prefix && !day.startsWith(prefix)) continue;
    if (day > latest) latest = day;
  }
  return latest;
}

function monthFromDayKey(dayKey: string): HistoryMonth {
  const [year, month] = dayKey.split('-').map(Number);
  return { year, month: (month || 1) - 1 };
}

function formatSelectedHistoryDay(dayKey: string): string {
  if (!dayKey || dayKey === 'unknown') return '';
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
}

function historyPlayCounts(
  rows: StoredGameSessionRecord[],
  gameId: string,
  levelId: string,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (gameId && row.gameId !== gameId) continue;
    if (levelId && (row.levelId ?? '') !== levelId) continue;
    const day = sessionDayKey(row.recordedAt);
    if (day === 'unknown') continue;
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return counts;
}

function monthContributionWeeks(year: number, month: number): (string | null)[][] {
  const weeks: (string | null)[][] = [];
  let week: (string | null)[] = Array.from({ length: new Date(year, month, 1).getDay() }, () => null);
  const days = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= days; day += 1) {
    week.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

function contributionDotClass(count: number): string {
  if (count >= 4) return 'bg-emerald-600';
  if (count >= 2) return 'bg-emerald-400';
  if (count >= 1) return 'bg-emerald-200';
  return 'bg-gray-200';
}

function StreakDotsDialog({
  open,
  sessions,
  onClose,
}: {
  open: boolean;
  sessions: StoredGameSessionRecord[];
  onClose: () => void;
}) {
  const nowYear = new Date().getFullYear();
  const [year, setYear] = React.useState(nowYear);
  const counts = historyPlayCounts(sessions, '', '');
  const yearOptions = historyYearOptions(sessions, year);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-[21px]" role="presentation">
      <button type="button" aria-label="Close streak graph" onClick={onClose} className="absolute inset-0 bg-gray-900/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Streak"
        className={`relative z-10 max-h-[calc(100dvh-42px)] w-full max-w-[930px] overflow-y-auto rounded-[13px] border border-gray-200 bg-white p-[21px] ${DASHBOARD_SHADOW}`}
      >
        <div className="mb-[21px] flex items-center justify-between gap-[13px]">
          <HistoryMenu
            label="Year"
            value={String(year)}
            options={yearOptions.map((option) => ({ value: String(option), label: String(option) }))}
            onChange={(next) => setYear(Number(next))}
          />
          <p className="self-end pb-[13px] text-[13px] font-semibold text-gray-500">Played days</p>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={`inline-flex size-[34px] items-center justify-center rounded-[13px] border border-gray-200 bg-white text-gray-900 ${DASHBOARD_SHADOW}`}
          >
            <CloseIcon className="size-[13px]" />
          </button>
        </div>
        <div className="overflow-x-auto overflow-y-visible pt-[34px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-full justify-between gap-[8px]">
            {HISTORY_MONTH_NAMES.map((name, month) => (
              <div key={name} className="flex shrink-0 flex-col items-center gap-[8px]">
                <p className="text-[13px] font-semibold text-gray-500">{name.slice(0, 3)}</p>
                <div className="flex gap-[2px]">
                  {monthContributionWeeks(year, month).map((week, weekIndex) => (
                    <div key={weekIndex} className="flex flex-col gap-[2px]">
                      {week.map((dayKey, dayIndex) => {
                        if (!dayKey) return <span key={`empty-${dayIndex}`} className="size-[8px]" />;
                        const count = counts.get(dayKey) ?? 0;
                        return (
                          <span
                            key={dayKey}
                            aria-label={`${count} ${count === 1 ? 'game' : 'games'} on ${formatSelectedHistoryDay(dayKey)}`}
                            className="group relative size-[8px]"
                          >
                            <span className={`block size-full rounded-full ${contributionDotClass(count)}`} />
                            <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-[8px] hidden -translate-x-1/2 whitespace-nowrap rounded-[8px] bg-gray-900 px-[8px] py-[8px] text-[13px] font-semibold text-white group-hover:block">
                              {count} {count === 1 ? 'game' : 'games'}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryMenu({
  label,
  value,
  options,
  align = 'left',
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  align?: 'left' | 'right';
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value)?.label ?? value;

  React.useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <p className="mb-[8px] text-[13px] font-semibold text-gray-500">{label}</p>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
        className={`flex items-center gap-[8px] rounded-[13px] border border-gray-200 bg-white px-[13px] py-[13px] text-[21px] font-semibold leading-none text-gray-900 ${DASHBOARD_SHADOW}`}
      >
        <span>{selected}</span>
        <ChevronDownIcon className={`size-[13px] text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label={label}
          className={`absolute z-20 mt-[8px] max-h-[233px] min-w-full overflow-y-auto rounded-[13px] border border-gray-200 bg-white p-[8px] ${DASHBOARD_SHADOW} ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full whitespace-nowrap rounded-[8px] px-[13px] py-[13px] text-left text-[13px] font-semibold ${
                    active ? 'bg-gray-900 text-white' : 'text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function LinkedDoctor({ name, code }: { name: string | null | undefined; code: string | null | undefined }) {
  if (!name && !code) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-[13px] gap-y-[8px]">
      <span className="text-[21px] font-semibold leading-none text-gray-900">{name ? `Dr. ${name}` : 'Your doctor'}</span>
      {code ? (
        <span className="inline-flex items-center gap-[8px] font-mono text-[21px] font-semibold leading-none tabular-nums text-gray-900">
          {code}
          <CopyButton text={code} label="DocID" iconSize={13} />
        </span>
      ) : null}
    </p>
  );
}

function DashboardSummary({
  sessions,
  doctorName,
  doctorCode,
  onSessionsClick,
}: {
  sessions: StoredGameSessionRecord[];
  doctorName: string | null | undefined;
  doctorCode: string | null | undefined;
  onSessionsClick: () => void;
}) {
  const totals = buildGameSessionAnalytics(
    sessions.map((row) => ({
      ...row,
      gameId: row.gameId as TherapyModuleId,
      levelId: row.levelId ?? null,
      deviceTier: row.deviceTier ?? null,
    })),
  ).totals;
  let lastPlayed = '—';
  let lastPlayedHint = totals.sessionCount ? 'Most recent session' : 'Not played yet';
  if (totals.lastPlayedAt) {
    const parsed = new Date(totals.lastPlayedAt);
    if (!Number.isNaN(parsed.getTime())) {
      lastPlayed = parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      lastPlayedHint = `Most recent session in ${parsed.getFullYear()}`;
    }
  }
  const mean = (value: number | null, suffix = '') => (value != null ? `${value}${suffix}` : '—');
  const streak = consistencyStreak(sessions.map((row) => row.recordedAt));
  const streakFireRef = React.useRef<LottieHandle>(null);
  const [streakOpen, setStreakOpen] = React.useState(false);
  const cards: { label: string; value: string; hint: string }[] = [
    { label: 'Sessions', value: String(totals.sessionCount), hint: totals.sessionCount === 1 ? '1 finished play' : `${totals.sessionCount} finished plays` },
    { label: 'Last played', value: lastPlayed, hint: lastPlayedHint },
    {
      label: 'Streak',
      value: String(streak),
      hint: totals.sessionCount === 0 ? 'Not played yet' : streak > 0 ? 'Consecutive days' : 'No current streak',
    },
    { label: 'Accuracy', value: mean(totals.avgAccuracy, '%'), hint: 'Mean' },
    { label: 'Avg reaction time', value: mean(totals.avgReactionSec, 's'), hint: 'Mean' },
    { label: 'Efficiency', value: mean(totals.efficiency), hint: 'Mean' },
    { label: 'Wrong-tap rate', value: mean(totals.wrongTapRate, '%'), hint: 'Mean' },
    { label: 'Miss rate', value: mean(totals.missRate, '%'), hint: 'Mean' },
    { label: 'Time to finish', value: mean(totals.avgDurationSec, 's'), hint: 'Mean' },
  ];

  return (
    <div className="grid grid-cols-1 gap-[13px] md:grid-cols-2">
      <div className={`flex items-center justify-between gap-[21px] rounded-[13px] border border-gray-200 bg-white p-[21px] md:col-span-2 ${DASHBOARD_SHADOW}`}>
        <div className="min-w-0">
          <p className="text-[13px] leading-[21px] text-gray-900">
            <span className="kpi-draw">Your doctor</span>
          </p>
          <p className="mt-[8px] text-[34px] font-semibold leading-none text-gray-900">{doctorName ? `Dr. ${doctorName}` : '—'}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[13px] leading-[21px] text-gray-900">
            <span className="kpi-draw" style={{ '--kpi-delay': '180ms' } as React.CSSProperties}>DocID</span>
          </p>
          <p className="mt-[8px] flex items-center justify-end gap-[8px] font-mono text-[34px] font-semibold leading-none tabular-nums text-gray-900">
            {doctorCode || '—'}
            {doctorCode ? <CopyButton text={doctorCode} label="DocID" iconSize={13} /> : null}
          </p>
        </div>
      </div>
      {cards.map((card, index) => {
        const isStreak = card.label === 'Streak';
        const isSessions = card.label === 'Sessions';
        const cardClass = `flex items-center justify-between gap-[13px] rounded-[13px] border border-gray-200 bg-white p-[21px] text-left ${DASHBOARD_SHADOW} ${isStreak || isSessions ? 'cursor-pointer' : ''}`;
        const body = (
          <>
            <div className="min-w-0">
              <p className="text-[13px] leading-[21px] text-gray-900">
                <span className="kpi-draw" style={{ '--kpi-delay': `${(index + 2) * 180}ms` } as React.CSSProperties}>{card.label}</span>
              </p>
              <p className="mt-[8px] text-[13px] leading-[21px] text-gray-500">{card.hint}</p>
            </div>
            <div className={`relative flex h-[34px] shrink-0 items-center ${isStreak ? 'pr-[48px]' : ''}`}>
              <span className="text-[34px] font-semibold leading-none tabular-nums text-gray-900">{card.value}</span>
              {isStreak ? (
                <StreakFire
                  lottieRef={streakFireRef}
                  src={streakFire}
                  loop
                  autoplay
                  subscriptions={{ ready: () => streakFireRef.current?.play() }}
                  className="pointer-events-none absolute right-0 top-1/2 h-[55px] w-[40px] -translate-y-[calc(50%+9px)]"
                />
              ) : null}
            </div>
          </>
        );
        if (isStreak) {
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => setStreakOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={streakOpen}
              className={cardClass}
            >
              {body}
            </button>
          );
        }
        if (isSessions) {
          return (
            <button
              key={card.label}
              type="button"
              onClick={onSessionsClick}
              className={cardClass}
            >
              {body}
            </button>
          );
        }
        return (
          <div key={card.label} className={cardClass}>
            {body}
          </div>
        );
      })}
      <div className={`flex items-center justify-between gap-[13px] rounded-[13px] border border-gray-200 bg-white p-[21px] ${DASHBOARD_SHADOW}`}>
        <p className="text-[13px] leading-[21px] text-gray-900">
            <span className="kpi-draw" style={{ '--kpi-delay': `${(cards.length + 2) * 180}ms` } as React.CSSProperties}>Games</span>
        </p>
        <div className="flex shrink-0 items-center gap-[21px]">
          <div className="text-right">
            <p className="text-[13px] leading-[21px] text-gray-500">Standard</p>
            <p className="mt-[8px] text-[34px] font-semibold leading-none tabular-nums text-gray-900">{totals.normalGameCount}</p>
          </div>
          <div className="text-right">
            <p className="text-[13px] leading-[21px] text-gray-500">Pediatric</p>
            <p className="mt-[8px] text-[34px] font-semibold leading-none tabular-nums text-gray-900">{totals.pediatricGameCount}</p>
          </div>
        </div>
      </div>
      <StreakDotsDialog open={streakOpen} sessions={sessions} onClose={() => setStreakOpen(false)} />
    </div>
  );
}

function DashboardKpiCards({
  sessionCount,
  avgAccuracy,
  lastPlayed,
  durationSec,
}: {
  sessionCount: number;
  avgAccuracy: number | null;
  lastPlayed: string;
  durationSec: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-[13px] md:grid-cols-2">
      {(
        [
          { label: 'Sessions', value: String(sessionCount), hint: sessionCount === 1 ? '1 finished play' : `${sessionCount} finished plays` },
          { label: 'Accuracy', value: avgAccuracy != null ? `${avgAccuracy}%` : '—', hint: avgAccuracy != null ? 'Mean score' : 'No plays yet' },
          { label: 'Last played', value: lastPlayed, hint: sessionCount ? 'Most recent session' : 'Not played yet' },
          { label: 'Time spent', value: formatSessionDuration(durationSec), hint: durationSec > 0 ? 'Total training time' : '0 minutes recorded' },
        ]
      ).map((card, index) => (
        <div key={card.label} className={`flex items-center justify-between gap-[13px] rounded-[13px] border border-gray-200 bg-white p-[21px] ${DASHBOARD_SHADOW}`}>
          <div className="min-w-0">
            <p className="text-[13px] leading-[21px] text-gray-900">
              <span className="kpi-draw" style={{ '--kpi-delay': `${index * 180}ms` } as React.CSSProperties}>{card.label}</span>
            </p>
            <p className="mt-[8px] text-[13px] leading-[21px] text-gray-500">{card.hint}</p>
          </div>
          <p className="shrink-0 text-[34px] font-semibold leading-none tabular-nums whitespace-nowrap text-gray-900">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

function MainContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, loading: authLoading, logout } = useAuth();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [docIdRequestOpen, setDocIdRequestOpen] = useState(false);
  const [catalog, setCatalog] = useState<'normal' | 'pediatric'>('normal');
  const [sessions, setSessions] = useState<StoredGameSessionRecord[]>([]);
  const [sessionsReady, setSessionsReady] = useState(false);
  const [historyGameId, setHistoryGameId] = useState('');
  const [historyLevelId, setHistoryLevelId] = useState('');
  const [historyMonth, setHistoryMonth] = useState<HistoryMonth>(currentHistoryMonth);
  const [historyDay, setHistoryDay] = useState(todayHistoryDay);
  const [historySort, setHistorySort] = useState<'desc' | 'asc'>('desc');

  const loadSessions = React.useCallback(async () => {
    if (session?.user?.role !== 'patient') return;
    try {
      const data = await listMyGameSessions();
      setSessions(data);
    } catch {
      setSessions([]);
    } finally {
      setSessionsReady(true);
    }
  }, [session?.user?.role]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if ((searchParams.get('welcome') === '1' || session?.isNewUser) && session?.user?.role === 'patient') {
      setShowWelcomeModal(true);
    }
  }, [searchParams, session?.isNewUser, session?.user?.role]);

  const allowedModuleIds = new Set(resolveAllowedModuleIds(session));
  const canPlayUiModule = (uiId: string) => {
    const catalogId = UI_MODULE_TO_CATALOG[uiId];
    return Boolean(catalogId && allowedModuleIds.has(catalogId));
  };

  const isLevelAllowed = (uiId: string, levelId: string | number) => {
    if (!session || session.user.role !== 'patient') {
      return true;
    }
    if (!session.patient?.doctorId) {
      return true;
    }
    const catalogId = UI_MODULE_TO_CATALOG[uiId];
    if (!catalogId) {
      return false;
    }
    if (!allowedModuleIds.has(catalogId)) {
      return false;
    }
    const prescribedLevels = session.patient?.prescribedLevels?.[catalogId];
    if (prescribedLevels === undefined) {
      return true;
    }
    if (catalogId === 'bee_tracing') {
      const known = MODULE_LEVELS.bee_tracing.map((level) => level.id);
      const hasNewLevels = prescribedLevels.some((id) => known.includes(id));
      if (!hasNewLevels) return true;
    }
    if (catalogId === 'pursuit') {
      const known = MODULE_LEVELS.pursuit.map((level) => level.id);
      const hasNewLevels = prescribedLevels.some((id) => known.includes(id));
      if (!hasNewLevels) return true;
    }
    if (catalogId === 'computer_vision') {
      const known = MODULE_LEVELS.computer_vision.map((level) => level.id);
      const hasNewLevels = prescribedLevels.some((id) => known.includes(id));
      if (!hasNewLevels) return true;
    }
    if (catalogId === 'geoboard' && String(levelId) === '6') return true;
    if (catalogId === 'computer_vision' && String(levelId) === 'stationary') return true;
    if (catalogId === 'direction_sense') {
      return directionSensePrescribedAllows(String(levelId), prescribedLevels);
    }
    return prescribedLevels.includes(String(levelId));
  };

  const [view, setView] = useState<ActiveView>('module');
  const [selectedTherapy, setSelectedTherapy] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);

  const [rotatoryConfig, setRotatoryConfig] = useState<{ mode: GameMode; variant: AlphabetVariant }>({
    mode: 'alphabets',
    variant: 'uppercase',
  });
  const [mobileTargetConfig, setMobileTargetConfig] = useState<{ mode: GameMode; variant: AlphabetVariant }>({
    mode: 'alphabets',
    variant: 'uppercase',
  });
  const [sortingVariant, setSortingVariant] = useState<SortingVariant>('uppercase');
  const [beePathType, setBeePathType] = useState<string>('straight');
  const [pursuitPattern, setPursuitPattern] = useState<PursuitMovementPattern>('linear_bounce');
  const [geoboardBoardId, setGeoboardBoardId] = useState<GeoboardBoardId>(1);
  const [peripheralField, setPeripheralField] = useState<PeripheralField>('both');
  const [patternMatchLevelId, setPatternMatchLevelId] = useState<string>('standard');
  const [locationMemoryLevelId, setLocationMemoryLevelId] = useState<string>('standard');
  const [directionSenseLevelId, setDirectionSenseLevelId] = useState<string>('face');
  const [computerVisionPattern, setComputerVisionPattern] = useState<PursuitMovementPattern>('stationary');
  const [familiarFacesLevelId, setFamiliarFacesLevelId] = useState('name_it');

  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const scrollPositionsRef = React.useRef<Record<string, number>>({});
  const currentViewKey = `${view}:${selectedFamily || ''}:${selectedModule || ''}`;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    scrollPositionsRef.current[currentViewKey] = e.currentTarget.scrollTop;
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const targetScroll = scrollPositionsRef.current[currentViewKey] ?? 0;
    // Restore scroll position after DOM renders
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = targetScroll;
      }
    });
  }, [currentViewKey]);

  // Sync state from URL Query Params
  useEffect(() => {
    const pageParam = searchParams.get('page');
    const familyParam = searchParams.get('family');
    const moduleParam = searchParams.get('module');
    const gameParam = searchParams.get('game');
    const modeParam = searchParams.get('mode') as GameMode | null;
    const variantParam = searchParams.get('variant') as AlphabetVariant | SortingVariant | null;
    const boardParam = searchParams.get('board');

    if (gameParam === 'rotatory' || (moduleParam === 'wheel' && modeParam)) {
      setRotatoryConfig({
        mode: modeParam || 'alphabets',
        variant: (variantParam as AlphabetVariant) || 'uppercase',
      });
      setSelectedTherapy('vision');
      setSelectedModule('wheel');
      setSelectedFamily(familyParam || 'spin_field');
      setView('play_rotatory');
    } else if (gameParam === 'sorting' || (moduleParam === 'sorting' && variantParam)) {
      setSortingVariant((variantParam as SortingVariant) || 'uppercase');
      setSelectedTherapy('vision');
      setSelectedModule('sorting');
      setSelectedFamily(familyParam || 'spin_field');
      setView('play_sorting');
    } else if (gameParam === 'bee_tracing') {
      setBeePathType(resolveBeePathType(variantParam));
      setSelectedTherapy('vision');
      setSelectedModule('tracing');
      setSelectedFamily(familyParam || 'trace_build');
      setView('play_bee_tracing');
    } else if (gameParam === 'pursuit') {
      if (variantParam) {
        setPursuitPattern(resolvePursuitPattern(variantParam));
        setSelectedTherapy('vision');
        setSelectedModule('pursuit');
        setSelectedFamily(familyParam || 'tap_timing');
        setView('play_pursuit');
      } else {
        setSelectedTherapy('vision');
        setSelectedModule('pursuit');
        setSelectedFamily(familyParam || 'tap_timing');
        setView('game');
      }
    } else if (gameParam === 'geoboard') {
      const parsed = Number(boardParam);
      const resolved = (GEOBOARD_BOARD_IDS as number[]).includes(parsed)
        ? (parsed as GeoboardBoardId)
        : 1;
      setGeoboardBoardId(resolved);
      setSelectedTherapy('vision');
      setSelectedModule('geoboard');
      setSelectedFamily(familyParam || 'trace_build');
      setView('play_geoboard');
    } else if (gameParam === 'peripheral_view' || gameParam === 'peripheral') {
      setPeripheralField(resolvePeripheralField(variantParam));
      setSelectedTherapy('vision');
      setSelectedModule('peripheral');
      setSelectedFamily(familyParam || 'look_jumps');
      setView('play_peripheral_view');
    } else if (gameParam === 'number_search') {
      setSelectedTherapy('vision');
      setSelectedModule('number_search');
      setSelectedFamily(familyParam || 'look_jumps');
      setView('play_number_search');
    } else if (gameParam === 'pattern_match') {
      const pmLevel = searchParams.get('variant');
      setPatternMatchLevelId(pmLevel === 'compound' ? 'compound' : 'standard');
      setSelectedTherapy('vision');
      setSelectedModule('pattern_match');
      setSelectedFamily(familyParam || 'glimpse_hold');
      setView('play_pattern_match');
    } else if (gameParam === 'location_memory') {
      const lmLevel = searchParams.get('variant');
      setLocationMemoryLevelId(
        lmLevel === 'practice' ? 'practice' : lmLevel === 'match' ? 'match' : 'standard',
      );
      setSelectedTherapy('vision');
      setSelectedModule('location_memory');
      setSelectedFamily(familyParam || 'glimpse_hold');
      setView('play_location_memory');
    } else if (gameParam === 'direction_sense') {
      const dsLevel = searchParams.get('variant');
      setDirectionSenseLevelId(normalizeDirectionSenseLevelId(dsLevel));
      setSelectedTherapy('vision');
      setSelectedModule('direction_sense');
      setSelectedFamily(familyParam || 'glimpse_hold');
      setView('play_direction_sense');
    } else if (gameParam === 'computer_vision') {
      if (variantParam) {
        setComputerVisionPattern(resolveLookPursuitPattern(variantParam));
        setSelectedTherapy('vision');
        setSelectedModule('computer_vision');
        setSelectedFamily(familyParam || 'tap_timing');
        setView('play_computer_vision');
      } else {
        setSelectedTherapy('vision');
        setSelectedModule('computer_vision');
        setSelectedFamily(familyParam || 'tap_timing');
        setView('game');
      }
    } else if (gameParam === 'familiar_faces') {
      setFamiliarFacesLevelId(resolveFamiliarFacesLevelId(searchParams.get('variant')));
      setSelectedTherapy('vision');
      setSelectedModule('familiar_faces');
      setSelectedFamily(familyParam || 'glimpse_hold');
      setView('play_familiar_faces');
    } else if (gameParam === 'mobile_target' || (moduleParam === 'mobile_target' && modeParam)) {
      setMobileTargetConfig({
        mode: modeParam || 'alphabets',
        variant: (variantParam as AlphabetVariant) || 'uppercase',
      });
      setSelectedTherapy('vision');
      setSelectedModule('mobile_target');
      setSelectedFamily(familyParam || 'tap_timing');
      setView('play_mobile_target');
    } else if (moduleParam) {
      const catalogId = UI_MODULE_TO_CATALOG[moduleParam];
      setSelectedTherapy('vision');
      setSelectedModule(moduleParam);
      setSelectedFamily(familyParam || familyForModuleId(catalogId ?? '')?.id || null);
      setView('game');
    } else if (familyParam && isTherapyFamilyId(familyParam)) {
      setSelectedTherapy('vision');
      setSelectedFamily(familyParam);
      setSelectedModule(null);
      setView('family');
    } else if (pageParam === 'games') {
      setSelectedTherapy('vision');
      setSelectedModule(null);
      setSelectedFamily(null);
      setView('games');
    } else if (pageParam === 'analytics') {
      setSelectedTherapy('vision');
      setView('analytics');
    } else if (pageParam === 'account') {
      setSelectedTherapy('vision');
      setView('account');
    } else if (pageParam === 'settings') {
      setSelectedTherapy('vision');
      setView('settings');
    } else if (pageParam === 'history') {
      setSelectedTherapy('vision');
      setView('history');
    } else if (pageParam === 'subscription') {
      setSelectedTherapy('vision');
      setView('subscription');
    } else if (pageParam === 'help') {
      setSelectedTherapy('vision');
      setView('help');
    } else {
      setSelectedTherapy('vision');
      setSelectedModule(null);
      setSelectedFamily(null);
      setView('module');
    }
  }, [searchParams]);

  useEffect(() => {
    if (view !== 'history') return;
    const today = todayHistoryDay();
    setHistoryMonth(monthFromDayKey(today));
    setHistoryDay(today);
  }, [view]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!session) {
      router.replace('/');
      return;
    }
    if (session.user.role === 'admin') {
      router.replace('/admin');
      return;
    }
    if (session.user.role === 'doctor') {
      router.replace('/doctor');
    }
  }, [authLoading, session, router]);

  const updateQueryParams = (params: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([key, value]) => {
      if (value === null) {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });
    const queryString = newParams.toString();
    router.push(queryString ? `/dashboard?${queryString}` : '/dashboard', { scroll: false });
  };

  const familyQueryFor = (uiId: string) =>
    selectedFamily || familyForModuleId(UI_MODULE_TO_CATALOG[uiId] ?? '')?.id || null;

  const navigateToAnalytics = () => {
    setNavOpen(false);
    updateQueryParams({
      page: 'analytics',
      therapy: 'vision',
      family: null,
      module: null,
      game: null,
      mode: null,
      variant: null,
      board: null,
    });
  };

  const openWorkspace = (page: 'account' | 'settings' | 'history' | 'subscription' | 'help') => {
    setNavOpen(false);
    updateQueryParams({
      page,
      therapy: 'vision',
      family: null,
      module: null,
      game: null,
      mode: null,
      variant: null,
      board: null,
    });
  };

  const openAccount = () => openWorkspace('account');
  const openSettings = () => openWorkspace('settings');

  const openPractice = () => {
    setNavOpen(false);
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: null,
      module: null,
      game: null,
      mode: null,
      variant: null,
      board: null,
    });
  };

  const openGames = () => {
    setNavOpen(false);
    updateQueryParams({
      page: 'games',
      therapy: 'vision',
      family: null,
      module: null,
      game: null,
      mode: null,
      variant: null,
      board: null,
    });
  };

  const handleBackToModules = () => {
    updateQueryParams({
      page: 'games',
      therapy: 'vision',
      family: null,
      module: null,
      game: null,
      mode: null,
      variant: null,
      board: null,
    });
  };

  const handleBackToFamily = () => {
    if (selectedFamily) {
      updateQueryParams({
        page: null,
        therapy: 'vision',
        family: selectedFamily,
        module: null,
        game: null,
        mode: null,
        variant: null,
        board: null,
      });
      return;
    }
    handleBackToModules();
  };

  const handleSelectFamily = (id: string) => {
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: id,
      module: null,
      game: null,
      mode: null,
      variant: null,
      board: null,
    });
  };

  const handleSelectModule = (id: string) => {
    if (session?.user.role === 'patient' && !canPlayUiModule(id)) {
      return;
    }
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor(id),
      module: id,
      game: null,
      mode: null,
      variant: null,
      board: null,
    });
  };

  const handleLaunchRotatory = (mode: GameMode, variant: AlphabetVariant) => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('wheel'),
      module: 'wheel',
      game: 'rotatory',
      mode,
      variant,
    });
  };

  const handleLaunchBee = (pathType: string) => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('tracing'),
      module: 'tracing',
      game: 'bee_tracing',
      mode: null,
      variant: pathType,
      board: null,
    });
  };

  const handleLaunchPursuit = (pattern: string) => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('pursuit'),
      module: 'pursuit',
      game: 'pursuit',
      mode: null,
      variant: pattern,
      board: null,
    });
  };

  const handleLaunchSorting = (variant: SortingVariant) => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('sorting'),
      module: 'sorting',
      game: 'sorting',
      mode: null,
      variant,
    });
  };

  const handleLaunchMobileTarget = (mode: GameMode, variant: AlphabetVariant) => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('mobile_target'),
      module: 'mobile_target',
      game: 'mobile_target',
      mode,
      variant,
      board: null,
    });
  };

  const handleLaunchGeoboard = (boardId: GeoboardBoardId) => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('geoboard'),
      module: 'geoboard',
      game: 'geoboard',
      mode: null,
      variant: null,
      board: String(boardId),
    });
  };

  const handleLaunchPeripheral = (field: PeripheralField) => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('peripheral'),
      module: 'peripheral',
      game: 'peripheral_view',
      mode: null,
      variant: field,
      board: null,
    });
  };

  const handleLaunchNumberSearch = () => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('number_search'),
      module: 'number_search',
      game: 'number_search',
      mode: null,
      variant: 'standard',
      board: null,
    });
  };

  const handleLaunchPatternMatch = (levelId: string = 'standard') => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('pattern_match'),
      module: 'pattern_match',
      game: 'pattern_match',
      mode: null,
      variant: levelId,
      board: null,
    });
  };

  const handleLaunchLocationMemory = (levelId: string = 'standard') => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('location_memory'),
      module: 'location_memory',
      game: 'location_memory',
      mode: null,
      variant: levelId,
      board: null,
    });
  };

  const handleLaunchDirectionSense = (levelId: string = 'face') => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('direction_sense'),
      module: 'direction_sense',
      game: 'direction_sense',
      mode: null,
      variant: levelId,
      board: null,
    });
  };

  const handleLaunchComputerVision = (pattern: string = 'stationary') => {
    requestFullScreenSafe();
    const locked = resolveLookPursuitPattern(pattern);
    setComputerVisionPattern(locked);
    setSelectedTherapy('vision');
    setSelectedModule('computer_vision');
    setView('play_computer_vision');
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('computer_vision'),
      module: 'computer_vision',
      game: 'computer_vision',
      mode: null,
      variant: locked,
      board: null,
    });
  };

  const handleLaunchFamiliarFaces = (levelId: string = 'name_it') => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('familiar_faces'),
      module: 'familiar_faces',
      game: 'familiar_faces',
      mode: null,
      variant: levelId,
      board: null,
    });
  };

  const handleExitGame = () => {
    void loadSessions();
    if (selectedModule) {
      setView('game');
      updateQueryParams({
        page: null,
        therapy: 'vision',
        family: familyQueryFor(selectedModule),
        module: selectedModule,
        game: null,
        mode: null,
        variant: null,
        board: null,
      });
    } else {
      handleBackToFamily();
    }
  };

  const isPlayingGame = view === 'play_rotatory' || view === 'play_sorting' || view === 'play_bee_tracing' || view === 'play_pursuit' || view === 'play_mobile_target' || view === 'play_geoboard' || view === 'play_peripheral_view' || view === 'play_number_search' || view === 'play_pattern_match' || view === 'play_location_memory' || view === 'play_direction_sense' || view === 'play_computer_vision' || view === 'play_familiar_faces';
  const isChooserView = view === 'module' || view === 'games' || view === 'family' || view === 'game' || view === 'account' || view === 'settings' || view === 'history' || view === 'subscription' || view === 'help';
  const isAnalyticsView = view === 'analytics';
  const lockToViewport = isChooserView || isAnalyticsView;

  useEffect(() => {
    if (!lockToViewport && !isPlayingGame) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlHeight = html.style.height;
    const prevBodyHeight = body.style.height;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.height = '100%';
    body.style.height = '100%';
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.height = prevHtmlHeight;
      body.style.height = prevBodyHeight;
    };
  }, [lockToViewport, isPlayingGame]);

  const practiceFamilies = catalog === 'pediatric' ? PEDIATRIC_GAME_FAMILIES : GAME_FAMILIES;
  const visibleFamilies = practiceFamilies.filter((family) =>
    family.moduleIds.some((catalogId) => canPlayUiModule(CATALOG_TO_UI_MODULE[catalogId])),
  );
  const prescribedIn = (families: typeof GAME_FAMILIES) =>
    families.reduce(
      (sum, family) =>
        sum + family.moduleIds.filter((catalogId) => canPlayUiModule(CATALOG_TO_UI_MODULE[catalogId])).length,
      0,
    );
  const normalPrescribedCount = prescribedIn(GAME_FAMILIES);
  const pediatricPrescribedCount = prescribedIn(PEDIATRIC_GAME_FAMILIES);
  const activeFamily = getGameFamily(selectedFamily);
  const familyActivityCards = (activeFamily?.moduleIds ?? [])
    .map((catalogId) => MODULE_CARDS.find((card) => card.uiId === CATALOG_TO_UI_MODULE[catalogId]))
    .filter((card): card is (typeof MODULE_CARDS)[number] => Boolean(card && canPlayUiModule(card.uiId)));
  const selectedCatalogId = selectedModule ? UI_MODULE_TO_CATALOG[selectedModule] ?? '' : '';
  const selectedGameSessions = sessions.filter((row) => row.gameId === selectedCatalogId);
  const selectedGameCount = selectedGameSessions.length;
  const selectedGameAccuracy = selectedGameCount
    ? Math.round((selectedGameSessions.reduce((sum, row) => sum + (row.accuracy || 0), 0) / selectedGameCount) * 10) / 10
    : null;
  const selectedGameLast = selectedGameCount
    ? formatSessionDate(
        [...selectedGameSessions].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))[selectedGameCount - 1].recordedAt,
      )
    : '—';
  const selectedGameDuration = selectedGameSessions.reduce((sum, row) => sum + (row.durationSec || 0), 0);
  const levelAccuracy = (levelId: string | number) => {
    const rows = selectedGameSessions.filter((row) => row.levelId === String(levelId));
    if (!rows.length) return '—';
    const value = Math.round((rows.reduce((sum, row) => sum + (row.accuracy || 0), 0) / rows.length) * 10) / 10;
    return `${value}%`;
  };

  if (authLoading || !session || session.user.role !== 'patient' || !sessionsReady) {
    return <div className="h-dvh bg-page" />;
  }

  return (
    <div className={`${
      isPlayingGame
        ? 'h-dvh overflow-hidden'
        : lockToViewport
          ? 'h-dvh overflow-hidden overscroll-none flex flex-col'
          : 'min-h-dvh overflow-x-hidden flex flex-col'
    } w-full relative select-none touch-manipulation ${isPlayingGame ? 'bg-page' : 'page-wash'}`}>
      {!isPlayingGame && (
        <div className="relative z-40 shrink-0">
        <AppHeader
          leading={
            <button
              type="button"
              onClick={() => setNavOpen((open) => !open)}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 lg:hidden"
              aria-label={navOpen ? 'Close sidebar' : 'Open sidebar'}
              aria-expanded={navOpen}
            >
              <svg
                className="size-[22px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
                {navOpen ? <rect x="4" y="4" width="5" height="16" rx="1" fill="currentColor" stroke="none" /> : null}
              </svg>
            </button>
          }
          onBack={
            view === 'game'
              ? handleBackToFamily
              : view === 'family'
                ? handleBackToModules
                : view === 'games' || view === 'analytics' || view === 'account' || view === 'settings' || view === 'history' || view === 'subscription' || view === 'help'
                  ? openPractice
                  : undefined
          }
        />
        </div>
      )}

      {/* CHOOSER CONTAINER (PERSISTENT SCROLL WRAPPER) */}
      {(isChooserView || isAnalyticsView) && (
        <div className={`${CHOOSER_PANE} lg:grid lg:grid-cols-[220px_minmax(0,930px)] lg:justify-center lg:gap-[34px]`}>
          {navOpen ? (
            <button
              type="button"
              className="fixed inset-x-0 bottom-0 top-[68px] z-30 bg-slate-900/40 lg:hidden"
              aria-label="Close menu"
              onClick={() => setNavOpen(false)}
            />
          ) : null}
          <nav
            aria-label="Patient workspace"
            className={`dashboard-scrollbar fixed left-4 top-[68px] z-40 flex max-h-[calc(100dvh-81px)] w-[220px] flex-col gap-[8px] overflow-y-auto rounded-[13px] border border-gray-100 bg-white p-[13px] ${DASHBOARD_SHADOW} ${
              navOpen ? 'translate-x-0' : '-translate-x-[calc(100%+2rem)]'
            } lg:sticky lg:left-auto lg:top-4 lg:z-auto lg:flex lg:h-fit lg:max-h-[calc(100dvh-32px)] lg:w-auto lg:translate-x-0 lg:self-start`}
          >
            {(
              [
                { id: 'practice' as const, label: 'Dashboard', icon: LayoutDashboardIcon, active: view === 'module', onClick: openPractice },
                { id: 'games' as const, label: 'My games', icon: EyeIcon, active: view === 'games' || view === 'family' || view === 'game', onClick: openGames },
                { id: 'analytics' as const, label: 'Analytics', icon: AnalyticsIcon, active: view === 'analytics', onClick: navigateToAnalytics },
                { id: 'history' as const, label: 'Session history', icon: HistoryIcon, active: view === 'history', onClick: () => openWorkspace('history') },
                { id: 'subscription' as const, label: 'Subscription', icon: CreditCardIcon, active: view === 'subscription', onClick: () => openWorkspace('subscription') },
                { id: 'account' as const, label: 'Account', icon: UserIcon, active: view === 'account', onClick: openAccount },
                { id: 'settings' as const, label: 'Settings', icon: GearIcon, active: view === 'settings', onClick: openSettings },
                { id: 'help' as const, label: 'Help', icon: InfoIcon, active: view === 'help', onClick: () => openWorkspace('help') },
              ]
            ).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  aria-current={item.active ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-[8px] rounded-[8px] px-[13px] py-[13px] text-[13px] font-semibold cursor-pointer ${
                    item.active ? 'bg-gray-900 text-white' : 'bg-transparent text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                void logout().then(() => router.replace('/'));
              }}
              className="mt-[8px] flex shrink-0 cursor-pointer items-center gap-[8px] rounded-[8px] bg-transparent px-[13px] py-[13px] text-[13px] font-semibold text-red-600 hover:bg-red-100"
            >
              <LogOutIcon className="size-4 shrink-0" />
              <span>Sign out</span>
            </button>
          </nav>
          <div ref={scrollContainerRef} onScroll={handleScroll} className={CHOOSER_SCROLL}>
            {/* FAMILY SELECTION VIEW */}
            {view === 'module' && (
              <div className="mx-auto w-full max-w-[930px] px-4 py-[21px] sm:px-[34px] lg:pl-0 space-y-[34px]">
                  <h2 className="text-[21px] font-semibold text-gray-900 text-balance">Vision Therapy Dashboard</h2>

                  <DashboardSummary
                    sessions={sessions}
                    doctorName={session.patient?.doctorName}
                    doctorCode={session.patient?.referralCode}
                    onSessionsClick={() => openWorkspace('history')}
                  />
                </div>
            )}

            {view === 'games' && (
              <div className="mx-auto w-full max-w-[930px] px-4 py-[21px] sm:px-[34px] lg:pl-0 space-y-[34px]">
                  <h2 className="text-[21px] font-semibold text-gray-900 text-balance">My games</h2>

                  <div className="mx-auto flex w-full max-w-lg rounded-[13px] bg-gray-200 p-[8px]">
                    {(
                      [
                        { id: 'normal' as const, label: 'Standard games', count: normalPrescribedCount },
                        { id: 'pediatric' as const, label: 'Pediatric games', count: pediatricPrescribedCount },
                      ]
                    ).map((tab) => {
                      const active = catalog === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setCatalog(tab.id)}
                          className={`flex flex-1 items-center justify-center gap-[8px] rounded-[8px] px-[13px] py-[13px] text-[13px] font-semibold ${
                            active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                          }`}
                        >
                          <CatalogCue label={tab.label} count={tab.count} />
                        </button>
                      );
                    })}
                  </div>

                  {visibleFamilies.length > 0 ? (
                    <h3 className="text-[13px] font-semibold text-gray-700">Choose a family</h3>
                  ) : null}

                  <main className="grid content-start grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
                    {catalog === 'pediatric' && visibleFamilies.length === 0 ? (
                      <div className={`sm:col-span-2 lg:col-span-3 bg-white rounded-[13px] border border-shell-border p-[21px] text-center ${DASHBOARD_SHADOW}`}>
                        <h3 className="text-lg font-bold text-shell-ink text-balance">No pediatric games yet</h3>
                        <p className="text-[13px] text-shell-muted mt-2 text-pretty">
                          Pediatric games will appear here when they are added.
                        </p>
                        <button
                          type="button"
                          onClick={() => setCatalog('normal')}
                          className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                        >
                          Show standard games
                        </button>
                      </div>
                    ) : null}
                    {catalog === 'normal' && allowedModuleIds.size === 0 && (
                      <div className={`sm:col-span-2 lg:col-span-3 bg-white rounded-[13px] border border-shell-border p-[21px] text-center ${DASHBOARD_SHADOW}`}>
                        <h3 className="text-lg font-bold text-shell-ink text-balance">No modules prescribed yet</h3>
                        <p className="text-[13px] text-shell-muted mt-2 text-pretty">
                          Your doctor has not added any therapy modules. Check back after they prescribe one.
                        </p>
                        <button
                          type="button"
                          onClick={() => router.push('/docid')}
                          className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                        >
                          Open DocID
                        </button>
                      </div>
                    )}
                    {visibleFamilies.map((family) => {
                      const playableCount = family.moduleIds.filter((catalogId) =>
                        canPlayUiModule(CATALOG_TO_UI_MODULE[catalogId]),
                      ).length;
                      const famSessions = sessions.filter((s) =>
                        family.moduleIds.includes(s.gameId as TherapyModuleId),
                      );
                      const famLast = famSessions.length
                        ? formatSessionDate(
                            [...famSessions].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))[famSessions.length - 1]
                              .recordedAt,
                          )
                        : null;

                      return (
                        <button
                          key={family.id}
                          type="button"
                          onClick={() => handleSelectFamily(family.id)}
                          className={`group relative flex w-full cursor-pointer flex-col justify-between gap-[13px] rounded-[13px] border border-gray-200 bg-white p-[21px] text-left ${DASHBOARD_SHADOW} hover:border-gray-400`}
                        >
                          <span className="absolute -right-px -top-px z-10 rounded-bl-[8px] rounded-tr-[13px] border border-gray-200 bg-gray-50 px-[8px] py-[5px] text-[8px] leading-[13px] font-semibold tabular-nums text-gray-600 group-hover:border-gray-400">
                            {playableCount} {playableCount === 1 ? 'activity' : 'activities'}
                          </span>
                          <div>
                            <h3 className="m-0 pr-[89px] text-[21px] font-semibold leading-[34px] text-gray-900">{family.title}</h3>
                            <p className="mt-[8px] text-[13px] leading-[21px] text-gray-500 text-pretty">{family.body}</p>
                            {famLast ? (
                              <p className="mt-[13px] text-[13px] leading-[21px] text-gray-500">
                                Last played <span className="font-semibold tabular-nums text-gray-900">{famLast}</span>
                              </p>
                            ) : null}
                          </div>
                          <div className="flex justify-end">
                            <span className="inline-flex items-center gap-[8px] text-[13px] font-semibold text-blue-600">
                              Open
                              <OpenArrow />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </main>
                </div>
            )}

            {/* FAMILY ACTIVITIES VIEW */}
            {view === 'family' && activeFamily && (() => {
              const activeFamSessions = sessions.filter((s) =>
                activeFamily.moduleIds.includes(s.gameId as TherapyModuleId),
              );
              const activeFamCount = activeFamSessions.length;
              const activeFamAcc = activeFamCount
                ? Math.round((activeFamSessions.reduce((sum, s) => sum + (s.accuracy || 0), 0) / activeFamCount) * 10) / 10
                : null;
              const activeFamLast = activeFamCount
                ? formatSessionDate(
                    [...activeFamSessions].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))[activeFamCount - 1]
                      .recordedAt,
                  )
                : '—';
              const activeFamDuration = activeFamSessions.reduce((sum, s) => sum + (s.durationSec || 0), 0);

              return (
                <div className="mx-auto w-full max-w-[930px] px-4 py-[21px] sm:px-[34px] lg:pl-0 space-y-[34px]">
                  <div>
                    <h2 className="text-[21px] font-semibold text-gray-900 text-balance">{activeFamily.title}</h2>
                    <p className="mt-[8px] text-[13px] leading-[21px] text-shell-muted font-medium text-pretty">{activeFamily.body}</p>
                  </div>

                  {/* FAMILY LEVEL KPI SUMMARY CARDS */}
                  <DashboardKpiCards
                    sessionCount={activeFamCount}
                    avgAccuracy={activeFamAcc}
                    lastPlayed={activeFamLast}
                    durationSec={activeFamDuration}
                  />

                  {familyActivityCards.length > 0 ? (
                    <h3 className="text-[13px] font-semibold text-gray-700">Choose an activity</h3>
                  ) : null}

                  <main className="grid content-start grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
                    {familyActivityCards.length === 0 && (
                      <div className={`sm:col-span-2 lg:col-span-3 bg-white rounded-[13px] border border-shell-border p-[21px] text-center ${DASHBOARD_SHADOW}`}>
                        <h3 className="text-lg font-bold text-shell-ink text-balance">No activities prescribed yet</h3>
                        <p className="text-[13px] text-shell-muted mt-2 text-pretty">
                          Your doctor has not added any games in this family.
                        </p>
                        <button
                          type="button"
                          onClick={handleBackToModules}
                          className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                        >
                          Back to games
                        </button>
                      </div>
                    )}
                    {familyActivityCards.map((card) => {
                      const catId = UI_MODULE_TO_CATALOG[card.uiId] || card.uiId;
                      const modSessions = sessions.filter((s) => s.gameId === catId);
                      const modLast = modSessions.length
                        ? formatSessionDate(
                            [...modSessions].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))[modSessions.length - 1]
                              .recordedAt,
                          )
                        : null;

                      return (
                        <button
                          key={card.uiId}
                          type="button"
                          onClick={() => handleSelectModule(card.uiId)}
                          className={`flex w-full cursor-pointer flex-col justify-between gap-[13px] rounded-[13px] border border-gray-200 bg-white p-[21px] text-left ${DASHBOARD_SHADOW} hover:border-gray-400`}
                        >
                          <div>
                            <h3 className="m-0 text-[21px] font-semibold leading-[34px] text-gray-900">{card.title}</h3>
                            <p className="mt-[8px] text-[13px] leading-[21px] text-gray-500 text-pretty">{card.body}</p>
                            {modLast ? (
                              <p className="mt-[13px] text-[13px] leading-[21px] text-gray-500">
                                Last played <span className="font-semibold tabular-nums text-gray-900">{modLast}</span>
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center justify-between gap-[13px]">
                            <span className="text-[13px] leading-[21px] text-gray-500">{card.badge}</span>
                            <span className="inline-flex items-center gap-[8px] text-[13px] font-semibold text-blue-600">
                              Play
                              <OpenArrow />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </main>
                </div>
              );
            })()}

            {/* ANALYTICS PLACEHOLDER VIEW */}
            {view === 'analytics' && (
              <main className="mx-auto w-full max-w-[930px] px-[13px] py-[21px] sm:px-[34px] space-y-[34px]">
                <SessionAnalyticsPanel heading="Analytics" patientName={session?.user.name || 'you'} variant="shell" initialRows={sessions} />
              </main>
            )}

            {view === 'account' && (
              <div className="mx-auto w-full max-w-[930px] px-4 py-[21px] sm:px-[34px] lg:pl-0 space-y-[34px]">
                <h2 className="text-[21px] font-semibold text-gray-900 text-balance">Account</h2>
                <div className={`rounded-[13px] border border-gray-200 bg-white p-[21px] ${DASHBOARD_SHADOW}`}>
                  <dl className="space-y-[21px]">
                    <div>
                      <dt className="text-[13px] leading-[21px] text-gray-900">Name</dt>
                      <dd className="mt-[8px] text-[21px] font-semibold leading-none text-gray-900">{session.user.name}</dd>
                    </div>
                    <div>
                      <dt className="text-[13px] leading-[21px] text-gray-900">Email</dt>
                      <dd className="mt-[8px] text-[21px] font-semibold leading-none text-gray-900">{session.user.email}</dd>
                    </div>
                    <div>
                      <dt className="text-[13px] leading-[21px] text-gray-900">Phone</dt>
                      <dd className="mt-[8px] text-[21px] font-semibold leading-none text-gray-900">{session.user.phone || '—'}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}

            {view === 'settings' && (
              <div className="mx-auto w-full max-w-[930px] px-4 py-[21px] sm:px-[34px] lg:pl-0 space-y-[34px]">
                <div>
                  <h2 className="text-[21px] font-semibold text-gray-900 text-balance">Settings</h2>
                  <p className="mt-[8px] text-[13px] leading-[21px] text-gray-500 text-pretty">Your doctor link.</p>
                </div>
                <div className={`rounded-[13px] border border-gray-200 bg-white p-[21px] ${DASHBOARD_SHADOW}`}>
                  <LinkedDoctor name={session.patient?.doctorName} code={session.patient?.referralCode} />
                  {(() => {
                    const patient = session.patient;
                    const linked = Boolean(patient?.doctorId && patient?.referralCode);
                    const pending = Boolean(patient?.pendingDocIdRequest);
                    const copy = pending
                      ? 'A DocID request is waiting. Open it to confirm, resend, or cancel.'
                      : linked
                        ? "Enter another doctor's DocID. That doctor confirms the change."
                        : patient?.origin === 'self_signup'
                          ? "Enter a doctor's DocID to ask to join their clinic."
                          : 'Ask an administrator to transfer you to a doctor.';
                    const action = pending
                      ? 'Review request'
                      : linked
                        ? 'Request a change'
                        : patient?.origin === 'self_signup'
                          ? 'Request attach'
                          : null;
                    return (
                      <>
                        <p className={`${patient?.doctorName || patient?.referralCode ? 'mt-[21px]' : ''} text-[13px] leading-[21px] text-gray-600 text-pretty`}>{copy}</p>
                        {action && !docIdRequestOpen ? (
                          <button
                            type="button"
                            onClick={() => setDocIdRequestOpen(true)}
                            className="mt-[21px] rounded-[13px] bg-blue-600 px-[13px] py-[13px] text-[13px] font-semibold text-white"
                          >
                            {action}
                          </button>
                        ) : null}
                        {docIdRequestOpen ? <DocIdRequestCard embedded /> : null}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {view === 'history' && (() => {
              const prefix = monthPrefix(historyMonth);
              const playCounts = historyPlayCounts(sessions, historyGameId, historyLevelId);
              const playedDays = new Set(
                Array.from(playCounts.entries())
                  .filter(([day, count]) => count > 0 && day.startsWith(prefix))
                  .map(([day]) => day),
              );
              const historyRows = [...sessions]
                .filter((row) => {
                  if (historyGameId && row.gameId !== historyGameId) return false;
                  if (historyLevelId && (row.levelId ?? '') !== historyLevelId) return false;
                  return sessionDayKey(row.recordedAt) === historyDay;
                })
                .sort((a, b) => (historySort === 'asc' ? 1 : -1) * a.recordedAt.localeCompare(b.recordedAt));
              const historyLevels = levelsForTherapyModule(historyGameId);
              const monthDays = daysInHistoryMonth(historyMonth);
              const yearOptions = historyYearOptions(sessions, historyMonth.year);
              const setCursor = (next: HistoryMonth) => {
                const nextPrefix = monthPrefix(next);
                const latestInMonth = latestHistoryDay(sessions, historyGameId, historyLevelId, nextPrefix);
                setHistoryMonth(next);
                setHistoryDay(latestInMonth || `${nextPrefix}-01`);
              };

              return (
              <main className="mx-auto w-full max-w-[930px] px-[13px] py-[21px] sm:px-[34px] space-y-[34px]">
                <div className="flex flex-wrap items-center justify-between gap-x-[21px] gap-y-[13px]">
                  <h2 className="text-[21px] font-semibold text-gray-900 text-balance">Session history</h2>
                  <div className="flex flex-wrap items-center gap-[13px]">
                    <label className="flex items-center gap-[8px] text-[13px] font-semibold text-gray-500">
                      Module
                      <select
                        value={historyGameId}
                        onChange={(event) => {
                          setHistoryGameId(event.target.value);
                          setHistoryLevelId('');
                        }}
                        className={`rounded-[13px] border border-gray-200 bg-white px-[13px] py-[8px] text-[13px] font-semibold text-gray-900 ${DASHBOARD_SHADOW}`}
                      >
                        <option value="">All modules</option>
                        {ALL_MODULE_IDS.map((id) => (
                          <option key={id} value={id}>{GAME_CATALOG[id].name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-[8px] text-[13px] font-semibold text-gray-500">
                      Level
                      <select
                        value={historyLevelId}
                        onChange={(event) => setHistoryLevelId(event.target.value)}
                        disabled={!historyGameId}
                        className={`rounded-[13px] border border-gray-200 bg-white px-[13px] py-[8px] text-[13px] font-semibold text-gray-900 disabled:bg-gray-50 disabled:text-gray-400 ${DASHBOARD_SHADOW}`}
                      >
                        <option value="">{historyGameId ? 'All levels' : 'Pick a module first'}</option>
                        {historyLevels.map((level) => (
                          <option key={level.id} value={level.id}>{level.name}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => setHistorySort((current) => (current === 'desc' ? 'asc' : 'desc'))}
                      aria-label={historySort === 'desc' ? 'Sort descending' : 'Sort ascending'}
                      className={`inline-flex size-[34px] items-center justify-center rounded-[13px] border border-gray-200 bg-white text-gray-900 ${DASHBOARD_SHADOW}`}
                    >
                      <SortOrderIcon direction={historySort} className="size-[13px]" />
                    </button>
                  </div>
                </div>
                <section className="grid grid-cols-[1fr_auto_1fr] items-end gap-[13px]">
                      <HistoryMenu
                        label="Year"
                        value={String(historyMonth.year)}
                        options={yearOptions.map((year) => ({ value: String(year), label: String(year) }))}
                        onChange={(next) => setCursor({ year: Number(next), month: historyMonth.month })}
                      />
                      <p className="self-center text-[13px] font-semibold text-gray-500">
                        {historyDay ? `${historyDay.slice(8, 10)} ${HISTORY_MONTH_NAMES[historyMonth.month]} ${historyMonth.year}` : ''}
                      </p>
                      <div className="justify-self-end">
                        <HistoryMenu
                          label="Month"
                          value={String(historyMonth.month)}
                          align="right"
                          options={HISTORY_MONTH_NAMES.map((name, index) => ({ value: String(index), label: name }))}
                          onChange={(next) => setCursor({ year: historyMonth.year, month: Number(next) })}
                        />
                      </div>
                </section>
                <div className="flex gap-[13px] overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {Array.from({ length: monthDays }, (_, index) => {
                      const day = index + 1;
                      const key = historyDayKey(historyMonth, day);
                      const selected = historyDay === key;
                      const hasPlays = playedDays.has(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setHistoryDay(key)}
                          className={`flex w-[55px] shrink-0 flex-col items-center gap-[8px] rounded-[13px] border px-[8px] py-[13px] ${DASHBOARD_SHADOW} ${
                            hasPlays
                              ? selected
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : selected
                                ? 'border-gray-900 bg-gray-900 text-white'
                                : 'border-gray-200 bg-white text-gray-300'
                          }`}
                        >
                          <span className={`text-[13px] leading-none ${hasPlays && !selected ? 'text-emerald-600' : selected ? 'text-white' : 'text-gray-400'}`}>
                            {weekdayLabel(historyMonth, day)}
                          </span>
                          <span className="text-[21px] font-semibold leading-none tabular-nums">
                            {String(day).padStart(2, '0')}
                          </span>
                        </button>
                      );
                    })}
                </div>
                {sessions.length === 0 ? (
                  <div className={`rounded-[13px] border border-shell-border bg-white p-[21px] ${DASHBOARD_SHADOW}`}>
                    <p className="text-[13px] text-gray-600 text-pretty">No completed sessions yet.</p>
                  </div>
                ) : historyRows.length === 0 ? (
                  <div className={`rounded-[13px] border border-shell-border bg-white p-[21px] ${DASHBOARD_SHADOW}`}>
                    <p className="text-[13px] text-gray-600 text-pretty">
                      {historyDay ? `No sessions on ${formatSelectedHistoryDay(historyDay)}.` : 'No sessions match these filters.'}
                    </p>
                  </div>
                ) : (
                  <ul className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
                    {historyRows.map((row) => (
                      <li key={row.id} className={`rounded-[13px] border border-shell-border bg-white p-[21px] ${DASHBOARD_SHADOW}`}>
                        <div className="flex items-start justify-between gap-[21px]">
                          <p className="text-[13px] font-semibold text-gray-900">{row.gameName}</p>
                          <div className="text-right">
                            <p className="text-[21px] font-semibold leading-none tabular-nums text-gray-900">{Math.round(row.accuracy * 10) / 10}%</p>
                            <p className="mt-[8px] text-[13px] text-gray-500">{formatSessionDuration(row.durationSec)}</p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </main>
              );
            })()}

            {view === 'subscription' && (
              <div className="mx-auto w-full max-w-[930px] px-4 py-[21px] sm:px-[34px] lg:pl-0 space-y-[34px]">
                <h2 className="text-[21px] font-semibold text-gray-900 text-balance">Subscription</h2>
                <div className={`rounded-[13px] border border-gray-200 bg-white p-[21px] ${DASHBOARD_SHADOW}`}>
                  <p className="text-[13px] leading-[21px] text-gray-600 text-pretty">There is no subscription on this account yet. Billing is not set up, so this page does not show a trial, a price, or a renewal date.</p>
                </div>
              </div>
            )}

            {view === 'help' && (
              <div className="mx-auto w-full max-w-[930px] px-4 py-[21px] sm:px-[34px] lg:pl-0 space-y-[34px]">
                <div>
                  <h2 className="text-[21px] font-semibold text-gray-900 text-balance">Help</h2>
                  <p className="mt-[8px] text-[13px] leading-[21px] text-gray-500 text-pretty">How to get support.</p>
                </div>
                <div className={`rounded-[13px] border border-gray-200 bg-white p-[21px] ${DASHBOARD_SHADOW}`}>
                  <p className="text-[13px] leading-[21px] text-gray-600 text-pretty">There is no help desk in the app yet. Use Settings to open your DocID and the doctor linked to this account.</p>
                  <button
                    type="button"
                    onClick={openSettings}
                    className="mt-[21px] rounded-[13px] bg-blue-600 px-[13px] py-[13px] text-[13px] font-semibold text-white"
                  >
                    Open Settings
                  </button>
                </div>
              </div>
            )}

            {/* GAME VARIANTS VIEW */}
            {view === 'game' && selectedModule && canPlayUiModule(selectedModule) && (
              <>
          <div className="max-w-6xl mx-auto w-full px-4 sm:px-8 pt-6 pb-2">
            {activeFamily && (
              <p className="mb-1 text-sm text-gray-500">{activeFamily.title}</p>
            )}
            <h2 className="text-xl font-semibold text-gray-900 text-balance">
              {selectedModule === 'wheel' && 'Rotatory Module'}
              {selectedModule === 'sorting' && 'Sorting Module'}
              {selectedModule === 'tracing' && 'Bee Path Tracing'}
              {selectedModule === 'pursuit' && 'Pursuit Module'}
              {selectedModule === 'mobile_target' && 'Bubble Chase'}
              {selectedModule === 'geoboard' && 'Draw a Pattern'}
              {selectedModule === 'peripheral' && 'Peripheral View'}
              {selectedModule === 'number_search' && 'Crowded Search'}
              {selectedModule === 'pattern_match' && 'Hold the Code'}
              {selectedModule === 'location_memory' && 'Location Memory'}
              {selectedModule === 'direction_sense' && 'Direction Sense'}
              {selectedModule === 'computer_vision' && 'Gaze Hold'}
              {selectedModule === 'familiar_faces' && 'Familiar Faces'}
            </h2>
            <p className="text-[13px] text-shell-muted font-medium mt-1">
              {selectedModule === 'wheel' && 'Select an exercise mode to begin'}
              {selectedModule === 'sorting' && 'Select a sorting category to begin'}
              {selectedModule === 'tracing' && 'Select a path type to begin'}
              {selectedModule === 'pursuit' && 'Select a movement pattern to begin'}
              {selectedModule === 'mobile_target' && 'Select an exercise mode to begin'}
              {selectedModule === 'geoboard' && 'Select a board to begin'}
              {selectedModule === 'peripheral' && 'Select a visual field · designed for landscape'}
              {selectedModule === 'number_search' && 'Find digits in a crowded letter field'}
              {selectedModule === 'pattern_match' && 'Hold a code — tap every exact match'}
              {selectedModule === 'location_memory' && 'Explore the grid, then find each number from memory'}
              {selectedModule === 'direction_sense' && 'See a letter and a rotate arrow — pick the matching 90° turn'}
              {selectedModule === 'computer_vision' && 'Look at the still bubble and hold your gaze to pop it'}
              {selectedModule === 'familiar_faces' && 'Add family photos, then name, find, or hold a face'}
            </p>
          </div>

          <div className="max-w-6xl mx-auto w-full px-4 sm:px-8 pt-4">
            <DashboardKpiCards
              sessionCount={selectedGameCount}
              avgAccuracy={selectedGameAccuracy}
              lastPlayed={selectedGameLast}
              durationSec={selectedGameDuration}
            />
          </div>

          {selectedModule === 'wheel' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {isLevelAllowed('wheel', 'uppercase') && (
                <button type="button" className={VARIANT_TILE} onClick={() => handleLaunchRotatory('alphabets', 'uppercase')}>
                  <p className="m-0 text-lg font-semibold text-shell-ink">Uppercase Rotatory</p>
                  <p className="m-0 mt-2 text-[13px] font-semibold tabular-nums text-gray-900">{levelAccuracy('uppercase')}</p>
                </button>
              )}
              {isLevelAllowed('wheel', 'lowercase') && (
                <button type="button" className={VARIANT_TILE} onClick={() => handleLaunchRotatory('alphabets', 'lowercase')}>
                  <p className="m-0 text-lg font-semibold text-shell-ink">Lowercase Rotatory</p>
                  <p className="m-0 mt-2 text-[13px] font-semibold tabular-nums text-gray-900">{levelAccuracy('lowercase')}</p>
                </button>
              )}
              {isLevelAllowed('wheel', 'numbers') && (
                <button type="button" className={VARIANT_TILE} onClick={() => handleLaunchRotatory('numbers', 'uppercase')}>
                  <p className="m-0 text-lg font-semibold text-shell-ink">Numeric Rotatory</p>
                  <p className="m-0 mt-2 text-[13px] font-semibold tabular-nums text-gray-900">{levelAccuracy('numbers')}</p>
                </button>
              )}
              {isLevelAllowed('wheel', 'colors') && (
                <button type="button" className={VARIANT_TILE} onClick={() => handleLaunchRotatory('colors', 'uppercase')}>
                  <p className="m-0 text-lg font-semibold text-shell-ink">Color Discriminant</p>
                  <p className="m-0 mt-2 text-[13px] font-semibold tabular-nums text-gray-900">{levelAccuracy('colors')}</p>
                </button>
              )}
              {!isLevelAllowed('wheel', 'uppercase') &&
                !isLevelAllowed('wheel', 'lowercase') &&
                !isLevelAllowed('wheel', 'numbers') &&
                !isLevelAllowed('wheel', 'colors') && (
                  <div className={EMPTY_LEVELS}>
                    <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                    <p className="text-[13px] text-shell-muted mt-2">
                      Your doctor has not enabled any specific levels for this module.
                    </p>
                  </div>
                )}
            </main>
          )}

          {selectedModule === 'sorting' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {isLevelAllowed('sorting', 'uppercase') && (
                <button type="button" className={VARIANT_TILE} onClick={() => handleLaunchSorting('uppercase')}>
                  <p className="m-0 text-lg font-semibold text-shell-ink">Uppercase Alphabet Sorting</p>
                  <p className="m-0 mt-2 text-[13px] font-semibold tabular-nums text-gray-900">{levelAccuracy('uppercase')}</p>
                </button>
              )}
              {isLevelAllowed('sorting', 'lowercase') && (
                <button type="button" className={VARIANT_TILE} onClick={() => handleLaunchSorting('lowercase')}>
                  <p className="m-0 text-lg font-semibold text-shell-ink">Lowercase Alphabet Sorting</p>
                  <p className="m-0 mt-2 text-[13px] font-semibold tabular-nums text-gray-900">{levelAccuracy('lowercase')}</p>
                </button>
              )}
              {isLevelAllowed('sorting', 'numbers') && (
                <button type="button" className={VARIANT_TILE} onClick={() => handleLaunchSorting('numbers')}>
                  <p className="m-0 text-lg font-semibold text-shell-ink">Numeric Sorting</p>
                  <p className="m-0 mt-2 text-[13px] font-semibold tabular-nums text-gray-900">{levelAccuracy('numbers')}</p>
                </button>
              )}
              {!isLevelAllowed('sorting', 'uppercase') &&
                !isLevelAllowed('sorting', 'lowercase') &&
                !isLevelAllowed('sorting', 'numbers') && (
                  <div className={EMPTY_LEVELS}>
                    <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                    <p className="text-[13px] text-shell-muted mt-2">
                      Your doctor has not enabled any specific levels for this module.
                    </p>
                  </div>
                )}
            </main>
          )}

          {selectedModule === 'tracing' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {MODULE_LEVELS.bee_tracing.map((level) =>
                isLevelAllowed('tracing', level.id) ? (
                  <button type="button" key={level.id} className={VARIANT_TILE} onClick={() => handleLaunchBee(level.id)}>
                    <p className="m-0 text-lg font-semibold text-shell-ink">{level.name}</p>
                    <p className="m-0 mt-2 text-[13px] font-semibold tabular-nums text-gray-900">{levelAccuracy(level.id)}</p>
                  </button>
                ) : null,
              )}
              {MODULE_LEVELS.bee_tracing.every((level) => !isLevelAllowed('tracing', level.id)) && (
                <div className={EMPTY_LEVELS}>
                  <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                  <p className="text-[13px] text-shell-muted mt-2">
                    Your doctor has not enabled any specific levels for this module.
                  </p>
                </div>
              )}
            </main>
          )}

          {selectedModule === 'pursuit' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {MODULE_LEVELS.pursuit.map((level) =>
                isLevelAllowed('pursuit', level.id) ? (
                  <button type="button" key={level.id} className={VARIANT_TILE} onClick={() => handleLaunchPursuit(level.id)}>
                    <p className="m-0 text-lg font-semibold text-shell-ink">{level.name}</p>
                    <p className="m-0 mt-2 text-[13px] font-semibold tabular-nums text-gray-900">{levelAccuracy(level.id)}</p>
                  </button>
                ) : null,
              )}
              {MODULE_LEVELS.pursuit.every((level) => !isLevelAllowed('pursuit', level.id)) && (
                <div className={EMPTY_LEVELS}>
                  <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                  <p className="text-[13px] text-shell-muted mt-2">
                    Your doctor has not enabled any specific levels for this module.
                  </p>
                </div>
              )}
            </main>
          )}

          {selectedModule === 'mobile_target' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {isLevelAllowed('mobile_target', 'uppercase') && (
                <button type="button" className={VARIANT_TILE} onClick={() => handleLaunchMobileTarget('alphabets', 'uppercase')}>
                  <p className="m-0 text-lg font-semibold text-shell-ink">Uppercase Bubble Chase</p>
                  <p className="m-0 mt-2 text-[13px] font-semibold tabular-nums text-gray-900">{levelAccuracy('uppercase')}</p>
                </button>
              )}
              {isLevelAllowed('mobile_target', 'lowercase') && (
                <button type="button" className={VARIANT_TILE} onClick={() => handleLaunchMobileTarget('alphabets', 'lowercase')}>
                  <p className="m-0 text-lg font-semibold text-shell-ink">Lowercase Bubble Chase</p>
                  <p className="m-0 mt-2 text-[13px] font-semibold tabular-nums text-gray-900">{levelAccuracy('lowercase')}</p>
                </button>
              )}
              {isLevelAllowed('mobile_target', 'numbers') && (
                <button type="button" className={VARIANT_TILE} onClick={() => handleLaunchMobileTarget('numbers', 'uppercase')}>
                  <p className="m-0 text-lg font-semibold text-shell-ink">Numeric Bubble Chase</p>
                  <p className="m-0 mt-2 text-[13px] font-semibold tabular-nums text-gray-900">{levelAccuracy('numbers')}</p>
                </button>
              )}
              {isLevelAllowed('mobile_target', 'colors') && (
                <button type="button" className={VARIANT_TILE} onClick={() => handleLaunchMobileTarget('colors', 'uppercase')}>
                  <p className="m-0 text-lg font-semibold text-shell-ink">Color Discriminant Bubble Chase</p>
                  <p className="m-0 mt-2 text-[13px] font-semibold tabular-nums text-gray-900">{levelAccuracy('colors')}</p>
                </button>
              )}
              {!isLevelAllowed('mobile_target', 'uppercase') &&
                !isLevelAllowed('mobile_target', 'lowercase') &&
                !isLevelAllowed('mobile_target', 'numbers') &&
                !isLevelAllowed('mobile_target', 'colors') && (
                  <div className={EMPTY_LEVELS}>
                    <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                    <p className="text-[13px] text-shell-muted mt-2">
                      Your doctor has not enabled any specific levels for this module.
                    </p>
                  </div>
                )}
            </main>
          )}

          {selectedModule === 'geoboard' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {GEOBOARD_BOARD_IDS.filter((id) => isLevelAllowed('geoboard', id)).length === 0 ? (
                <div className={EMPTY_LEVELS}>
                  <h3 className="text-lg font-bold text-shell-ink">No boards assigned yet</h3>
                  <p className="text-[13px] text-shell-muted mt-2">
                    Your doctor has not enabled any specific boards for this module.
                  </p>
                </div>
              ) : (
                GEOBOARD_BOARD_IDS.filter((id) => isLevelAllowed('geoboard', id)).map((id) => (
                  <button type="button" key={id} className={VARIANT_TILE} onClick={() => handleLaunchGeoboard(id)}>
                    <p className="m-0 text-lg font-semibold text-shell-ink">{GEOBOARD_BOARDS[id].shortLabel}</p>
                    <p className="m-0 mt-2 text-[13px] font-semibold tabular-nums text-gray-900">{levelAccuracy(id)}</p>
                  </button>
                ))
              )}
            </main>
          )}

          {selectedModule === 'peripheral' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {MODULE_LEVELS.peripheral_view.map((level) =>
                isLevelAllowed('peripheral', level.id) ? (
                  <button
                    type="button"
                    key={level.id}
                    className={VARIANT_TILE}
                    onClick={() => handleLaunchPeripheral(level.id as PeripheralField)}
                  >
                    <p className="m-0 text-lg font-semibold text-shell-ink">{level.name}</p>
                    <p className="m-0 mt-2 text-[13px] font-semibold tabular-nums text-gray-900">{levelAccuracy(level.id)}</p>
                  </button>
                ) : null,
              )}
              {MODULE_LEVELS.peripheral_view.every((level) => !isLevelAllowed('peripheral', level.id)) && (
                <div className={EMPTY_LEVELS}>
                  <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                  <p className="text-[13px] text-shell-muted mt-2">
                    Your doctor has not enabled any specific levels for this module.
                  </p>
                </div>
              )}
            </main>
          )}

          {selectedModule === 'number_search' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {MODULE_LEVELS.number_search.map((level) =>
                isLevelAllowed('number_search', level.id) ? (
                  <button
                    type="button"
                    key={level.id}
                    className={VARIANT_TILE}
                    onClick={handleLaunchNumberSearch}
                  >
                    <p className="m-0 text-lg font-semibold text-shell-ink">{level.name}</p>
                    <p className="m-0 mt-2 text-[13px] font-semibold tabular-nums text-gray-900">{levelAccuracy(level.id)}</p>
                  </button>
                ) : null,
              )}
              {MODULE_LEVELS.number_search.every((level) => !isLevelAllowed('number_search', level.id)) && (
                <div className={EMPTY_LEVELS}>
                  <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                  <p className="text-[13px] text-shell-muted mt-2">
                    Your doctor has not enabled any specific levels for this module.
                  </p>
                </div>
              )}
            </main>
          )}

          {selectedModule === 'pattern_match' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {MODULE_LEVELS.pattern_match.map((level) =>
                isLevelAllowed('pattern_match', level.id) ? (
                  <button
                    type="button"
                    key={level.id}
                    className={VARIANT_TILE}
                    onClick={() => handleLaunchPatternMatch(level.id)}
                  >
                    <p className="m-0 text-lg font-semibold text-shell-ink">{level.name}</p>
                    <p className="m-0 mt-2 text-[13px] font-semibold tabular-nums text-gray-900">{levelAccuracy(level.id)}</p>
                  </button>
                ) : null,
              )}
              {MODULE_LEVELS.pattern_match.every((level) => !isLevelAllowed('pattern_match', level.id)) && (
                <div className={EMPTY_LEVELS}>
                  <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                  <p className="text-[13px] text-shell-muted mt-2">
                    Your doctor has not enabled any specific levels for this module.
                  </p>
                </div>
              )}
            </main>
          )}

          {selectedModule === 'location_memory' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {MODULE_LEVELS.location_memory.map((level) =>
                isLevelAllowed('location_memory', level.id) ? (
                  <button
                    type="button"
                    key={level.id}
                    className={VARIANT_TILE}
                    onClick={() => handleLaunchLocationMemory(level.id)}
                  >
                    <p className="m-0 text-lg font-semibold text-shell-ink">{level.name}</p>
                    <p className="m-0 mt-2 text-[13px] font-semibold tabular-nums text-gray-900">{levelAccuracy(level.id)}</p>
                  </button>
                ) : null,
              )}
              {MODULE_LEVELS.location_memory.every((level) => !isLevelAllowed('location_memory', level.id)) && (
                <div className={EMPTY_LEVELS}>
                  <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                  <p className="text-[13px] text-shell-muted mt-2">
                    Your doctor has not enabled any specific levels for this module.
                  </p>
                </div>
              )}
            </main>
          )}

          {selectedModule === 'direction_sense' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {MODULE_LEVELS.direction_sense.map((level) =>
                isLevelAllowed('direction_sense', level.id) ? (
                  <button
                    type="button"
                    key={level.id}
                    className={VARIANT_TILE}
                    onClick={() => handleLaunchDirectionSense(level.id)}
                  >
                    <p className="m-0 text-lg font-semibold text-shell-ink">{level.name}</p>
                    <p className="m-0 mt-2 text-[13px] font-semibold tabular-nums text-gray-900">{levelAccuracy(level.id)}</p>
                  </button>
                ) : null,
              )}
              {MODULE_LEVELS.direction_sense.every((level) => !isLevelAllowed('direction_sense', level.id)) && (
                <div className={EMPTY_LEVELS}>
                  <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                  <p className="text-[13px] text-shell-muted mt-2">
                    Your doctor has not enabled any specific levels for this module.
                  </p>
                </div>
              )}
            </main>
          )}

          {selectedModule === 'computer_vision' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {MODULE_LEVELS.computer_vision.map((level) =>
                isLevelAllowed('computer_vision', level.id) ? (
                  <button type="button" key={level.id} className={VARIANT_TILE} onClick={() => handleLaunchComputerVision(level.id)}>
                    <p className="m-0 text-lg font-semibold text-shell-ink">{level.name}</p>
                    <p className="m-0 mt-2 text-[13px] font-semibold tabular-nums text-gray-900">{levelAccuracy(level.id)}</p>
                  </button>
                ) : null,
              )}
              {MODULE_LEVELS.computer_vision.every((level) => !isLevelAllowed('computer_vision', level.id)) && (
                <div className={EMPTY_LEVELS}>
                  <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                  <p className="text-[13px] text-shell-muted mt-2">
                    Your doctor has not enabled any specific levels for this module.
                  </p>
                </div>
              )}
            </main>
          )}

          {selectedModule === 'familiar_faces' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {MODULE_LEVELS.familiar_faces.map((level) =>
                isLevelAllowed('familiar_faces', level.id) ? (
                  <button
                    type="button"
                    key={level.id}
                    className={VARIANT_TILE}
                    onClick={() => handleLaunchFamiliarFaces(level.id)}
                  >
                    <p className="m-0 text-lg font-semibold text-shell-ink">{level.name}</p>
                    <p className="m-0 mt-2 text-[13px] font-semibold tabular-nums text-gray-900">{levelAccuracy(level.id)}</p>
                  </button>
                ) : null,
              )}
              {MODULE_LEVELS.familiar_faces.every((level) => !isLevelAllowed('familiar_faces', level.id)) && (
                <div className={EMPTY_LEVELS}>
                  <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                  <p className="text-[13px] text-shell-muted mt-2">
                    Your doctor has not enabled any specific levels for this module.
                  </p>
                </div>
              )}
            </main>
          )}
        </>
      )}
          </div>
        </div>
      )}

      {/* GAME LAUNCHERS */}
      {view === 'play_rotatory' && canPlayUiModule('wheel') && isLevelAllowed('wheel', rotatoryConfig.mode === 'alphabets' ? rotatoryConfig.variant : rotatoryConfig.mode) && (
        <RotatoryWheelGame
          initialMode={rotatoryConfig.mode}
          initialVariant={rotatoryConfig.variant}
          onExit={handleExitGame}
        />
      )}

      {view === 'play_sorting' && canPlayUiModule('sorting') && isLevelAllowed('sorting', sortingVariant) && (
        <SortingGame variant={sortingVariant} onExit={handleExitGame} />
      )}

      {view === 'play_bee_tracing' && canPlayUiModule('tracing') && isLevelAllowed('tracing', beePathType) && (
        <BeeTracingGame initialPathType={beePathType} onExit={handleExitGame} />
      )}

      {view === 'play_pursuit' && canPlayUiModule('pursuit') && isLevelAllowed('pursuit', pursuitPattern) && (
        <PursuitGame initialMovementPattern={pursuitPattern} onExit={handleExitGame} />
      )}

      {view === 'play_mobile_target' && canPlayUiModule('mobile_target') && isLevelAllowed('mobile_target', mobileTargetConfig.mode === 'alphabets' ? mobileTargetConfig.variant : mobileTargetConfig.mode) && (
        <MobileTargetGame
          initialMode={mobileTargetConfig.mode}
          initialVariant={mobileTargetConfig.variant}
          onExit={handleExitGame}
        />
      )}

      {view === 'play_geoboard' && canPlayUiModule('geoboard') && isLevelAllowed('geoboard', geoboardBoardId) && (
        <GeoboardGame boardId={geoboardBoardId} onExit={handleExitGame} />
      )}

      {view === 'play_peripheral_view' && canPlayUiModule('peripheral') && isLevelAllowed('peripheral', peripheralField) && (
        <PeripheralViewGame field={peripheralField} onExit={handleExitGame} />
      )}

      {view === 'play_number_search' && canPlayUiModule('number_search') && isLevelAllowed('number_search', 'standard') && (
        <NumberSearchGame onExit={handleExitGame} />
      )}

      {view === 'play_pattern_match' &&
        canPlayUiModule('pattern_match') &&
        isLevelAllowed('pattern_match', patternMatchLevelId) && (
          <PatternMatchGame levelId={patternMatchLevelId} onExit={handleExitGame} />
        )}

      {view === 'play_location_memory' &&
        canPlayUiModule('location_memory') &&
        isLevelAllowed('location_memory', locationMemoryLevelId) && (
          <LocationMemoryGame levelId={locationMemoryLevelId} onExit={handleExitGame} />
        )}

      {view === 'play_direction_sense' &&
        canPlayUiModule('direction_sense') &&
        isLevelAllowed('direction_sense', directionSenseLevelId) && (
          <DirectionSenseGame levelId={directionSenseLevelId} onExit={handleExitGame} />
        )}

      {view === 'play_computer_vision' &&
        canPlayUiModule('computer_vision') &&
        isLevelAllowed('computer_vision', computerVisionPattern) && (
          <GazeHoldGame onExit={handleExitGame} />
        )}

      {view === 'play_familiar_faces' &&
        canPlayUiModule('familiar_faces') &&
        isLevelAllowed('familiar_faces', familiarFacesLevelId) && (
          <FamiliarFacesGame levelId={familiarFacesLevelId} onExit={handleExitGame} />
        )}

      {session?.user.role === 'patient' && (
        <EditPatientNameModal
          isOpen={showWelcomeModal}
          onClose={() => {
            setShowWelcomeModal(false);
            if (typeof window !== 'undefined') {
              const current = new URL(window.location.href);
              current.searchParams.delete('welcome');
              window.history.replaceState({}, '', current.pathname + (current.search ? current.search : ''));
            }
          }}
          isWelcome={true}
        />
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-lg font-semibold">Loading Kandela...</div>}>
      <MainContent />
    </Suspense>
  );
}
