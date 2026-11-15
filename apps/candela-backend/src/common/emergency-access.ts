import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '../entities/user.entity';

/** HTTP header for Super Admin emergency justification. */
export const EMERGENCY_REASON_HEADER = 'x-emergency-reason';

export function readEmergencyReason(req: Request | undefined): string {
  if (!req?.headers) return '';
  const raw = req.headers[EMERGENCY_REASON_HEADER] ?? req.headers['X-Emergency-Reason'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Hospital Admin / Doctor / Patient: no emergency reason required.
 * Super Admin: must supply a non-empty server-validated reason for sensitive ops.
 */
export function requireEmergencyReason(actor: User, reason: string): string {
  if (actor.role !== 'super_admin') {
    return reason.trim();
  }
  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    throw new BadRequestException(
      'An emergency intervention reason is required for this Super Admin action',
    );
  }
  if (trimmed.length > 2000) {
    throw new BadRequestException('Emergency intervention reason is too long');
  }
  return trimmed;
}
