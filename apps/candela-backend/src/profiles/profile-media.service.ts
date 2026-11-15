import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import type { ProfileMediaUploadResult } from '@candela/shared';
import { assertSameOrganization } from '../common/org-scope';
import { DoctorProfile } from '../entities/doctor-profile.entity';
import { Organization } from '../entities/organization.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { User } from '../entities/user.entity';
import { SupabaseStorageService } from '../familiar-faces/supabase-storage';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

type UploadedImage = {
  buffer: Buffer;
  size: number;
  mimetype: string;
};

@Injectable()
export class ProfileMediaService {
  constructor(
    @InjectRepository(PatientProfile) private readonly patients: Repository<PatientProfile>,
    @InjectRepository(DoctorProfile) private readonly doctors: Repository<DoctorProfile>,
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    @Inject(SupabaseStorageService) private readonly storage: SupabaseStorageService,
  ) {}

  async uploadMePhoto(actor: User, file: UploadedImage | undefined): Promise<ProfileMediaUploadResult> {
    const { ext, buffer, contentType } = this.validateFile(file);
    if (actor.role === 'patient') {
      const patient = await this.patients.findOne({ where: { userId: actor.id } });
      if (!patient) throw new NotFoundException('Patient profile not found');
      const path = `patients/${actor.id}/${randomUUID()}${ext}`;
      await this.storage.uploadProfile(path, buffer, contentType);
      const previous = patient.profilePhotoPath;
      patient.profilePhotoPath = path;
      await this.patients.save(patient);
      await this.safeRemove(previous);
      return { path, url: await this.safeSignedUrl(path) };
    }
    if (actor.role === 'doctor') {
      const doctor = await this.doctors.findOne({ where: { userId: actor.id } });
      if (!doctor) throw new NotFoundException('Doctor profile not found');
      const path = `doctors/${actor.id}/${randomUUID()}${ext}`;
      await this.storage.uploadProfile(path, buffer, contentType);
      const previous = doctor.profilePhotoPath;
      doctor.profilePhotoPath = path;
      await this.doctors.save(doctor);
      await this.safeRemove(previous);
      return { path, url: await this.safeSignedUrl(path) };
    }
    throw new BadRequestException('Only patients and doctors upload personal profile photos here');
  }

  async deleteMePhoto(actor: User): Promise<{ ok: true }> {
    if (actor.role === 'patient') {
      const patient = await this.patients.findOne({ where: { userId: actor.id } });
      if (!patient) throw new NotFoundException('Patient profile not found');
      await this.safeRemove(patient.profilePhotoPath);
      patient.profilePhotoPath = null;
      await this.patients.save(patient);
      return { ok: true };
    }
    if (actor.role === 'doctor') {
      const doctor = await this.doctors.findOne({ where: { userId: actor.id } });
      if (!doctor) throw new NotFoundException('Doctor profile not found');
      await this.safeRemove(doctor.profilePhotoPath);
      doctor.profilePhotoPath = null;
      await this.doctors.save(doctor);
      return { ok: true };
    }
    throw new BadRequestException('Only patients and doctors manage personal profile photos here');
  }

  async uploadOrganizationLogo(
    actor: User,
    organizationId: string,
    file: UploadedImage | undefined,
  ): Promise<ProfileMediaUploadResult> {
    await this.assertCanWriteOrg(actor, organizationId);
    const { ext, buffer, contentType } = this.validateFile(file);
    const org = await this.orgs.findOne({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organisation not found');
    const path = `organizations/${organizationId}/${randomUUID()}${ext}`;
    await this.storage.uploadProfile(path, buffer, contentType);
    const previous = org.logoPath;
    org.logoPath = path;
    await this.orgs.save(org);
    await this.safeRemove(previous);
    return { path, url: await this.safeSignedUrl(path) };
  }

  async deleteOrganizationLogo(actor: User, organizationId: string): Promise<{ ok: true }> {
    await this.assertCanWriteOrg(actor, organizationId);
    const org = await this.orgs.findOne({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organisation not found');
    await this.safeRemove(org.logoPath);
    org.logoPath = null;
    await this.orgs.save(org);
    return { ok: true };
  }

  async signedUrlOrNull(path: string | null | undefined): Promise<string | null> {
    if (!path) return null;
    return this.safeSignedUrl(path);
  }

  private validateFile(file: UploadedImage | undefined): {
    ext: string;
    buffer: Buffer;
    contentType: string;
  } {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Choose a photo to upload');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('Photo must be 5 MB or smaller');
    }
    const ext = ALLOWED_TYPES[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Use a JPG, PNG, or WebP photo');
    }
    return { ext, buffer: file.buffer, contentType: file.mimetype };
  }

  private async assertCanWriteOrg(actor: User, organizationId: string): Promise<void> {
    if (actor.role === 'super_admin') return;
    if (actor.role === 'admin') {
      assertSameOrganization(actor, organizationId);
      return;
    }
    throw new ForbiddenException('Only organisation administrators can update logos');
  }

  private async safeRemove(path: string | null | undefined): Promise<void> {
    if (!path) return;
    try {
      await this.storage.removeProfile(path);
    } catch {
      // Best-effort cleanup; DB path already updated on replace.
    }
  }

  private async safeSignedUrl(path: string): Promise<string> {
    try {
      return await this.storage.signedProfileUrl(path);
    } catch {
      return '';
    }
  }
}
