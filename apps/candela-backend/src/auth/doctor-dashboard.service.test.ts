/**
 * Mocked repository tests for DoctorDashboardService.
 * Verifies timezone validation, local day bounds, doctor-patient org scoping, and aggregate mapping.
 */
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { Repository } from 'typeorm';
import { DocIdRequest } from '../entities/docid-request.entity';
import { DoctorOrganizationMembership } from '../entities/doctor-organization-membership.entity';
import { GameSession } from '../entities/game-session.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { Prescription } from '../entities/prescription.entity';
import { PrescriptionRevision } from '../entities/prescription-revision.entity';
import { DoctorDashboardService, resolveDashboardTimeZone } from './doctor-dashboard.service';

interface RecordedQuery {
  params: Record<string, unknown>;
  wheres: string[];
}

function makeQueryBuilder(options: { count?: number; rawMany?: unknown[] }, log: RecordedQuery[]) {
  const entry: RecordedQuery = { params: {}, wheres: [] };
  log.push(entry);
  const qb = {
    select() {
      return qb;
    },
    addSelect() {
      return qb;
    },
    where(sql: string, params?: Record<string, unknown>) {
      entry.wheres.push(sql);
      if (params) Object.assign(entry.params, params);
      return qb;
    },
    andWhere(sql: string, params?: Record<string, unknown>) {
      entry.wheres.push(sql);
      if (params) Object.assign(entry.params, params);
      return qb;
    },
    groupBy() {
      return qb;
    },
    async getCount() {
      return options.count ?? 0;
    },
    async getRawMany() {
      return options.rawMany ?? [];
    },
  };
  return qb;
}

function buildService(input: {
  patients?: PatientProfile[];
  memberships?: DoctorOrganizationMembership[];
  docidCounts?: number[];
  sessionsTodayCount?: number;
  prescriptionsUpdatedTodayCount?: number;
  lastSessions?: Array<{ patientId: string; lastRecordedAt: Date | string | null }>;
}) {
  const docidQueries: RecordedQuery[] = [];
  const sessionQueries: RecordedQuery[] = [];
  const revisionQueries: RecordedQuery[] = [];
  let docidCall = 0;

  const patients = {
    find: async () => input.patients ?? [],
  } as unknown as Repository<PatientProfile>;

  const memberships = {
    find: async () => input.memberships ?? [],
  } as unknown as Repository<DoctorOrganizationMembership>;

  const docidRequests = {
    createQueryBuilder: () => {
      const count = input.docidCounts?.[docidCall] ?? 0;
      docidCall += 1;
      return makeQueryBuilder({ count }, docidQueries);
    },
  } as unknown as Repository<DocIdRequest>;

  const sessions = {
    createQueryBuilder: () =>
      makeQueryBuilder(
        {
          count: input.sessionsTodayCount ?? 0,
          rawMany: input.lastSessions ?? [],
        },
        sessionQueries,
      ),
  } as unknown as Repository<GameSession>;

  const revisions = {
    createQueryBuilder: () =>
      makeQueryBuilder({ count: input.prescriptionsUpdatedTodayCount ?? 0 }, revisionQueries),
  } as unknown as Repository<PrescriptionRevision>;

  return {
    service: new DoctorDashboardService(patients, memberships, docidRequests, sessions, revisions),
    docidQueries,
    sessionQueries,
    revisionQueries,
  };
}

describe('resolveDashboardTimeZone', () => {
  it('defaults blank or missing timeZone to UTC', () => {
    expect(resolveDashboardTimeZone()).toBe('UTC');
    expect(resolveDashboardTimeZone('   ')).toBe('UTC');
  });

  it('accepts valid IANA time zones and rejects invalid ones', () => {
    expect(resolveDashboardTimeZone('Asia/Kolkata')).toBe('Asia/Kolkata');
    expect(() => resolveDashboardTimeZone('Mars/Olympus')).toThrow(BadRequestException);
  });
});

