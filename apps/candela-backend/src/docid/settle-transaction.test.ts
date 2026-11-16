import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

/**
 * Concurrent-accept semantics for DocID settle: after locking the request row,
 * a non-pending status must abort without mutating patient/history.
 */
function settleAfterLock(input: {
  status: 'pending' | 'accepted' | 'rejected';
  accept: boolean;
  applyMutations: () => void;
}) {
  if (input.status !== 'pending') {
    throw new ConflictException(
      input.status === 'accepted' ? 'This request was already accepted' : 'This request was already rejected',
    );
  }
  if (!input.accept) return { status: 'rejected' as const };
  input.applyMutations();
  return { status: 'accepted' as const };
}

describe('DocID settle concurrency guard', () => {
  it('second accept on already-settled request does not re-apply patient mutations', () => {
    let patientDoctorId: string | null = 'doctor-from';
    let historyCount = 0;

    const first = settleAfterLock({
      status: 'pending',
      accept: true,
      applyMutations: () => {
        patientDoctorId = 'doctor-to';
        historyCount += 1;
      },
    });
    expect(first.status).toBe('accepted');
    expect(patientDoctorId).toBe('doctor-to');
    expect(historyCount).toBe(1);

    expect(() =>
      settleAfterLock({
        status: 'accepted',
        accept: true,
        applyMutations: () => {
          patientDoctorId = 'doctor-hijack';
          historyCount += 1;
        },
      }),
    ).toThrow(ConflictException);

    expect(patientDoctorId).toBe('doctor-to');
    expect(historyCount).toBe(1);
  });
});
