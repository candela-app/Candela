import { randomUUID } from 'crypto';
import {
  applyRevisionChange,
  revisionInstantAfter,
  type AssignmentSnapshot,
  type PrescriptionRevision,
} from '@candela/shared';

export type LivePrescriptionChange =
  | { moduleId: string; levels: string[] }
  | { moduleId: string; remove: true };

export interface PrescriptionRevisionStore {
  lock(patientId: string): Promise<void>;
  owns(patientId: string, doctorId: string): Promise<boolean>;
  listLive(patientId: string): Promise<AssignmentSnapshot[]>;
  applyLive(patientId: string, change: LivePrescriptionChange): Promise<void>;
  listRevisions(patientId: string): Promise<PrescriptionRevision[]>;
  closeRevision(id: string, effectiveTo: string): Promise<void>;
  insertRevision(revision: PrescriptionRevision): Promise<void>;
}

export function nextLiveAssignments(live: readonly AssignmentSnapshot[], change: LivePrescriptionChange): AssignmentSnapshot[] {
  const rest = live.filter((assignment) => assignment.moduleId !== change.moduleId);
  if ('remove' in change) return rest;
  return [...rest, { moduleId: change.moduleId, levels: change.levels.slice() }];
}

/**
 * Live rows and the new snapshot are written by the caller inside one transaction.
 * A thrown error must roll that transaction back.
 */
export async function commitPrescriptionRevision(
  store: PrescriptionRevisionStore,
  input: { doctorId: string; patientId: string; at: string; change: LivePrescriptionChange },
): Promise<true | null> {
  await store.lock(input.patientId);
  if (!(await store.owns(input.patientId, input.doctorId))) return null;
  const before = await store.listLive(input.patientId);
  await store.applyLive(input.patientId, input.change);
  const live = await store.listLive(input.patientId);
  const revisions = await store.listRevisions(input.patientId);
  const open = revisions.filter((revision) => revision.effectiveTo == null);
  let at = input.at;
  if (open.length === 1) {
    const bumped = revisionInstantAfter(open[0].effectiveFrom, input.at);
    if (!bumped) throw new Error('invalid_period');
    at = bumped;
  }
  const planned = applyRevisionChange(
    { revisions, live: before },
    {
      at,
      actorDoctorId: input.doctorId,
      newRevisionId: randomUUID(),
      patientId: input.patientId,
      nextLive: live,
    },
  );
  if (planned.ok === false) throw new Error(planned.reason);
  if (planned.closedId) await store.closeRevision(planned.closedId, planned.opened.effectiveFrom);
  await store.insertRevision(planned.opened);
  return true;
}
