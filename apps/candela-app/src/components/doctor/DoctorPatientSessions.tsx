'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ALL_MODULE_IDS,
  GAME_CATALOG,
  TRUNCATED_HISTORY_NOTE,
  isTherapyModuleId,
  levelsForTherapyModule,
  resolveStrictLocalPeriod,
  resolvedTimeZone,
  type StrictLocalPeriod,
} from '@candela/shared';
import { listPatientGameSessionOverview, type StoredGameSessionRecord } from '@/lib/api';
import { SortOrderIcon } from '@/components/icons/VectorIcons';
import { DoctorSessionList, toStored } from '@/components/shared/SessionAnalyticsPanel';
import { DoctorPeriodControls, type AnalyticsRangeChoice } from './DoctorPeriodControls';

const FIELD =
  'w-full min-w-0 rounded-[11px] border border-gray-200 bg-white px-3 py-2 text-[13px] font-semibold text-gray-900';
const CARD =
  'rounded-[13px] border border-gray-200 bg-white p-[21px] shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)]';

export function DoctorPatientSessions({ patientId, patientName }: { patientId: string; patientName: string }) {
  const timeZone = useMemo(() => resolvedTimeZone(), []);
  const [choice, setChoice] = useState<AnalyticsRangeChoice>('30d');
  const [period, setPeriod] = useState<StrictLocalPeriod>(() =>
    resolveStrictLocalPeriod({ timeZone }),
  );
  const [gameId, setGameId] = useState('');
  const [levelId, setLevelId] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [rows, setRows] = useState<StoredGameSessionRecord[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const requestKey = JSON.stringify({
    patientId,
    gameId,
    levelId,
    from: period.startInclusive,
    to: period.endExclusive,
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    listPatientGameSessionOverview(patientId, {
      gameId: gameId || undefined,
      levelId: levelId || undefined,
      from: period.startInclusive,
      to: period.endExclusive,
    })
      .then((overview) => {
        if (!cancelled) {
          setRows(overview.sessions);
          setTruncated(overview.truncated);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setTruncated(false);
          setError('Could not load session history.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, patientId, gameId, levelId, period.startInclusive, period.endExclusive]);

  const sessions = useMemo(
    () =>
      rows
        .map(toStored)
        .sort((a, b) => (sortOrder === 'desc' ? -1 : 1) * a.recordedAt.localeCompare(b.recordedAt)),
    [rows, sortOrder],
  );
  const levels = isTherapyModuleId(gameId) ? levelsForTherapyModule(gameId) : [];

  return (
    <section aria-labelledby="doctor-session-history-title" className="min-w-0 space-y-5">
      <div>
        <h2 id="doctor-session-history-title" className="text-[18px] font-semibold text-gray-900">
          Session history
        </h2>
        <p className="mt-1 text-[13px] text-gray-500">Review completed sessions for {patientName}.</p>
      </div>

      <div className={`${CARD} space-y-4`}>
        <DoctorPeriodControls
          choice={choice}
          period={period}
          onChange={(nextChoice, nextPeriod) => {
            setChoice(nextChoice);
            setPeriod(nextPeriod);
          }}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-gray-600">
            Module
            <select
              value={gameId}
              onChange={(event) => {
                setGameId(event.target.value);
                setLevelId('');
              }}
              className={FIELD}
            >
              <option value="">All modules</option>
              {ALL_MODULE_IDS.map((id) => (
                <option key={id} value={id}>
                  {GAME_CATALOG[id].name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-gray-600">
            Level
            <select
              value={levelId}
              onChange={(event) => setLevelId(event.target.value)}
              disabled={!gameId}
              className={`${FIELD} disabled:bg-gray-50 disabled:text-gray-400`}
            >
              <option value="">{gameId ? 'All levels' : 'Pick a module first'}</option>
              {levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
          <p className="text-[12px] font-medium text-gray-500">
            {loading ? 'Loading sessions…' : `${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'}`}
          </p>
          <button
            type="button"
            onClick={() => setSortOrder((current) => (current === 'desc' ? 'asc' : 'desc'))}
            aria-label={sortOrder === 'desc' ? 'Sort oldest first' : 'Sort newest first'}
            className="inline-flex size-[36px] cursor-pointer items-center justify-center rounded-[10px] border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            <SortOrderIcon direction={sortOrder} className="size-[14px]" />
          </button>
        </div>
      </div>

      {error ? (
        <div className={`${CARD} border-red-200 bg-red-50`}>
          <p className="text-[13px] text-red-700">{error}</p>
        </div>
      ) : loading ? (
        <div className="space-y-2" aria-busy="true">
          <div className={`${CARD} h-[112px] animate-pulse`} />
          <div className={`${CARD} h-[112px] animate-pulse`} />
          <div className={`${CARD} h-[112px] animate-pulse`} />
        </div>
      ) : sessions.length === 0 ? (
        <div className={CARD}>
          <p className="text-[13px] text-gray-600">
            No completed sessions match this date range and these filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {truncated ? <p className="text-[13px] text-gray-600">{TRUNCATED_HISTORY_NOTE}</p> : null}
          <DoctorSessionList rows={sessions} showMixedLevelNotice={false} showHeading={false} />
        </div>
      )}
    </section>
  );
}
