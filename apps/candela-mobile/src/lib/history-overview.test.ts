import { describe, expect, it } from 'vitest';
import {
  acceptOverviewResult,
  adoptOverview,
  historyOverviewAction,
  visibleOverview,
} from './history-overview';

const overview = adoptOverview({
  patientId: 'patient-1',
  response: {
    sessions: [{ id: 's1' }],
    truncated: true,
    omitted: 'older' as const,
    cap: 2000,
  },
});

describe('mobile history overview reuse', () => {
  it('reuses a ready overview for the same patient', () => {
    expect(
      historyOverviewAction({
        open: true,
        patientId: 'patient-1',
        status: 'ready',
        overviewPatientId: 'patient-1',
        historyAttempted: false,
      }),
    ).toBe('reuse');
  });

  it('does not request while the dashboard load is in flight', () => {
    expect(
      historyOverviewAction({
        open: true,
        patientId: 'patient-1',
        status: 'loading',
        overviewPatientId: null,
        historyAttempted: false,
      }),
    ).toBe('wait');
  });

  it('loads once when the dashboard load failed', () => {
    expect(
      historyOverviewAction({
        open: true,
        patientId: 'patient-1',
        status: 'failed',
        overviewPatientId: null,
        historyAttempted: false,
      }),
    ).toBe('load');
    expect(
      historyOverviewAction({
        open: true,
        patientId: 'patient-1',
        status: 'failed',
        overviewPatientId: null,
        historyAttempted: true,
      }),
    ).toBe('wait');
  });

  it('does not reuse another patient overview', () => {
    expect(visibleOverview({ patientId: 'patient-2', overview })).toBeNull();
    expect(
      historyOverviewAction({
        open: true,
        patientId: 'patient-2',
        status: 'ready',
        overviewPatientId: 'patient-1',
        historyAttempted: false,
      }),
    ).toBe('wait');
  });

  it('keeps truncation metadata on the adopted overview', () => {
    expect(visibleOverview({ patientId: 'patient-1', overview })).toEqual(overview);
    expect(overview.truncated).toBe(true);
    expect(overview.omitted).toBe('older');
    expect(overview.cap).toBe(2000);
    expect(overview.sessions).toEqual([{ id: 's1' }]);
  });

  it('rejects a stale response after a newer request or patient change', () => {
    expect(
      acceptOverviewResult({ requestId: 1, activeRequestId: 2, patientId: 'patient-1', activePatientId: 'patient-1' }),
    ).toBe(false);
    expect(
      acceptOverviewResult({ requestId: 2, activeRequestId: 2, patientId: 'patient-1', activePatientId: 'patient-2' }),
    ).toBe(false);
    expect(
      acceptOverviewResult({ requestId: 2, activeRequestId: 2, patientId: 'patient-2', activePatientId: 'patient-2' }),
    ).toBe(true);
  });
});
