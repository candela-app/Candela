import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ORGANIZATION_SCOPE_HEADER } from '@candela/shared';
import type { Request } from 'express';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Read X-Organization-Id from a Nest request. Returns null if absent. */
export function readOrganizationScopeHeader(req: Request): string | null {
  const raw = req.headers[ORGANIZATION_SCOPE_HEADER] ?? req.headers['X-Organization-Id'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value == null || String(value).trim() === '') {
    return null;
  }
  const id = String(value).trim();
  if (!UUID_RE.test(id)) {
    throw new BadRequestException(`Invalid ${ORGANIZATION_SCOPE_HEADER} header`);
  }
  return id;
}

export function requireOrganizationScopeHeader(req: Request): string {
  const id = readOrganizationScopeHeader(req);
  if (!id) {
    throw new BadRequestException(`Missing ${ORGANIZATION_SCOPE_HEADER} header`);
  }
  return id;
}

export function assertOrganizationHeaderMatches(
  headerOrgId: string | null,
  expectedOrgId: string,
  message = 'X-Organization-Id does not match the target organisation',
): void {
  if (!headerOrgId) {
    throw new BadRequestException(`Missing ${ORGANIZATION_SCOPE_HEADER} header`);
  }
  if (headerOrgId !== expectedOrgId) {
    throw new ForbiddenException(message);
  }
}
