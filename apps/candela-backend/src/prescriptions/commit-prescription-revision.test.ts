/**
 * Mocked transaction tests. They do not open a PostgreSQL connection,
 * so they do not verify the migration, rollback, or the partial unique index on a database.
 */
import { describe, expect, it } from 'vitest';
import type { AssignmentSnapshot, PrescriptionRevision } from '@candela/shared';
import { commitPrescriptionRevision, type LivePrescriptionChange, type PrescriptionRevisionStore } from './commit-prescription-revision';

const T0 = '2026-01-01T00:00:00.000Z';
const T1 = '2026-02-01T00:00:00.000Z';

interface Table {
  live: AssignmentSnapshot[];
  revisions: PrescriptionRevision[];
}

function clone(table: Table): Table {
  return {
    live: table.live.map((row) => ({ moduleId: row.moduleId, levels: row.levels.slice() })),
    revisions: table.revisions.map((row) => ({
      ...row,
      assignments: row.assignments.map((assignment) => ({ moduleId: assignment.moduleId, levels: assignment.levels.slice() })),
    })),
  };
}

function storeFor(read: Table, write: Table, calls: string[]): PrescriptionRevisionStore {
  return {
    lock: async () => {
      calls.push('lock');
    },
    owns: async (_patientId, doctorId) => doctorId === 'doctor-1',
    listLive: async () => clone(read).live,
    applyLive: async (_patientId, change: LivePrescriptionChange) => {
      calls.push('applyLive');
      const rest = write.live.filter((row) => row.moduleId !== change.moduleId);
      write.live = 'remove' in change ? rest : [...rest, { moduleId: change.moduleId, levels: change.levels.slice() }];
    },
    listRevisions: async () => clone(read).revisions,
    closeRevision: async (id, effectiveTo) => {
      calls.push('close');
      const row = write.revisions.find((item) => item.id === id);
      if (row) row.effectiveTo = effectiveTo;
    },
    insertRevision: async (revision) => {
      calls.push('insert');
      if (write.revisions.some((row) => row.effectiveTo == null)) {
        throw new Error('duplicate open revision');
      }
      write.revisions.push(revision);
    },
  };
}

async function transactional(table: Table, run: () => Promise<unknown>) {
  const snapshot = clone(table);
  try {
    return await run();
  } catch (err) {
    table.live = snapshot.live;
    table.revisions = snapshot.revisions;
    throw err;
  }
}

describe('mocked prescription transaction', () => {
  it('writes the live rows and one revision only after the patient lock', async () => {
    const table: Table = { live: [], revisions: [] };
    const calls: string[] = [];
    const result = await transactional(table, () =>
      commitPrescriptionRevision(storeFor(table, table, calls), {
        doctorId: 'doctor-1',
        patientId: 'patient-1',
        at: T0,
        change: { moduleId: 'rotatory', levels: [] },
      }),
    );
    expect(result).toBe(true);
    expect(calls).toEqual(['lock', 'applyLive', 'insert']);
    expect(table.live).toEqual([{ moduleId: 'rotatory', levels: [] }]);
    expect(table.revisions).toHaveLength(1);
    expect(table.revisions[0].assignments).toEqual([{ moduleId: 'rotatory', levels: [] }]);
    expect(table.revisions[0].effectiveTo).toBeNull();
  });

  it('does not change the live prescription when the doctor does not own the patient', async () => {
    const table: Table = { live: [], revisions: [] };
    const calls: string[] = [];
    const result = await commitPrescriptionRevision(storeFor(table, table, calls), {
      doctorId: 'other-doctor',
      patientId: 'patient-1',
      at: T0,
      change: { moduleId: 'rotatory', levels: ['uppercase'] },
    });
    expect(result).toBeNull();
    expect(calls).toEqual(['lock']);
    expect(table.live).toEqual([]);
  });

  it('rolls the mocked live rows back when the open-revision insert is rejected', async () => {
    const table: Table = {
      live: [{ moduleId: 'rotatory', levels: ['uppercase'] }],
      revisions: [
        {
          id: 'open',
          patientId: 'patient-1',
          actorDoctorId: 'doctor-1',
          effectiveFrom: T0,
          effectiveTo: null,
          assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }],
        },
      ],
    };
    const calls: string[] = [];
    const store = storeFor(table, table, calls);
    store.insertRevision = async () => {
      calls.push('insert');
      throw new Error('duplicate open revision');
    };
    await expect(
      transactional(table, () =>
        commitPrescriptionRevision(store, {
          doctorId: 'doctor-1',
          patientId: 'patient-1',
          at: T1,
          change: { moduleId: 'rotatory', remove: true },
        }),
      ),
    ).rejects.toThrow('duplicate open revision');
    expect(table.live).toEqual([{ moduleId: 'rotatory', levels: ['uppercase'] }]);
    expect(table.revisions.filter((row) => row.effectiveTo == null)).toHaveLength(1);
    expect(table.revisions).toHaveLength(1);
  });

  it('keeps one open revision when a stale second write hits the mocked uniqueness check', async () => {
    const table: Table = {
      live: [{ moduleId: 'rotatory', levels: ['uppercase'] }],
      revisions: [
        {
          id: 'open',
          patientId: 'patient-1',
          actorDoctorId: 'doctor-1',
          effectiveFrom: T0,
          effectiveTo: null,
          assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }],
        },
      ],
    };
    const stale = clone(table);
    await transactional(table, () =>
      commitPrescriptionRevision(storeFor(table, table, []), {
        doctorId: 'doctor-1',
        patientId: 'patient-1',
        at: T1,
        change: { moduleId: 'sorting', levels: ['numbers'] },
      }),
    );
    await expect(
      transactional(table, () =>
        commitPrescriptionRevision(storeFor(stale, table, []), {
          doctorId: 'doctor-1',
          patientId: 'patient-1',
          at: T1,
          change: { moduleId: 'pursuit', levels: ['linear'] },
        }),
      ),
    ).rejects.toThrow('duplicate open revision');
    expect(table.revisions.filter((row) => row.effectiveTo == null)).toHaveLength(1);
    expect(table.live.map((row) => row.moduleId).sort()).toEqual(['rotatory', 'sorting']);
  });
});
