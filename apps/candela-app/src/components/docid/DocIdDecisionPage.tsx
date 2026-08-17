'use client';

import { AuthShell } from '@/components/auth/AuthForm';
import { ApiError, api } from '@/lib/api';
import type { DocIdRequestPreview } from '@candela/shared';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

type Decision = 'accept' | 'reject';

function DecisionBody({ decision }: { decision: Decision }) {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState<'working' | 'ok' | 'error'>('working');
  const [title, setTitle] = useState(decision === 'accept' ? 'Confirming…' : 'Rejecting…');
  const [detail, setDetail] = useState('Please wait.');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setTitle('Missing confirmation link');
      setDetail('This page needs a valid token from your email.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await api<DocIdRequestPreview>(
          `/api/docid/requests/token/${encodeURIComponent(token)}/${decision}`,
          { method: 'POST' },
        );
        if (cancelled) {
          return;
        }
        setStatus('ok');
        if (decision === 'accept') {
          setTitle('Request confirmed');
          setDetail(
            result.source === 'internal'
              ? `You are now linked to DocID ${result.targetReferralCode}.`
              : `${result.patientName} is now linked to DocID ${result.targetReferralCode}.`,
          );
        } else {
          setTitle('Request rejected');
          setDetail('No DocID change was applied.');
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        setStatus('error');
        setTitle('Could not complete');
        setDetail(err instanceof ApiError ? err.message : 'This link is invalid or has expired.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [decision, token]);

  return (
    <AuthShell title={title} subtitle={detail}>
      {status === 'working' ? (
        <p className="text-sm text-gray-500">Working…</p>
      ) : (
        <Link href="/login" className="text-sm font-semibold text-blue-600 hover:underline">
          Continue to sign in
        </Link>
      )}
    </AuthShell>
  );
}

export function DocIdDecisionPage({ decision }: { decision: Decision }) {
  return (
    <Suspense
      fallback={
        <AuthShell title="DocID request">
          <p className="text-sm text-gray-500">Loading…</p>
        </AuthShell>
      }
    >
      <DecisionBody decision={decision} />
    </Suspense>
  );
}
