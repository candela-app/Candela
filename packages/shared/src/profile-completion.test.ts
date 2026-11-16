import { describe, expect, it } from 'vitest';
import {
  ageFromIsoDate,
  emptyToNull,
  isFutureIsoDate,
  isIsoDateString,
  missingDoctorIdentityFields,
  missingOrganizationIdentityFields,
  missingPatientIdentityFields,
  toCompletionStatus,
} from './profile-completion';

const basePatient = {
  name: 'Pat',
  phone: '+919999999999',
  dateOfBirth: '1990-01-15',
  gender: null,
  preferredLanguage: 'en',
  city: 'Hyderabad',
  state: 'Telangana',
  country: 'IN',
  profilePhotoPath: null,
  guardianName: null,
  guardianPhone: null,
  guardianRelationship: null,
};

describe('profile-completion', () => {
  it('validates ISO dates and rejects future DOB', () => {
    expect(isIsoDateString('1990-01-15')).toBe(true);
    expect(isIsoDateString('1990-02-30')).toBe(false);
    expect(isFutureIsoDate('2999-01-01', new Date('2026-01-01'))).toBe(true);
  });

  it('requires guardian fields for minors', () => {
    const missing = missingPatientIdentityFields(
      { ...basePatient, dateOfBirth: '2015-06-01' },
      new Date('2026-01-01'),
    );
    expect(missing).toEqual(expect.arrayContaining(['guardianName', 'guardianPhone', 'guardianRelationship']));
    expect(ageFromIsoDate('2015-06-01', new Date('2026-01-01'))).toBe(10);
  });

  it('does not require guardian for adults', () => {
    expect(missingPatientIdentityFields(basePatient, new Date('2026-01-01'))).toEqual([]);
  });

  it('requires doctor professional fields including non-empty qualifications', () => {
    expect(
      missingDoctorIdentityFields({
        name: 'Doc',
        phone: '+911',
        professionalTitle: 'Dr',
        specialization: 'Optometry',
        qualifications: [],
        preferredLanguage: 'en',
        yearsExperience: null,
        externalRegistrationId: null,
        profilePhotoPath: null,
      }),
    ).toContain('qualifications');
  });

  it('requires organisation identity fields', () => {
    expect(
      missingOrganizationIdentityFields({
        name: 'H',
        contactEmail: null,
        organizationType: null,
        contactPhone: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        state: null,
        country: null,
        website: null,
        licenseNumber: null,
        logoPath: null,
      }),
    ).toEqual(
      expect.arrayContaining([
        'contactEmail',
        'organizationType',
        'contactPhone',
        'addressLine1',
        'city',
        'state',
        'country',
      ]),
    );
  });

  it('completion status requires both no missing fields and a timestamp', () => {
    expect(toCompletionStatus([], null).profileComplete).toBe(false);
    expect(toCompletionStatus([], '2026-01-01T00:00:00.000Z').profileComplete).toBe(true);
    expect(toCompletionStatus(['city'], '2026-01-01T00:00:00.000Z').profileComplete).toBe(false);
  });

  it('emptyToNull clears blank strings', () => {
    expect(emptyToNull('')).toBeNull();
    expect(emptyToNull('  ')).toBeNull();
    expect(emptyToNull('en')).toBe('en');
  });
});
