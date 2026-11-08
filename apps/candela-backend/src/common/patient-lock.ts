/** Serializes session numbers and prescription revisions for one patient. */
export const PATIENT_ADVISORY_LOCK_NS = 8713;

export const PATIENT_ADVISORY_LOCK_SQL = 'SELECT pg_advisory_xact_lock($1, hashtext($2))';