describe('DoctorDashboardService.getSummary', () => {
  it('scopes assigned patients by active org membership and counts distinct patients with plans', async () => {
    const p1 = {
      userId: 'patient-1',
      doctorId: 'doctor-1',
      organizationId: 'org-1',
      prescriptions: [{ moduleId: 'rotatory' }, { moduleId: 'sorting' }] as Prescription[],
    } as PatientProfile;
    const p2 = {
      userId: 'patient-2',
      doctorId: 'doctor-1',
      organizationId: 'org-1',
      prescriptions: [] as Prescription[],
    } as PatientProfile;
    // Excluded because doctor does not have active membership in org-2
    const pInactiveOrg = {
      userId: 'patient-3',
      doctorId: 'doctor-1',
      organizationId: 'org-2',
      prescriptions: [{ moduleId: 'pursuit' }] as Prescription[],
    } as PatientProfile;
    // Excluded because patient has no owning organization
    const pNoOrg = {
      userId: 'patient-4',
      doctorId: 'doctor-1',
      organizationId: null,
      prescriptions: [{ moduleId: 'pursuit' }] as Prescription[],
    } as PatientProfile;

    const { service, sessionQueries, revisionQueries } = buildService({
      patients: [p1, p2, pInactiveOrg, pNoOrg],
      memberships: [
        { doctorId: 'doctor-1', organizationId: 'org-1', membershipStatus: 'active' } as DoctorOrganizationMembership,
      ],
      docidCounts: [2, 1],
      sessionsTodayCount: 4,
      prescriptionsUpdatedTodayCount: 1,
      lastSessions: [{ patientId: 'patient-1', lastRecordedAt: '2026-09-06T19:45:00.000Z' }],
    });

    // 2026-09-06T19:30:00Z is already 2026-09-07 in Asia/Kolkata (+05:30)
    const summary = await service.getSummary(
      'doctor-1',
      'Asia/Kolkata',
      new Date('2026-09-06T19:30:00.000Z'),
    );

    expect(summary.timeZone).toBe('Asia/Kolkata');
    expect(summary.dateKey).toBe('2026-09-07');
    expect(summary.assignedPatientCount).toBe(2);
    // Patient 1 has 2 module rows, but counts as 1 patient with an active plan
    expect(summary.patientsWithActivePlansCount).toBe(1);
    expect(summary.pendingTransferCount).toBe(2);
    expect(summary.transfersReviewedTodayCount).toBe(1);
    expect(summary.sessionsTodayCount).toBe(4);
    expect(summary.prescriptionsUpdatedTodayCount).toBe(1);
    expect(summary.lastSessionAtByPatientId).toEqual({
      'patient-1': '2026-09-06T19:45:00.000Z',
      'patient-2': null,
    });

    // Verify local-day UTC interval for 2026-09-07 in Asia/Kolkata:
    // [2026-09-06T18:30:00.000Z, 2026-09-07T18:30:00.000Z)
    expect(sessionQueries[0]?.params.ids).toEqual(['patient-1', 'patient-2']);
    expect((sessionQueries[0]?.params.startDate as Date).toISOString()).toBe('2026-09-06T18:30:00.000Z');
    expect((sessionQueries[0]?.params.endExclusiveDate as Date).toISOString()).toBe(
      '2026-09-07T18:30:00.000Z',
    );
    expect(revisionQueries[0]?.params.doctorUserId).toBe('doctor-1');
    expect(revisionQueries[0]?.params.ids).toEqual(['patient-1', 'patient-2']);
  });

  it('skips session and revision queries when doctor has zero accessible patients', async () => {
    const { service, sessionQueries, revisionQueries } = buildService({
      patients: [],
      memberships: [],
      docidCounts: [3, 0],
    });

    const summary = await service.getSummary(
      'doctor-1',
      undefined,
      new Date('2026-09-06T12:00:00.000Z'),
    );

    expect(summary.timeZone).toBe('UTC');
    expect(summary.dateKey).toBe('2026-09-06');
    expect(summary.assignedPatientCount).toBe(0);
    expect(summary.patientsWithActivePlansCount).toBe(0);
    expect(summary.pendingTransferCount).toBe(3);
    expect(summary.sessionsTodayCount).toBe(0);
    expect(summary.prescriptionsUpdatedTodayCount).toBe(0);
    expect(summary.lastSessionAtByPatientId).toEqual({});
    expect(sessionQueries).toHaveLength(0);
    expect(revisionQueries).toHaveLength(0);
  });
});
