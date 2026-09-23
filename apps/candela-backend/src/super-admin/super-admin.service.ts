import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import bcrypt from 'bcrypt';
import { Organization } from '../entities/organization.entity';
import { User } from '../entities/user.entity';
import { DoctorProfile } from '../entities/doctor-profile.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { GameSession } from '../entities/game-session.entity';
import { CreateOrganizationDto } from '../auth/dto';
import type {
  OrganizationSummary,
  SelfUserSummary,
  SuperAdminMetrics,
} from '@candela/shared';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class SuperAdminService {
  constructor(
    @InjectRepository(Organization)
    private readonly orgs: Repository<Organization>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(DoctorProfile)
    private readonly doctors: Repository<DoctorProfile>,
    @InjectRepository(PatientProfile)
    private readonly patients: Repository<PatientProfile>,
    @InjectRepository(GameSession)
    private readonly sessions: Repository<GameSession>,
  ) {}

  async listOrganizations(): Promise<OrganizationSummary[]> {
    const allOrgs = await this.orgs.find({
      order: { createdAt: 'ASC' },
      relations: ['users'],
    });

    const summaries: OrganizationSummary[] = [];

    for (const org of allOrgs) {
      const orgUsers = await this.users.find({ where: { organizationId: org.id } });
      const admin = orgUsers.find((u) => u.role === 'admin');
      const doctorUsers = orgUsers.filter((u) => u.role === 'doctor');
      const doctorUserIds = doctorUsers.map((d) => d.id);

      let patientCount = 0;
      if (doctorUserIds.length > 0) {
        patientCount = await this.patients
          .createQueryBuilder('patient')
          .where('patient.doctorId IN (:...doctorUserIds)', { doctorUserIds })
          .getCount();
      }

      summaries.push({
        id: org.id,
        name: org.name,
        code: org.code,
        contactEmail: org.contactEmail,
        adminName: admin ? admin.name : null,
        adminEmail: admin ? admin.email : null,
        doctorCount: doctorUsers.length,
        patientCount,
        createdAt: org.createdAt.toISOString(),
      });
    }

    return summaries;
  }

  async createOrganization(dto: CreateOrganizationDto): Promise<OrganizationSummary> {
    const code = dto.code.trim().toUpperCase();
    const existingCode = await this.orgs.findOne({ where: { code } });
    if (existingCode) {
      throw new ConflictException('An organization with this code already exists');
    }

    const email = dto.contactEmail.trim().toLowerCase();
    const existingAdmin = await this.users.findOne({ where: { email } });
    if (existingAdmin) {
      throw new ConflictException('An account with this email already exists');
    }

    const org = await this.orgs.save(
      this.orgs.create({
        name: dto.name.trim(),
        code,
        contactEmail: email,
      }),
    );

    const passwordHash = await bcrypt.hash(dto.adminPassword, BCRYPT_ROUNDS);
    const admin = await this.users.save(
      this.users.create({
        email,
        passwordHash,
        name: dto.adminName.trim(),
        phone: dto.adminPhone?.trim() || '0000000000',
        role: 'admin',
        organizationId: org.id,
      }),
    );

    return {
      id: org.id,
      name: org.name,
      code: org.code,
      contactEmail: org.contactEmail,
      adminName: admin.name,
      adminEmail: admin.email,
      doctorCount: 0,
      patientCount: 0,
      createdAt: org.createdAt.toISOString(),
    };
  }

  async listSelfUsers(): Promise<SelfUserSummary[]> {
    const selfPatients = await this.patients.find({
      where: { origin: 'self_signup', doctorId: IsNull() },
      relations: ['user'],
    });

    const summaries: SelfUserSummary[] = [];

    for (const p of selfPatients) {
      if (!p.user) continue;
      const sessionCount = await this.sessions.count({ where: { patientId: p.userId } });
      summaries.push({
        id: p.userId,
        name: p.user.name,
        email: p.user.email,
        phone: p.user.phone,
        createdAt: p.user.createdAt.toISOString(),
        sessionCount,
      });
    }

    return summaries;
  }

  async getMetrics(): Promise<SuperAdminMetrics> {
    const totalOrganizations = await this.orgs.count();
    const totalDoctors = await this.users.count({ where: { role: 'doctor' } });
    const totalSelfPatients = await this.patients.count({
      where: { origin: 'self_signup', doctorId: IsNull() },
    });
    const totalAllPatients = await this.patients.count();
    const totalOrgPatients = Math.max(0, totalAllPatients - totalSelfPatients);

    return {
      totalOrganizations,
      totalDoctors,
      totalOrgPatients,
      totalSelfPatients,
    };
  }
}
