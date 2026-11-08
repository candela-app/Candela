import type { PrescriptionRevision as RevisionRecord } from '@candela/shared';
import { PrescriptionRevision } from '../entities/prescription-revision.entity';

export function revisionRecord(row: PrescriptionRevision): RevisionRecord {
  const assignments = Array.isArray(row.assignments) ? row.assignments : [];
  return {
    id: row.id,
    patientId: row.patientId,
    actorDoctorId: row.actorDoctorId ?? null,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo ? row.effectiveTo.toISOString() : null,
    assignments: assignments.map((assignment) => ({
      moduleId: assignment.moduleId,
      levels: Array.isArray(assignment.levels) ? assignment.levels.slice() : [],
    })),
  };
}
