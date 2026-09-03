import { useEffect, useState } from 'react';
import { payloadFromSessionResult, type SessionResultData } from '@candela/shared';
import { persistGameSession } from '@/lib/api';

export function useSavedSessionNumber(isOpen: boolean, data: SessionResultData | null | undefined) {
  const [sessionNumber, setSessionNumber] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'skipped'>('idle');

  useEffect(() => {
    if (!isOpen || !data) {
      setSessionNumber(null);
      setStatus('idle');
      return;
    }
    const payload = payloadFromSessionResult(data);
    if (!payload) {
      setStatus('skipped');
      return;
    }
    let cancelled = false;
    setStatus('saving');
    persistGameSession(payload)
      .then((saved) => {
        if (cancelled) return;
        setSessionNumber(saved.sessionNumber);
        setStatus('saved');
      })
      .catch(() => {
        if (cancelled) return;
        setSessionNumber(null);
        setStatus('skipped');
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, data?.clientEventId, data?.recordedAt, data?.gameName, data?.durationSec, data?.correct]);

  return { sessionNumber, status };
}
