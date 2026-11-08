export type OverviewLoadStatus = 'idle' | 'loading' | 'ready' | 'failed';

export interface PracticeOverviewSnapshot<T> {
  patientId: string;
  sessions: T[];
  truncated: boolean;
  omitted: 'older' | null;
  cap: number;
}

export type HistoryOverviewAction = 'reuse' | 'wait' | 'load';

/** History reads the dashboard overview. It loads only when that overview is missing. */
export function historyOverviewAction(input: {
  open: boolean;
  patientId: string | null;
  status: OverviewLoadStatus;
  overviewPatientId: string | null;
  historyAttempted: boolean;
}): HistoryOverviewAction {
  if (!input.open || !input.patientId) return 'wait';
  if (input.status === 'loading') return 'wait';
  if (input.overviewPatientId === input.patientId) return 'reuse';
  if ((input.status === 'idle' || input.status === 'failed') && !input.historyAttempted) return 'load';
  return 'wait';
}

export function visibleOverview<T>(input: {
  patientId: string | null;
  overview: PracticeOverviewSnapshot<T> | null;
}): PracticeOverviewSnapshot<T> | null {
  if (!input.patientId || !input.overview) return null;
  if (input.overview.patientId !== input.patientId) return null;
  return input.overview;
}

export function adoptOverview<T>(input: {
  patientId: string;
  response: { sessions: T[]; truncated: boolean; omitted: 'older' | null; cap: number };
}): PracticeOverviewSnapshot<T> {
  return {
    patientId: input.patientId,
    sessions: input.response.sessions,
    truncated: input.response.truncated,
    omitted: input.response.omitted,
    cap: input.response.cap,
  };
}

/** A finished request is applied only for the request and patient that are still current. */
export function acceptOverviewResult(input: {
  requestId: number;
  activeRequestId: number;
  patientId: string;
  activePatientId: string | null;
}): boolean {
  return input.requestId === input.activeRequestId && input.patientId === input.activePatientId;
}
