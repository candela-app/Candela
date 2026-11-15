import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  emptyToNull,
  isDisallowedClientStoragePath,
  isE164Phone,
  isFutureIsoDate,
  isHttpsUrl,
  isIsoDateString,
  missingDoctorIdentityFields,
  missingOrganizationIdentityFields,
  missingPatientIdentityFields,
  normalizePhoneInput,
  toCompletionStatus,
  toPatientTrialStatus,
  type DoctorIdentityProfile,
  type MeProfileResponse,
  type OrganizationIdentityProfile,
  type PatientIdentityProfile,
} from '@candela/shared';
import { Repository } from 'typeorm';
import { assertSameOrganization } from '../common/org-scope';
import { DoctorProfile } from '../entities/doctor-profile.entity';
import { Organization } from '../entities/organization.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { User } from '../entities/user.entity';
import { MembershipsService } from '../memberships/memberships.service';
import { ProfileMediaService } from './profile-media.service';
import { PatchMeProfileDto, PatchOrganizationProfileDto } from './profiles.dto';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(PatientProfile) private readonly patients: Repository<PatientProfile>,
    @InjectRepository(DoctorProfile) private readonly doctors: Repository<DoctorProfile>,
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    @Inject(MembershipsService) private readonly memberships: MembershipsService,
    @Inject(ProfileMediaService) private readonly media: ProfileMediaService,
  ) {}

  async getMeProfile(actor: User): Promise<MeProfileResponse> {
    if (actor.role === 'patient') {
      return { role: 'patient', profile: await this.requirePatientProfile(actor.id) };
    }
    if (actor.role === 'doctor') {
      return { role: 'doctor', profile: await this.requireDoctorProfile(actor.id) };
    }
    if (actor.role === 'admin') {
      if (!actor.organizationId) {
        return { role: 'admin', profile: null, organizationId: null };
      }
      return {
        role: 'admin',
        organizationId: actor.organizationId,
        profile: await this.requireOrganizationProfile(actor.organizationId),
      };
    }
    return { role: 'super_admin', profile: null };
  }

  async patchMeProfile(actor: User, dto: PatchMeProfileDto): Promise<MeProfileResponse> {
    if (actor.role === 'patient') {
      await this.patchPatient(actor.id, dto);
      return this.getMeProfile(actor);
    }
    if (actor.role === 'doctor') {
      await this.patchDoctor(actor.id, dto);
      return this.getMeProfile(actor);
    }
    if (actor.role === 'admin') {
      if (!actor.organizationId) {
        throw new BadRequestException('Administrator is not assigned to an organisation');
      }
      await this.patchOrganization(actor.organizationId, dto as PatchOrganizationProfileDto);
      return this.getMeProfile(actor);
    }
    throw new ForbiddenException('Super admins update organisations via organisation profile endpoints');
  }

  /** Legacy PATCH /api/auth/profile — name only. */
  async patchLegacyName(actor: User, name: string): Promise<MeProfileResponse> {
    return this.patchMeProfile(actor, { name });
  }

  async completeMeProfile(actor: User): Promise<MeProfileResponse> {
    if (actor.role === 'patient') {
      await this.completePatient(actor.id);
      return this.getMeProfile(actor);
    }
    if (actor.role === 'doctor') {
      await this.completeDoctor(actor.id);
      return this.getMeProfile(actor);
    }
    if (actor.role === 'admin') {
      if (!actor.organizationId) {
        throw new BadRequestException('Administrator is not assigned to an organisation');
      }
      await this.completeOrganization(actor.organizationId);
      return this.getMeProfile(actor);
    }
    throw new ForbiddenException('Super admins complete organisation profiles via organisation endpoints');
  }

  async getOrganizationProfile(actor: User, organizationId: string): Promise<OrganizationIdentityProfile> {
    await this.assertCanReadOrganization(actor, organizationId);
    return this.requireOrganizationProfile(organizationId);
  }

  async patchOrganizationProfile(
    actor: User,
    organizationId: string,
    dto: PatchOrganizationProfileDto,
  ): Promise<OrganizationIdentityProfile> {
    await this.assertCanWriteOrganization(actor, organizationId);
    await this.patchOrganization(organizationId, dto);
    return this.requireOrganizationProfile(organizationId);
  }

  async completeOrganizationProfile(
    actor: User,
    organizationId: string,
  ): Promise<OrganizationIdentityProfile> {
    await this.assertCanWriteOrganization(actor, organizationId);
    await this.completeOrganization(organizationId);
    return this.requireOrganizationProfile(organizationId);
  }

  /** Assigned doctor may read patient identity; no org-wide access. */
  async getPatientProfileForDoctor(doctorUserId: string, patientId: string): Promise<PatientIdentityProfile> {
    await this.memberships.assertDoctorCanAccessPatient(doctorUserId, patientId);
    const patient = await this.patients.findOne({
      where: { userId: patientId, doctorId: doctorUserId },
      relations: ['user'],
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    return await this.toPatientView(patient);
  }

  private async patchPatient(userId: string, dto: PatchMeProfileDto): Promise<void> {
    this.rejectForbiddenPatientKeys(dto);
    this.rejectClientStoragePaths(dto);
    const patient = await this.patients.findOne({ where: { userId }, relations: ['user'] });
    if (!patient) throw new NotFoundException('Patient profile not found');
    const user = patient.user;

    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.phone !== undefined) user.phone = this.requireE164OrNull(dto.phone, 'phone');

    if (dto.dateOfBirth !== undefined) {
      const dob = emptyToNull(dto.dateOfBirth);
      if (dob && (!isIsoDateString(dob) || isFutureIsoDate(dob))) {
        throw new BadRequestException('dateOfBirth must be a real past calendar date (YYYY-MM-DD)');
      }
      patient.dateOfBirth = dob;
    }
    if (dto.gender !== undefined) patient.gender = emptyToNull(dto.gender);
    if (dto.preferredLanguage !== undefined) patient.preferredLanguage = emptyToNull(dto.preferredLanguage);
    if (dto.city !== undefined) patient.city = emptyToNull(dto.city);
    if (dto.state !== undefined) patient.state = emptyToNull(dto.state);
    if (dto.country !== undefined) {
      const c = emptyToNull(dto.country);
      patient.country = c ? c.toUpperCase() : null;
    }
    if (dto.guardianName !== undefined) patient.guardianName = emptyToNull(dto.guardianName);
    if (dto.guardianPhone !== undefined) {
      patient.guardianPhone = this.requireE164OrNull(dto.guardianPhone, 'guardianPhone');
    }
    if (dto.guardianRelationship !== undefined) {
      patient.guardianRelationship = emptyToNull(dto.guardianRelationship);
    }

    await this.users.save(user);
    patient.identityProfileCompletedAt = this.recomputePatientCompletion(patient, user);
    await this.patients.save(patient);
  }

  private async completePatient(userId: string): Promise<void> {
    const patient = await this.patients.findOne({ where: { userId }, relations: ['user'] });
    if (!patient) throw new NotFoundException('Patient profile not found');
    const missing = missingPatientIdentityFields(this.patientFields(patient, patient.user));
    if (missing.length > 0) {
      throw new BadRequestException({ message: 'Identity profile is incomplete', missingFields: missing });
    }
    patient.identityProfileCompletedAt = new Date();
    await this.patients.save(patient);
  }

  private async patchDoctor(userId: string, dto: PatchMeProfileDto): Promise<void> {
    this.rejectForbiddenDoctorKeys(dto);
    this.rejectClientStoragePaths(dto);
    const doctor = await this.doctors.findOne({ where: { userId }, relations: ['user'] });
    if (!doctor) throw new NotFoundException('Doctor profile not found');
    const user = doctor.user;

    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.phone !== undefined) user.phone = this.requireE164OrNull(dto.phone, 'phone');
    if (dto.professionalTitle !== undefined) doctor.professionalTitle = emptyToNull(dto.professionalTitle);
    if (dto.specialization !== undefined) doctor.specialization = emptyToNull(dto.specialization);
    if (dto.preferredLanguage !== undefined) doctor.preferredLanguage = emptyToNull(dto.preferredLanguage);
    if (dto.externalRegistrationId !== undefined) {
      doctor.externalRegistrationId = emptyToNull(dto.externalRegistrationId);
    }
    if (dto.yearsExperience !== undefined) {
      doctor.yearsExperience = dto.yearsExperience;
    }
    if (dto.qualifications !== undefined) {
      if (dto.qualifications === null) {
        doctor.qualifications = null;
      } else {
        doctor.qualifications = dto.qualifications.map((q) => q.trim()).filter((q) => q.length > 0);
        if (doctor.qualifications.length === 0) doctor.qualifications = null;
      }
    }

    await this.users.save(user);
    doctor.identityProfileCompletedAt = this.recomputeDoctorCompletion(doctor, user);
    await this.doctors.save(doctor);
  }

  private async completeDoctor(userId: string): Promise<void> {
    const doctor = await this.doctors.findOne({ where: { userId }, relations: ['user'] });
    if (!doctor) throw new NotFoundException('Doctor profile not found');
    const missing = missingDoctorIdentityFields(this.doctorFields(doctor, doctor.user));
    if (missing.length > 0) {
      throw new BadRequestException({ message: 'Identity profile is incomplete', missingFields: missing });
    }
    doctor.identityProfileCompletedAt = new Date();
    await this.doctors.save(doctor);
  }

  private async patchOrganization(organizationId: string, dto: PatchOrganizationProfileDto): Promise<void> {
    this.rejectClientStoragePaths(dto);
    const org = await this.orgs.findOne({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organisation not found');

    if (dto.name !== undefined) org.name = dto.name.trim();
    if (dto.contactEmail !== undefined) {
      const email = emptyToNull(dto.contactEmail);
      org.contactEmail = email ? email.toLowerCase() : null;
    }
    if (dto.organizationType !== undefined) org.organizationType = emptyToNull(dto.organizationType);
    if (dto.contactPhone !== undefined) org.contactPhone = this.requireE164OrNull(dto.contactPhone, 'contactPhone');
    if (dto.addressLine1 !== undefined) org.addressLine1 = emptyToNull(dto.addressLine1);
    if (dto.addressLine2 !== undefined) org.addressLine2 = emptyToNull(dto.addressLine2);
    if (dto.city !== undefined) org.city = emptyToNull(dto.city);
    if (dto.state !== undefined) org.state = emptyToNull(dto.state);
    if (dto.country !== undefined) {
      const c = emptyToNull(dto.country);
      org.country = c ? c.toUpperCase() : null;
    }
    if (dto.website !== undefined) {
      const website = emptyToNull(dto.website);
      if (website && !isHttpsUrl(website)) {
        throw new BadRequestException('website must be an https:// URL');
      }
      org.website = website;
    }
    if (dto.licenseNumber !== undefined) org.licenseNumber = emptyToNull(dto.licenseNumber);

    org.identityProfileCompletedAt = this.recomputeOrganizationCompletion(org);
    await this.orgs.save(org);
  }

  private async completeOrganization(organizationId: string): Promise<void> {
    const org = await this.orgs.findOne({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organisation not found');
    const missing = missingOrganizationIdentityFields(this.orgFields(org));
    if (missing.length > 0) {
      throw new BadRequestException({ message: 'Identity profile is incomplete', missingFields: missing });
    }
    org.identityProfileCompletedAt = new Date();
    await this.orgs.save(org);
  }

  private recomputePatientCompletion(patient: PatientProfile, user: User): Date | null {
    const missing = missingPatientIdentityFields(this.patientFields(patient, user));
    if (missing.length > 0) return null;
    return patient.identityProfileCompletedAt ?? null;
  }

  private recomputeDoctorCompletion(doctor: DoctorProfile, user: User): Date | null {
    const missing = missingDoctorIdentityFields(this.doctorFields(doctor, user));
    if (missing.length > 0) return null;
    return doctor.identityProfileCompletedAt ?? null;
  }

  private recomputeOrganizationCompletion(org: Organization): Date | null {
    const missing = missingOrganizationIdentityFields(this.orgFields(org));
    if (missing.length > 0) return null;
    return org.identityProfileCompletedAt ?? null;
  }

  private async requirePatientProfile(userId: string): Promise<PatientIdentityProfile> {
    const patient = await this.patients.findOne({ where: { userId }, relations: ['user'] });
    if (!patient) throw new NotFoundException('Patient profile not found');
    return await this.toPatientView(patient);
  }

  private async requireDoctorProfile(userId: string): Promise<DoctorIdentityProfile> {
    const doctor = await this.doctors.findOne({ where: { userId }, relations: ['user'] });
    if (!doctor) throw new NotFoundException('Doctor profile not found');
    return await this.toDoctorView(doctor);
  }

  private async requireOrganizationProfile(organizationId: string): Promise<OrganizationIdentityProfile> {
    const org = await this.orgs.findOne({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organisation not found');
    return await this.toOrgView(org);
  }

  private async toPatientView(patient: PatientProfile): Promise<PatientIdentityProfile> {
    const fields = this.patientFields(patient, patient.user);
    const missing = missingPatientIdentityFields(fields);
    return {
      userId: patient.userId,
      email: patient.user.email,
      origin: patient.origin,
      doctorId: patient.doctorId,
      organizationId: patient.organizationId ?? null,
      ...fields,
      profilePhotoUrl: await this.media.signedUrlOrNull(patient.profilePhotoPath),
      completion: toCompletionStatus(missing, patient.identityProfileCompletedAt),
      trial: toPatientTrialStatus(patient.trialStartedAt, patient.trialEndsAt),
    };
  }

  private async toDoctorView(doctor: DoctorProfile): Promise<DoctorIdentityProfile> {
    const fields = this.doctorFields(doctor, doctor.user);
    const missing = missingDoctorIdentityFields(fields);
    return {
      userId: doctor.userId,
      email: doctor.user.email,
      referralCode: doctor.referralCode,
      ...fields,
      profilePhotoUrl: await this.media.signedUrlOrNull(doctor.profilePhotoPath),
      completion: toCompletionStatus(missing, doctor.identityProfileCompletedAt),
    };
  }

  private async toOrgView(org: Organization): Promise<OrganizationIdentityProfile> {
    const fields = this.orgFields(org);
    const missing = missingOrganizationIdentityFields(fields);
    return {
      id: org.id,
      code: org.code,
      ...fields,
      logoUrl: await this.media.signedUrlOrNull(org.logoPath),
      completion: toCompletionStatus(missing, org.identityProfileCompletedAt),
    };
  }

  private normalizeDate(value: string | Date | null | undefined): string | null {
    if (value == null) return null;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    const trimmed = String(value).trim();
    return trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed;
  }

  private patientFields(patient: PatientProfile, user: User) {
    return {
      name: user.name,
      phone: user.phone,
      dateOfBirth: this.normalizeDate(patient.dateOfBirth),
      gender: patient.gender,
      preferredLanguage: patient.preferredLanguage,
      city: patient.city,
      state: patient.state,
      country: patient.country,
      profilePhotoPath: patient.profilePhotoPath,
      guardianName: patient.guardianName,
      guardianPhone: patient.guardianPhone,
      guardianRelationship: patient.guardianRelationship,
    };
  }

  private doctorFields(doctor: DoctorProfile, user: User) {
    return {
      name: user.name,
      phone: user.phone,
      professionalTitle: doctor.professionalTitle,
      specialization: doctor.specialization,
      qualifications: doctor.qualifications,
      preferredLanguage: doctor.preferredLanguage,
      yearsExperience: doctor.yearsExperience,
      externalRegistrationId: doctor.externalRegistrationId,
      profilePhotoPath: doctor.profilePhotoPath,
    };
  }

  private orgFields(org: Organization) {
    return {
      name: org.name,
      contactEmail: org.contactEmail,
      organizationType: org.organizationType,
      contactPhone: org.contactPhone,
      addressLine1: org.addressLine1,
      addressLine2: org.addressLine2,
      city: org.city,
      state: org.state,
      country: org.country,
      website: org.website,
      licenseNumber: org.licenseNumber,
      logoPath: org.logoPath,
    };
  }

  private rejectForbiddenPatientKeys(dto: PatchMeProfileDto): void {
    const body = dto as Record<string, unknown>;
    for (const key of ['doctorId', 'organizationId', 'origin', 'email', 'referralCode', 'userId']) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        throw new BadRequestException(`Cannot update ${key} through the identity profile endpoint`);
      }
    }
  }

  private rejectForbiddenDoctorKeys(dto: PatchMeProfileDto): void {
    const body = dto as Record<string, unknown>;
    for (const key of ['referralCode', 'docId', 'docid', 'userId', 'email']) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        throw new BadRequestException(`Cannot update ${key} through the identity profile endpoint`);
      }
    }
  }

  private rejectClientStoragePaths(dto: object): void {
    const body = dto as Record<string, unknown>;
    for (const key of ['profilePhotoPath', 'logoPath']) {
      if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
      const value = body[key];
      if (value === null || value === undefined || value === '') continue;
      if (typeof value === 'string' && isDisallowedClientStoragePath(value)) {
        throw new BadRequestException(
          `${key} cannot be set directly. Upload via the authorised profile-photo flow.`,
        );
      }
    }
  }

  private requireE164OrNull(value: string | null, field: string): string | null {
    const normalized = normalizePhoneInput(value);
    if (normalized == null) return null;
    if (!isE164Phone(normalized)) {
      throw new BadRequestException(`${field} must be an E.164 number (e.g. +919876543210)`);
    }
    return normalized;
  }

  private async assertCanReadOrganization(actor: User, organizationId: string): Promise<void> {
    if (actor.role === 'super_admin') return;
    if (actor.role === 'admin') {
      assertSameOrganization(actor, organizationId);
      return;
    }
    if (actor.role === 'doctor') {
      await this.memberships.assertActiveMembership(actor.id, organizationId);
      return;
    }
    throw new ForbiddenException('You cannot view this organisation profile');
  }

  private async assertCanWriteOrganization(actor: User, organizationId: string): Promise<void> {
    if (actor.role === 'super_admin') return;
    if (actor.role === 'admin') {
      assertSameOrganization(actor, organizationId);
      return;
    }
    throw new ForbiddenException('Only organisation administrators can update this profile');
  }
}
