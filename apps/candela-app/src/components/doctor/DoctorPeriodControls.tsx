'use client';

import { useState } from 'react';
import {
  insightPresetRange,
  resolveStrictLocalPeriod,
  type InsightPreset,
  type StrictLocalPeriod,
} from '@candela/shared';

export type AnalyticsRangeChoice = InsightPreset | 'custom';

interface DoctorPeriodControlsProps {
  choice: AnalyticsRangeChoice;
  period: StrictLocalPeriod;
  onChange: (nextChoice: AnalyticsRangeChoice, nextPeriod: StrictLocalPeriod) => void;
}

const PRESETS: Array<{ id: InsightPreset; label: string }> = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
];

export function formatLocalDayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return dayKey;
  const utc = new Date(Date.UTC(y, m - 1, d));
  return utc.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function DoctorPeriodControls({
  choice,
  period,
  onChange,
}: DoctorPeriodControlsProps) {
  const [customOpen, setCustomOpen] = useState(choice === 'custom');
  const [draftFrom, setDraftFrom] = useState(period.from);
  const [draftTo, setDraftTo] = useState(period.to);
  const [customError, setCustomError] = useState('');

  function handlePreset(preset: InsightPreset) {
    setCustomOpen(false);
    setCustomError('');
    const range = insightPresetRange(preset, new Date().toISOString(), period.timeZone);
    const next = resolveStrictLocalPeriod({
      from: range.from,
      to: range.to,
      timeZone: period.timeZone,
    });
    setDraftFrom(next.from);
    setDraftTo(next.to);
    onChange(preset, next);
  }

  function handleOpenCustom() {
    setCustomError('');
    setDraftFrom(period.from);
    setDraftTo(period.to);
    setCustomOpen((open) => !open);
  }

  function handleApplyCustom() {
    setCustomError('');
    try {
      const next = resolveStrictLocalPeriod({
        from: draftFrom,
        to: draftTo,
        timeZone: period.timeZone,
      });
      onChange('custom', next);
      setCustomOpen(false);
    } catch (err) {
      setCustomError(err instanceof Error ? err.message : 'Enter a valid date range.');
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-gray-900">
            {formatLocalDayLabel(period.from)} – {formatLocalDayLabel(period.to)}
          </p>
          <p className="text-[12px] text-gray-500">
            Local calendar days ({period.timeZone})
          </p>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Date range">
          {PRESETS.map((item) => {
            const active = choice === item.id && !customOpen;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handlePreset(item.id)}
                className={`cursor-pointer rounded-[11px] border px-3 py-1.5 text-[13px] font-semibold transition ${
                  active
                    ? 'border-[var(--doc-primary,#4f46e5)] bg-[var(--doc-primary,#4f46e5)] text-white'
                    : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={handleOpenCustom}
            aria-expanded={customOpen}
            className={`cursor-pointer rounded-[11px] border px-3 py-1.5 text-[13px] font-semibold transition ${
              choice === 'custom' || customOpen
                ? 'border-[var(--doc-primary,#4f46e5)] bg-[var(--doc-primary,#4f46e5)] text-white'
                : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
            }`}
          >
            Custom
          </button>
        </div>
      </div>

      {customOpen ? (
        <div className="flex flex-wrap items-end gap-3 rounded-[11px] border border-gray-200 bg-gray-50/70 p-3">
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-gray-600">
            From
            <input
              type="date"
              value={draftFrom}
              onChange={(e) => setDraftFrom(e.target.value)}
              className="rounded-[10px] border border-gray-200 bg-white px-3 py-1.5 text-[13px] text-gray-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-gray-600">
            To
            <input
              type="date"
              value={draftTo}
              onChange={(e) => setDraftTo(e.target.value)}
              className="rounded-[10px] border border-gray-200 bg-white px-3 py-1.5 text-[13px] text-gray-900"
            />
          </label>
          <button
            type="button"
            onClick={handleApplyCustom}
            disabled={!draftFrom || !draftTo}
            className="cursor-pointer rounded-[10px] bg-[var(--doc-primary,#4f46e5)] px-3.5 py-2 text-[13px] font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply
          </button>
          {customError ? (
            <p className="w-full text-[12px] font-medium text-red-600">{customError}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
