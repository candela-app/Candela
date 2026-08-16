import { createHash, randomBytes } from 'crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { Response } from 'express';
import { Repository } from 'typeorm';
import { ALL_MODULE_IDS } from '../common/catalog';
import { ACCESS_MAX_AGE_SEC, clearAuthCookies, REFRESH_COOKIE, REFRESH_MAX_AGE_SEC, setAuthCookies } from '../common/cookies';
import { generateReferralCode } from '../common/referral-code';
import { DoctorProfile } from '../entities/doctor-profile.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { Prescription } from '../entities/prescription.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { User } from '../entities/user.entity';
import { CreateAccountDto, LoginDto, SignupDto, UpdateDoctorDto } from './dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(DoctorProfile) private readonly doctors: Repository<DoctorProfile>,
    @InjectRepository(PatientProfile) private readonly patients: Repository<PatientProfile>,
    @InjectRepository(Prescription) private readonly prescriptions: Repository<Prescription>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedAdmin();
  }

  private async seedAdmin(): Promise<void> {
    const admins = [
      { email: 'sai@candela.com', password: 'sai123$', name: 'Sai' },
      { email: 'satvik@candela.com', password: 'satvik123$', name: 'Satvik' },
    ];
    for (const admin of admins) {
      const email = admin.email.trim().toLowerCase();
      const existing = await this.users.findOne({ where: { email } });
      if (existing) {
        continue;
      }
      const passwordHash = await bcrypt.hash(admin.password, BCRYPT_ROUNDS);
      await this.users.save(
        this.users.create({
          email,
          passwordHash,
          name: admin.name,
          phone: '0000000000',
          role: 'admin',
        }),
      );
      console.log(`Seeded admin account for ${email}`);
    }
  }

  async signup(dto: SignupDto, res: Response) {
    const user = await this.createUser({
      ...dto,
      role: 'patient',
    });
    await this.patients.save(
      this.patients.create({
        userId: user.id,
        doctorId: null,
        origin: 'self_signup',
      }),
    );
    return this.issueSession(user, res);
  }

  async login(dto: LoginDto, res: Response) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.users.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueSession(user, res);
  }

  async refresh(refreshToken: string | undefined, res: Response) {
    if (!refreshToken) {
      throw new UnauthorizedException('Not signed in');
    }
    const tokenHash = hashToken(refreshToken);
    const stored = await this.refreshTokens.findOne({
      where: { tokenHash },
      relations: ['user'],
    });
    if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
      clearAuthCookies(res);
      throw new UnauthorizedException('Session expired');
    }
    stored.revokedAt = new Date();
    await this.refreshTokens.save(stored);
    return this.issueSession(stored.user, res);
  }

  async logout(refreshToken: string | undefined, res: Response) {
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await this.refreshTokens.update({ tokenHash }, { revokedAt: new Date() });
    }
    clearAuthCookies(res);
    return { ok: true };
  }

  async getSession(user: User) {
    return this.toSession(user);
  }

  async createDoctor(dto: CreateAccountDto) {
    const user = await this.createUser({ ...dto, role: 'doctor' });
    const referralCode = await this.uniqueReferralCode();
    await this.doctors.save(
      this.doctors.create({
        userId: user.id,
        referralCode,
      }),
    );
    return {
      ...this.toPublicUser(user),
      referralCode,
    };
  }

  async createDoctorPatient(doctorUserId: string, dto: CreateAccountDto) {
    const doctor = await this.doctors.findOne({ where: { userId: doctorUserId } });
    if (!doctor) {
      throw new UnauthorizedException('Doctor profile not found');
    }
    const user = await this.createUser({ ...dto, role: 'patient' });
    await this.patients.save(
      this.patients.create({
        userId: user.id,
        doctorId: doctor.userId,
        origin: 'doctor_created',
      }),
    );
    return this.toPatientSummary(user.id);
  }

  async listDoctors() {
    const doctors = await this.doctors.find({
      relations: ['user'],
      order: { referralCode: 'ASC' },
    });
    return doctors.map((d) => ({
      ...this.toPublicUser(d.user),
      referralCode: d.referralCode,
    }));
  }

  async updateDoctor(doctorUserId: string, dto: UpdateDoctorDto) {
    const user = await this.users.findOne({ where: { id: doctorUserId } });
    if (!user || user.role !== 'doctor') {
      throw new NotFoundException('Doctor not found');
    }
    const doctorProfile = await this.doctors.findOne({ where: { userId: doctorUserId } });
    if (!doctorProfile) {
      throw new NotFoundException('Doctor profile not found');
    }

    if (dto.email) {
      const email = dto.email.trim().toLowerCase();
      if (email !== user.email) {
        const existing = await this.users.findOne({ where: { email } });
        if (existing) {
          throw new ConflictException('Email already in use');
        }
        user.email = email;
      }
    }
    if (dto.name !== undefined) {
      user.name = dto.name.trim();
    }
    if (dto.phone !== undefined) {
      user.phone = dto.phone.trim();
    }
    if (dto.password && dto.password.length >= 8) {
      user.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    }
    await this.users.save(user);

    return {
      ...this.toPublicUser(user),
      referralCode: doctorProfile.referralCode,
    };
  }

  async deleteDoctor(doctorUserId: string) {
    const user = await this.users.findOne({ where: { id: doctorUserId } });
    if (!user || user.role !== 'doctor') {
      throw new NotFoundException('Doctor not found');
    }
    await this.refreshTokens.delete({ userId: doctorUserId });
    await this.patients.update({ doctorId: doctorUserId }, { doctorId: null });
    await this.doctors.delete({ userId: doctorUserId });
    await this.users.delete({ id: doctorUserId });

    return { success: true, id: doctorUserId };
  }

  async listAllPatients() {
    const patients = await this.patients.find({
      relations: ['user', 'doctor', 'doctor.user', 'prescriptions'],
      order: { origin: 'ASC' },
    });
    return patients.map((p) => this.patientToSummary(p));
  }

  async listDoctorPatients(doctorUserId: string) {
    const patients = await this.patients.find({
      where: { doctorId: doctorUserId },
      relations: ['user', 'doctor', 'doctor.user', 'prescriptions'],
    });
    return patients.map((p) => this.patientToSummary(p));
  }

  async getOwnedPatient(doctorUserId: string, patientId: string) {
    const patient = await this.patients.findOne({
      where: { userId: patientId, doctorId: doctorUserId },
      relations: ['user', 'doctor', 'doctor.user', 'prescriptions'],
    });
    if (!patient) {
      return null;
    }
    return this.patientToSummary(patient);
  }

  async addPrescription(doctorUserId: string, patientId: string, moduleId: string, levels: string[] = []) {
    const patient = await this.patients.findOne({
      where: { userId: patientId, doctorId: doctorUserId },
    });
    if (!patient) {
      return null;
    }
    const existing = await this.prescriptions.findOne({
      where: { patientId, moduleId },
    });
    if (!existing) {
      await this.prescriptions.save(this.prescriptions.create({ patientId, moduleId, levels }));
    } else {
      existing.levels = levels;
      await this.prescriptions.save(existing);
    }
    return this.getOwnedPatient(doctorUserId, patientId);
  }

  async removePrescription(doctorUserId: string, patientId: string, moduleId: string) {
    const patient = await this.patients.findOne({
      where: { userId: patientId, doctorId: doctorUserId },
    });
    if (!patient) {
      return null;
    }
    await this.prescriptions.delete({ patientId, moduleId });
    return this.getOwnedPatient(doctorUserId, patientId);
  }

  private async createUser(input: {
    name: string;
    phone: string;
    email: string;
    password: string;
    role: User['role'];
  }): Promise<User> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    return this.users.save(
      this.users.create({
        email,
        passwordHash,
        name: input.name.trim(),
        phone: input.phone.trim(),
        role: input.role,
      }),
    );
  }

  private async uniqueReferralCode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const code = generateReferralCode();
      const taken = await this.doctors.findOne({ where: { referralCode: code } });
      if (!taken) {
        return code;
      }
    }
    throw new ConflictException('Could not allocate a unique referral code');
  }

  private async issueSession(user: User, res: Response) {
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, role: user.role, email: user.email },
      { expiresIn: ACCESS_MAX_AGE_SEC },
    );
    const refreshToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_MAX_AGE_SEC * 1000);
    await this.refreshTokens.save(
      this.refreshTokens.create({
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt,
        revokedAt: null,
      }),
    );
    setAuthCookies(res, accessToken, refreshToken);
    return {
      ...(await this.toSession(user)),
      accessToken,
      refreshToken,
    };
  }

  async toSession(user: User) {
    const publicUser = this.toPublicUser(user);
    if (user.role === 'doctor') {
      const doctor = await this.doctors.findOne({ where: { userId: user.id } });
      return {
        user: publicUser,
        doctor: doctor ? { referralCode: doctor.referralCode } : null,
        patient: null,
        allowedModuleIds: [] as string[],
      };
    }
    if (user.role === 'patient') {
      const patient = await this.patients.findOne({
        where: { userId: user.id },
        relations: ['doctor', 'prescriptions'],
      });
      const prescribed = patient?.prescriptions.map((p) => p.moduleId) ?? [];
      const prescribedLevels = patient?.prescriptions.reduce((acc, p) => {
        acc[p.moduleId] = p.levels || [];
        return acc;
      }, {} as Record<string, string[]>) ?? {};
      const allowedModuleIds =
        patient?.origin === 'self_signup' || !patient?.doctorId ? [...ALL_MODULE_IDS] : prescribed;
      return {
        user: publicUser,
        doctor: null,
        patient: patient
          ? {
              origin: patient.origin,
              doctorId: patient.doctorId,
              referralCode: patient.doctor?.referralCode ?? null,
              prescribedModuleIds: prescribed,
              prescribedLevels,
            }
          : null,
        allowedModuleIds,
      };
    }
    return {
      user: publicUser,
      doctor: null,
      patient: null,
      allowedModuleIds: [] as string[],
    };
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
    };
  }

  private async toPatientSummary(patientId: string) {
    const patient = await this.patients.findOne({
      where: { userId: patientId },
      relations: ['user', 'doctor', 'doctor.user', 'prescriptions'],
    });
    if (!patient) {
      return null;
    }
    return this.patientToSummary(patient);
  }

  private patientToSummary(patient: PatientProfile) {
    const prescribedLevels = patient.prescriptions?.reduce((acc, p) => {
      acc[p.moduleId] = p.levels || [];
      return acc;
    }, {} as Record<string, string[]>) ?? {};

    return {
      ...this.toPublicUser(patient.user),
      origin: patient.origin,
      doctorId: patient.doctorId,
      doctorName: patient.doctor?.user?.name ?? null,
      referralCode: patient.doctor?.referralCode ?? null,
      prescribedModuleIds: patient.prescriptions?.map((p) => p.moduleId) ?? [],
      prescribedLevels,
    };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function readRefreshCookie(cookies: Record<string, string | undefined> | undefined): string | undefined {
  return cookies?.[REFRESH_COOKIE];
}
