import { createHash, randomBytes } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { Response } from 'express';
import { DataSource, IsNull, Repository } from 'typeorm';
import { seedAdminUsers } from '../common/admin-seed';
import { PATIENT_ADVISORY_LOCK_NS, PATIENT_ADVISORY_LOCK_SQL } from '../common/patient-lock';
import { ALL_MODULE_IDS } from '../common/catalog';
import { ACCESS_MAX_AGE_SEC, clearAuthCookies, REFRESH_COOKIE, REFRESH_MAX_AGE_SEC, setAuthCookies } from '../common/cookies';
import { generateReferralCode } from '../common/referral-code';
import { DocIdService } from '../docid/docid.service';
import { DoctorProfile } from '../entities/doctor-profile.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { GoogleInvitationChallenge } from '../entities/google-invitation-challenge.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { Prescription } from '../entities/prescription.entity';
import { PrescriptionRevision } from '../entities/prescription-revision.entity';
import { commitPrescriptionRevision, type LivePrescriptionChange, type PrescriptionRevisionStore } from '../prescriptions/commit-prescription-revision';
import { revisionRecord } from '../prescriptions/revision-record';
import { RefreshToken } from '../entities/refresh-token.entity';
import { User } from '../entities/user.entity';
import { Organization } from '../entities/organization.entity';
import { MailService } from '../mail/mail.service';
import { DoctorOrganizationMembership } from '../entities/doctor-organization-membership.entity';
import { decideDoctorPatientOrgAccess } from '../memberships/patient-organization';
import { MembershipsService } from '../memberships/memberships.service';
import { computeTrialEnd, toPatientTrialStatus } from '@candela/shared';
import { GoogleAuthService } from './google-auth.service';
import {
  AcceptGooglePatientInvitationDto,
  AcceptPatientInvitationDto,
  CreateAccountDto,
  CreatePatientDto,
  ForgotPasswordDto,
  GoogleAuthDto,
  LoginDto,
  ResetPasswordDto,
  SignupDto,
  UpdateDoctorDto,
} from './dto';

const BCRYPT_ROUNDS = 10;
const DEFAULT_RESET_TTL_HOURS = 1;
const DEFAULT_INVITATION_TTL_HOURS = 72;
const DEFAULT_GOOGLE_ACCEPT_TTL_MINUTES = 15;
const FORGOT_PASSWORD_OK = { ok: true as const };
/** Opaque password-login failure — do not reveal activation / registration state (L4). */
const INVALID_CREDENTIALS = 'Invalid email or password';

export type PatientInvitationIssueResult = {
  emailSent: boolean;
  expiresAt: string;
};

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    @InjectRepository(DoctorProfile) private readonly doctors: Repository<DoctorProfile>,
    @InjectRepository(PatientProfile) private readonly patients: Repository<PatientProfile>,
    @InjectRepository(Prescription) private readonly prescriptions: Repository<Prescription>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken) private readonly passwordResets: Repository<PasswordResetToken>,
    @InjectRepository(GoogleInvitationChallenge)
    private readonly googleInviteChallenges: Repository<GoogleInvitationChallenge>,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(DocIdService) private readonly docid: DocIdService,
    @Inject(GoogleAuthService) private readonly googleAuth: GoogleAuthService,
    @Inject(MailService) private readonly mail: MailService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(MembershipsService) private readonly memberships: MembershipsService,
    @Inject(DataSource) private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    await seedAdminUsers(this.users, this.orgs);
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
        organizationId: null,
        origin: 'self_signup',
        accountActivatedAt: new Date(),
      }),
    );
    return this.issueSession(user, res);
  }

  async login(dto: LoginDto, res: Response) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.users.findOne({ where: { email } });
    // L4: identical external response for missing / unactivated / Google-only / wrong password.
    if (!user?.passwordHash) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    return this.issueSession(user, res);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.users.findOne({ where: { email } });
    // Unactivated (null password) and missing accounts: same opaque OK response.
    if (!user?.passwordHash) {
      return FORGOT_PASSWORD_OK;
    }

    await this.passwordResets.update(
      { userId: user.id, purpose: 'password_reset', usedAt: IsNull() },
      { usedAt: new Date() },
    );

    const rawToken = randomBytes(32).toString('hex');
    const ttlHours = this.resetTtlHours();
    await this.passwordResets.save(
      this.passwordResets.create({
        userId: user.id,
        tokenHash: hashToken(rawToken),
        purpose: 'password_reset',
        expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
        usedAt: null,
      }),
    );

    const frontendUrl = (this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;
    const hourLabel = ttlHours === 1 ? '1 hour' : `${ttlHours} hours`;
    let emailSent = false;
    try {
      emailSent = await this.mail.send({
        to: user.email,
        subject: 'Reset your Kandela password',
        text: `Use this link to choose a new password (expires in ${hourLabel}):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
        html: `<p>Use this link to choose a new password (expires in ${hourLabel}):</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
      });
    } catch {
      emailSent = false;
    }

    if (!emailSent && (this.config.get<string>('MAIL_TRANSPORT') || 'log').trim().toLowerCase() === 'log') {
      console.log('[mail] Password reset link (MAIL_TRANSPORT=log)');
      console.log(resetUrl);
    }

    return FORGOT_PASSWORD_OK;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = hashToken(dto.token.trim());
    const row = await this.passwordResets.findOne({ where: { tokenHash } });
    if (
      !row ||
      row.purpose !== 'password_reset' ||
      row.usedAt != null ||
      row.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }

    const user = await this.users.findOne({ where: { id: row.userId } });
    // Invitation tokens / unactivated accounts must not be activated via reset.
    if (!user?.passwordHash) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }

    user.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    await this.users.save(user);
    row.usedAt = new Date();
    await this.passwordResets.save(row);
    await this.passwordResets.update(
      { userId: user.id, purpose: 'password_reset', usedAt: IsNull() },
      { usedAt: new Date() },
    );
    await this.refreshTokens.update({ userId: user.id }, { revokedAt: new Date() });
    return { ok: true };
  }

  async loginWithGoogle(dto: GoogleAuthDto, res: Response) {
    let profile;
    if (dto.idToken) {
      profile = await this.googleAuth.verifyIdToken(dto.idToken);
    } else if (dto.accessToken) {
      profile = await this.googleAuth.verifyAccessToken(dto.accessToken);
    } else {
      throw new UnauthorizedException('Missing Google token');
    }

    const byGoogle = await this.users.findOne({ where: { googleId: profile.googleId } });
    const byEmail = byGoogle
      ? null
      : await this.users.findOne({ where: { email: profile.email } });
    let user = byGoogle ?? byEmail;

    // Pending doctor-created invitee: Google auth succeeds, but no Candela session yet.
    if (user && user.role === 'patient') {
      const patient = await this.patients.findOne({
        where: { userId: user.id },
        relations: ['doctor', 'doctor.user', 'organization'],
      });
      if (patient && patient.origin === 'doctor_created' && !patient.accountActivatedAt) {
        if (user.email.trim().toLowerCase() !== profile.email) {
          throw new UnauthorizedException(
            "This Google account's email does not match the address your clinic invited. Sign in with the invited Google account.",
          );
        }
        if (user.googleId && user.googleId !== profile.googleId) {
          throw new ConflictException(
            'This Kandela account is linked to a different Google account. Use that Google account, or ask your clinic for help.',
          );
        }
        const otherWithSub = await this.users.findOne({ where: { googleId: profile.googleId } });
        if (otherWithSub && otherWithSub.id !== user.id) {
          throw new ConflictException(
            'This Google account is already linked to a different Kandela user. Use another Google account, or contact support.',
          );
        }
        return this.beginGoogleInvitationAcceptance(user, patient, profile);
      }
    }

    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      user = await this.users.save(
        this.users.create({
          email: profile.email,
          name: profile.name,
          googleId: profile.googleId,
          passwordHash: null,
          phone: null,
          role: 'patient',
        }),
      );
      await this.patients.save(
        this.patients.create({
          userId: user.id,
          doctorId: null,
          organizationId: null,
          origin: 'self_signup',
          accountActivatedAt: new Date(),
        }),
      );
    } else if (!user.googleId) {
      const taken = await this.users.findOne({ where: { googleId: profile.googleId } });
      if (taken && taken.id !== user.id) {
        throw new ConflictException(
          'This Google account is already linked to a different Kandela user. Use another Google account, or contact support.',
        );
      }
      user.googleId = profile.googleId;
      await this.users.save(user);
    } else if (user.googleId !== profile.googleId) {
      throw new ConflictException(
        'This Kandela account is linked to a different Google account. Use that Google account, or contact support.',
      );
    }

    const session = await this.issueSession(user, res);
    return {
      ...session,
      isNewUser,
    };
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

  async createDoctor(dto: CreateAccountDto, organizationId: string | null = null) {
    const user = await this.createUser({ ...dto, role: 'doctor', organizationId });
    const referralCode = await this.uniqueReferralCode();
    await this.doctors.save(
      this.doctors.create({
        userId: user.id,
        referralCode,
      }),
    );
    if (organizationId) {
      await this.memberships.ensureActiveMembership(user.id, organizationId, { primary: true });
    }
    return {
      ...this.toPublicUser(user),
      referralCode,
    };
  }

  /**
   * Doctor-created patient: no password. Creates user + ownership + invitation token
   * in one DB transaction, then emails after commit (M6).
   * organizationId must be an explicitly validated active membership (X-Organization-Id).
   */
  async createDoctorPatient(doctorUserId: string, dto: CreatePatientDto, organizationId: string) {
    const doctor = await this.doctors.findOne({ where: { userId: doctorUserId } });
    if (!doctor) {
      throw new UnauthorizedException('Doctor profile not found');
    }
    if (!organizationId) {
      throw new BadRequestException('Organisation context is required to create a patient');
    }
    await this.memberships.assertActiveMembership(doctorUserId, organizationId);

    const email = dto.email.trim().toLowerCase();
    const name = dto.name.trim();
    const phone = dto.phone.trim();
    const rawToken = randomBytes(32).toString('hex');
    const ttlHours = this.invitationTtlHours();
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    let userId: string;
    try {
      userId = await this.dataSource.transaction(async (manager) => {
        const userRepo = manager.getRepository(User);
        const patientRepo = manager.getRepository(PatientProfile);
        const tokenRepo = manager.getRepository(PasswordResetToken);

        const existing = await userRepo.findOne({ where: { email } });
        if (existing) {
          throw new ConflictException('An account with this email already exists');
        }

        const user = await userRepo.save(
          userRepo.create({
            email,
            passwordHash: null,
            name,
            phone,
            role: 'patient',
            organizationId: null,
          }),
        );

        await patientRepo.save(
          patientRepo.create({
            userId: user.id,
            doctorId: doctor.userId,
            organizationId,
            origin: 'doctor_created',
            accountActivatedAt: null,
          }),
        );

        await tokenRepo.update(
          { userId: user.id, purpose: 'patient_invitation', usedAt: IsNull() },
          { usedAt: new Date() },
        );
        await tokenRepo.save(
          tokenRepo.create({
            userId: user.id,
            tokenHash: hashToken(rawToken),
            purpose: 'patient_invitation',
            expiresAt,
            usedAt: null,
          }),
        );

        return user.id;
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('An account with this email already exists');
      }
      throw err;
    }

    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Patient not found');
    }

    // Email only after commit — never send a token that is not durable.
    const emailSent = await this.sendPatientInvitationEmail(user, rawToken, ttlHours);
    const patient = await this.toPatientSummary(user.id);
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    return {
      patient,
      invitation: { emailSent, expiresAt: expiresAt.toISOString() } satisfies PatientInvitationIssueResult,
    };
  }

  /**
   * Resend patient invitation. Invalidates outstanding patient_invitation tokens only.
   * Doctor: assigned + active membership in patient.organization_id.
   * Admin: patient.organization_id === admin.organization_id.
   * Super admin: any unactivated patient.
   */
  async resendPatientInvitation(actor: User, patientId: string): Promise<PatientInvitationIssueResult> {
    const patient = await this.patients.findOne({
      where: { userId: patientId },
      relations: ['user'],
    });
    if (!patient?.user || patient.user.role !== 'patient') {
      throw new NotFoundException('Patient not found');
    }
    await this.assertCanManagePatientInvitation(actor, patient);

    if (patient.accountActivatedAt) {
      throw new ConflictException(
        'This patient has already activated their account. Ask them to sign in instead of resending the invitation.',
      );
    }

    return this.issuePatientInvitation(patient.user);
  }

  /**
   * Public invitation acceptance — sets password for an unactivated patient account.
   * Strictly purpose=patient_invitation; never accepts password_reset tokens.
   */
  async acceptPatientInvitation(dto: AcceptPatientInvitationDto): Promise<{ ok: true }> {
    const tokenHash = hashToken(dto.token.trim());

    await this.dataSource.transaction(async (manager) => {
      const tokenRepo = manager.getRepository(PasswordResetToken);
      const userRepo = manager.getRepository(User);
      const patientRepo = manager.getRepository(PatientProfile);

      const row = await tokenRepo.findOne({
        where: { tokenHash },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !row ||
        row.purpose !== 'patient_invitation' ||
        row.usedAt != null ||
        row.expiresAt.getTime() < Date.now()
      ) {
        throw new BadRequestException(
          'This invitation link is invalid or has expired. Ask your clinic to send a new invitation.',
        );
      }

      const user = await userRepo.findOne({
        where: { id: row.userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user || user.role !== 'patient') {
        throw new BadRequestException(
          'This invitation link is invalid or has expired. Ask your clinic to send a new invitation.',
        );
      }

      const patient = await patientRepo.findOne({
        where: { userId: user.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!patient) {
        throw new BadRequestException(
          'This invitation link is invalid or has expired. Ask your clinic to send a new invitation.',
        );
      }
      if (patient.accountActivatedAt) {
        throw new ConflictException(
          'This account is already activated. Sign in with your password or Continue with Google.',
        );
      }

      user.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      await userRepo.save(user);

      patient.accountActivatedAt = new Date();
      await patientRepo.save(patient);

      row.usedAt = new Date();
      await tokenRepo.save(row);
      await tokenRepo.update(
        { userId: user.id, purpose: 'patient_invitation', usedAt: IsNull() },
        { usedAt: new Date() },
      );
      await manager.getRepository(GoogleInvitationChallenge).update(
        { userId: user.id, usedAt: IsNull() },
        { usedAt: new Date() },
      );
    });

    return { ok: true };
  }

  /**
   * H2 Option C — after Google identity is validated for a pending invitee,
   * patient explicitly accepts. Links Google, consumes invitation, activates, then sessions.
   */
  async acceptGooglePatientInvitation(
    dto: AcceptGooglePatientInvitationDto,
    res: Response,
  ) {
    const tokenHash = hashToken(dto.acceptanceToken.trim());
    let userId: string | null = null;

    await this.dataSource.transaction(async (manager) => {
      const challengeRepo = manager.getRepository(GoogleInvitationChallenge);
      const tokenRepo = manager.getRepository(PasswordResetToken);
      const userRepo = manager.getRepository(User);
      const patientRepo = manager.getRepository(PatientProfile);

      const challenge = await challengeRepo.findOne({
        where: { tokenHash },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !challenge ||
        challenge.usedAt != null ||
        challenge.expiresAt.getTime() < Date.now()
      ) {
        throw new BadRequestException(
          'Your Google invitation confirmation expired. Sign in with Google again to continue.',
        );
      }

      const invitation = await tokenRepo.findOne({
        where: { id: challenge.invitationTokenId },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !invitation ||
        invitation.purpose !== 'patient_invitation' ||
        invitation.usedAt != null ||
        invitation.expiresAt.getTime() < Date.now() ||
        invitation.userId !== challenge.userId
      ) {
        throw new BadRequestException(
          'This invitation is no longer valid. Ask your clinic to send a new invitation, then try Continue with Google again.',
        );
      }

      const user = await userRepo.findOne({
        where: { id: challenge.userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user || user.role !== 'patient') {
        throw new BadRequestException(
          'Your Google invitation confirmation expired. Sign in with Google again to continue.',
        );
      }
      if (user.email.trim().toLowerCase() !== challenge.googleEmail) {
        throw new UnauthorizedException(
          "This confirmation no longer matches your account email. Sign in with Google again.",
        );
      }

      const patient = await patientRepo.findOne({
        where: { userId: user.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!patient || patient.origin !== 'doctor_created') {
        throw new BadRequestException(
          'Your Google invitation confirmation expired. Sign in with Google again to continue.',
        );
      }
      if (patient.accountActivatedAt) {
        throw new ConflictException(
          'This account is already activated. Sign in with Continue with Google.',
        );
      }

      const otherWithSub = await userRepo.findOne({
        where: { googleId: challenge.googleSub },
      });
      if (otherWithSub && otherWithSub.id !== user.id) {
        throw new ConflictException(
          'This Google account is already linked to a different Kandela user. Use another Google account, or contact support.',
        );
      }
      if (user.googleId && user.googleId !== challenge.googleSub) {
        throw new ConflictException(
          'This Kandela account is linked to a different Google account. Use that Google account, or contact support.',
        );
      }

      user.googleId = challenge.googleSub;
      await userRepo.save(user);

      patient.accountActivatedAt = new Date();
      await patientRepo.save(patient);

      invitation.usedAt = new Date();
      await tokenRepo.save(invitation);
      await tokenRepo.update(
        { userId: user.id, purpose: 'patient_invitation', usedAt: IsNull() },
        { usedAt: new Date() },
      );

      challenge.usedAt = new Date();
      await challengeRepo.save(challenge);
      await challengeRepo.update(
        { userId: user.id, usedAt: IsNull() },
        { usedAt: new Date() },
      );

      userId = user.id;
    });

    if (!userId) {
      throw new BadRequestException(
        'Could not activate your account. Sign in with Google again, or ask your clinic for a new invitation.',
      );
    }
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException(
        'Could not activate your account. Sign in with Google again, or ask your clinic for a new invitation.',
      );
    }
    return this.issueSession(user, res);
  }

  /**
   * Issues a restricted Google acceptance challenge — no session, cookies, or googleId link.
   */
  private async beginGoogleInvitationAcceptance(
    user: User,
    patient: PatientProfile,
    profile: { googleId: string; email: string; name: string },
  ) {
    const invitation = await this.passwordResets.findOne({
      where: {
        userId: user.id,
        purpose: 'patient_invitation',
        usedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });
    if (!invitation || invitation.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException(
        'Your clinic invitation has expired or is no longer valid. Ask your clinic to resend the invitation, then try Continue with Google again.',
      );
    }

    await this.googleInviteChallenges.update(
      { userId: user.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );

    const rawToken = randomBytes(32).toString('hex');
    const ttlMinutes = this.googleAcceptTtlMinutes();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    await this.googleInviteChallenges.save(
      this.googleInviteChallenges.create({
        tokenHash: hashToken(rawToken),
        userId: user.id,
        invitationTokenId: invitation.id,
        googleSub: profile.googleId,
        googleEmail: profile.email,
        expiresAt,
        usedAt: null,
      }),
    );

    return {
      status: 'invitation_acceptance_required' as const,
      acceptanceToken: rawToken,
      invitation: {
        email: user.email,
        patientName: user.name,
        doctorName: patient.doctor?.user?.name ?? null,
        organizationName: patient.organization?.name ?? null,
        invitationExpiresAt: invitation.expiresAt.toISOString(),
      },
      message:
        'Your clinic invited you to Kandela. Confirm below to finish activating your account with Google.',
    };
  }

  private googleAcceptTtlMinutes(): number {
    const raw = Number(this.config.get<string>('GOOGLE_INVITATION_ACCEPT_TTL_MINUTES'));
    if (Number.isFinite(raw) && raw > 0 && raw <= 120) {
      return Math.floor(raw);
    }
    return DEFAULT_GOOGLE_ACCEPT_TTL_MINUTES;
  }

  async listDoctors(organizationId: string | null = null) {
    const doctors = await this.doctors.find({
      relations: ['user', 'user.organization', 'organizationMemberships', 'organizationMemberships.organization'],
      order: { referralCode: 'ASC' },
    });
    const filtered = organizationId
      ? doctors.filter((d) =>
          (d.organizationMemberships ?? []).some(
            (m) => m.organizationId === organizationId && m.membershipStatus === 'active',
          ),
        )
      : doctors;
    return filtered.map((d) => {
      const primary =
        (d.organizationMemberships ?? []).find((m) => m.isPrimary && m.membershipStatus === 'active') ??
        (d.organizationMemberships ?? []).find((m) => m.membershipStatus === 'active');
      return {
        ...this.toPublicUser(d.user),
        referralCode: d.referralCode,
        organizationName: primary?.organization?.name ?? d.user?.organization?.name ?? null,
      };
    });
  }

  async updateDoctor(actor: User, doctorUserId: string, dto: UpdateDoctorDto) {
    const user = await this.users.findOne({ where: { id: doctorUserId } });
    if (!user || user.role !== 'doctor') {
      throw new NotFoundException('Doctor not found');
    }
    await this.memberships.assertAdminManagesDoctor(actor, doctorUserId);
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

  async deleteDoctor(actor: User, doctorUserId: string) {
    const user = await this.users.findOne({ where: { id: doctorUserId } });
    if (!user || user.role !== 'doctor') {
      throw new NotFoundException('Doctor not found');
    }
    await this.memberships.assertAdminManagesDoctor(actor, doctorUserId);
    await this.docid.cancelPendingForDoctor(doctorUserId);
    await this.refreshTokens.delete({ userId: doctorUserId });
    // Unlink patients only; do not delete patient accounts, prescriptions, or sessions.
    await this.patients.update({ doctorId: doctorUserId }, { doctorId: null });
    await this.doctors.delete({ userId: doctorUserId });
    await this.users.delete({ id: doctorUserId });

    return { success: true, id: doctorUserId };
  }

  async listAllPatients(organizationId: string | null = null) {
    const patients = await this.patients.find({
      relations: [
        'user',
        'organization',
        'doctor',
        'doctor.user',
        'prescriptions',
      ],
      order: { origin: 'ASC' },
    });
    // Org scoping uses authoritative patients.organization_id — not the doctor's memberships.
    const filtered = organizationId
      ? patients.filter((p) => p.organizationId === organizationId)
      : patients;
    return this.attachDocIdMeta(filtered.map((p) => this.patientToSummary(p)));
  }

  async listDoctorPatients(doctorUserId: string) {
    const patients = await this.patients.find({
      where: { doctorId: doctorUserId },
      relations: ['user', 'organization', 'doctor', 'doctor.user', 'prescriptions'],
    });
    const accessible: typeof patients = [];
    for (const patient of patients) {
      if (await this.memberships.doctorCanAccessPatient(doctorUserId, patient.userId)) {
        accessible.push(patient);
      }
    }
    return this.attachDocIdMeta(accessible.map((p) => this.patientToSummary(p)));
  }

  async getOwnedPatient(doctorUserId: string, patientId: string) {
    const allowed = await this.memberships.doctorCanAccessPatient(doctorUserId, patientId);
    if (!allowed) {
      return null;
    }
    const patient = await this.patients.findOne({
      where: { userId: patientId, doctorId: doctorUserId },
      relations: ['user', 'organization', 'doctor', 'doctor.user', 'prescriptions'],
    });
    if (!patient) {
      return null;
    }
    const [summary] = await this.attachDocIdMeta([this.patientToSummary(patient)]);
    return summary;
  }

  async addPrescription(doctorUserId: string, patientId: string, moduleId: string, levels: string[] = []) {
    return this.changePrescription(doctorUserId, patientId, { moduleId, levels: levels.slice() });
  }

  async removePrescription(doctorUserId: string, patientId: string, moduleId: string) {
    return this.changePrescription(doctorUserId, patientId, { moduleId, remove: true });
  }

  private async changePrescription(doctorUserId: string, patientId: string, change: LivePrescriptionChange) {
    const allowed = await this.memberships.doctorCanAccessPatient(doctorUserId, patientId);
    if (!allowed) {
      return null;
    }
    const at = new Date().toISOString();
    let committed: true | null;
    try {
      committed = await this.prescriptions.manager.transaction(async (trx) => {
        const store: PrescriptionRevisionStore = {
          lock: async (id) => {
            await trx.query(PATIENT_ADVISORY_LOCK_SQL, [PATIENT_ADVISORY_LOCK_NS, id]);
          },
          owns: async (id, doctorId) => {
            const patient = await trx.findOne(PatientProfile, { where: { userId: id } });
            if (!patient) return false;
            const membership = patient.organizationId
              ? await trx.findOne(DoctorOrganizationMembership, {
                  where: {
                    doctorId,
                    organizationId: patient.organizationId,
                    membershipStatus: 'active',
                  },
                })
              : null;
            return (
              decideDoctorPatientOrgAccess({
                patientDoctorId: patient.doctorId,
                patientOrganizationId: patient.organizationId,
                callerDoctorId: doctorId,
                callerHasActiveMembershipInPatientOrg: Boolean(membership),
              }).ok === true
            );
          },
          listLive: async (id) => {
            const rows = await trx.find(Prescription, { where: { patientId: id } });
            return rows.map((row) => ({ moduleId: row.moduleId, levels: row.levels || [] }));
          },
          applyLive: async (id, liveChange) => {
            if ('remove' in liveChange) {
              await trx.delete(Prescription, { patientId: id, moduleId: liveChange.moduleId });
              return;
            }
            const existing = await trx.findOne(Prescription, { where: { patientId: id, moduleId: liveChange.moduleId } });
            if (!existing) {
              await trx.save(Prescription, { patientId: id, moduleId: liveChange.moduleId, levels: liveChange.levels });
            } else {
              existing.levels = liveChange.levels;
              await trx.save(Prescription, existing);
            }
          },
          listRevisions: async (id) => {
            const rows = await trx.find(PrescriptionRevision, { where: { patientId: id }, order: { effectiveFrom: 'ASC' } });
            return rows.map((row) => revisionRecord(row));
          },
          closeRevision: async (id, effectiveTo) => {
            await trx.update(PrescriptionRevision, { id }, { effectiveTo: new Date(effectiveTo) });
          },
          insertRevision: async (revision) => {
            await trx.save(PrescriptionRevision, {
              id: revision.id,
              patientId: revision.patientId,
              actorDoctorId: revision.actorDoctorId,
              effectiveFrom: new Date(revision.effectiveFrom),
              effectiveTo: null,
              assignments: revision.assignments,
            });
          },
        };
        return commitPrescriptionRevision(store, { doctorId: doctorUserId, patientId, at, change });
      });
    } catch (err) {
      if (err instanceof Error && (err.message === 'invalid_period' || err.message === 'overlapping_open_revisions')) {
        throw new BadRequestException('Could not record this prescription change');
      }
      throw err;
    }
    if (!committed) return null;
    return this.getOwnedPatient(doctorUserId, patientId);
  }

  private async createUser(input: {
    name: string;
    phone: string;
    email: string;
    password: string | null;
    role: User['role'];
    organizationId?: string | null;
  }): Promise<User> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }
    const passwordHash =
      input.password == null ? null : await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    return this.users.save(
      this.users.create({
        email,
        passwordHash,
        name: input.name.trim(),
        phone: input.phone.trim(),
        role: input.role,
        organizationId: input.organizationId ?? null,
      }),
    );
  }

  private async assertCanManagePatientInvitation(actor: User, patient: PatientProfile): Promise<void> {
    if (actor.role === 'super_admin') return;

    if (actor.role === 'admin') {
      if (!actor.organizationId || patient.organizationId !== actor.organizationId) {
        throw new ForbiddenException(
          'You can only resend invitations for patients in your organisation',
        );
      }
      return;
    }

    if (actor.role === 'doctor') {
      const allowed = await this.memberships.doctorCanAccessPatient(actor.id, patient.userId);
      if (!allowed) {
        throw new ForbiddenException('You cannot manage invitations for this patient');
      }
      return;
    }

    throw new ForbiddenException('Not authorised to manage patient invitations');
  }

  /**
   * Issues a new patient_invitation token, invalidating prior unused invitation tokens only.
   * Does not invalidate password_reset tokens. Never returns the raw token.
   */
  private async issuePatientInvitation(user: User): Promise<PatientInvitationIssueResult> {
    await this.passwordResets.update(
      { userId: user.id, purpose: 'patient_invitation', usedAt: IsNull() },
      { usedAt: new Date() },
    );

    const rawToken = randomBytes(32).toString('hex');
    const ttlHours = this.invitationTtlHours();
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    await this.passwordResets.save(
      this.passwordResets.create({
        userId: user.id,
        tokenHash: hashToken(rawToken),
        purpose: 'patient_invitation',
        expiresAt,
        usedAt: null,
      }),
    );

    const emailSent = await this.sendPatientInvitationEmail(user, rawToken, ttlHours);
    return { emailSent, expiresAt: expiresAt.toISOString() };
  }

  private async sendPatientInvitationEmail(
    user: User,
    rawToken: string,
    ttlHours: number,
  ): Promise<boolean> {
    const frontendUrl = (this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    const inviteUrl = `${frontendUrl}/accept-invitation?token=${rawToken}`;
    const hourLabel = ttlHours === 1 ? '1 hour' : `${ttlHours} hours`;
    let emailSent = false;
    try {
      emailSent = await this.mail.send({
        to: user.email,
        subject: 'Activate your Kandela account',
        text: [
          `Hello ${user.name},`,
          '',
          'Your clinician has created a Kandela account for you.',
          `Use this secure link to set your password and activate your account (expires in ${hourLabel}):`,
          inviteUrl,
          '',
          'If you were not expecting this invitation, contact your clinic and ignore this email.',
          'Never share this link. Kandela will never email you a password.',
        ].join('\n'),
        html: [
          `<p>Hello ${escapeHtml(user.name)},</p>`,
          `<p>Your clinician has created a <strong>Kandela</strong> account for you.</p>`,
          `<p>Use this secure link to set your password and activate your account (expires in ${hourLabel}):</p>`,
          `<p><a href="${inviteUrl}">Activate your account</a></p>`,
          `<p>If you were not expecting this invitation, contact your clinic and ignore this email.</p>`,
          `<p>Never share this link. Kandela will never email you a password.</p>`,
        ].join(''),
      });
    } catch {
      emailSent = false;
    }

    if (!emailSent && (this.config.get<string>('MAIL_TRANSPORT') || 'log').trim().toLowerCase() === 'log') {
      console.log('[mail] Patient invitation link (MAIL_TRANSPORT=log) — token omitted from logs');
      console.log(`${frontendUrl}/accept-invitation?token=<redacted>`);
    }

    return emailSent;
  }

  private resetTtlHours(): number {
    const raw = Number(this.config.get<string>('PASSWORD_RESET_TTL_HOURS'));
    if (!Number.isFinite(raw) || raw <= 0) {
      return DEFAULT_RESET_TTL_HOURS;
    }
    return raw;
  }

  private invitationTtlHours(): number {
    const raw = Number(this.config.get<string>('PATIENT_INVITATION_TTL_HOURS'));
    if (!Number.isFinite(raw) || raw <= 0) {
      return DEFAULT_INVITATION_TTL_HOURS;
    }
    return raw;
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
    const fullUser = await this.users.findOne({
      where: { id: user.id },
      relations: ['organization'],
    });
    const target = fullUser ?? user;
    const publicUser = this.toPublicUser(target);
    const organization = target.organization
      ? {
          id: target.organization.id,
          name: target.organization.name,
          code: target.organization.code,
        }
      : null;

    if (target.role === 'super_admin' || target.role === 'admin') {
      return {
        user: publicUser,
        organization,
        doctor: null,
        patient: null,
        allowedModuleIds: [] as string[],
      };
    }
    if (target.role === 'doctor') {
      const doctor = await this.doctors.findOne({ where: { userId: target.id } });
      return {
        user: publicUser,
        organization,
        doctor: doctor ? { referralCode: doctor.referralCode } : null,
        patient: null,
        allowedModuleIds: [] as string[],
      };
    }
    if (target.role === 'patient') {
      let patient = await this.patients.findOne({
        where: { userId: target.id },
        relations: ['doctor', 'doctor.user', 'prescriptions'],
      });
      if (patient) {
        patient = await this.ensurePatientTrialStarted(patient);
      }
      const prescribed = patient?.prescriptions?.map((p) => p.moduleId) ?? [];
      const prescribedLevels =
        patient?.prescriptions?.reduce((acc, p) => {
          acc[p.moduleId] = p.levels || [];
          return acc;
        }, {} as Record<string, string[]>) ?? {};
      const allowedModuleIds = !patient?.doctorId ? [...ALL_MODULE_IDS] : prescribed;
      const pendingDocIdRequest = patient
        ? await this.docid.getPendingForPatient(patient.userId)
        : null;
      const previousReferralCodes = patient
        ? await this.docid.listHistoryCodes(patient.userId)
        : [];
      return {
        user: publicUser,
        organization,
        doctor: null,
        patient: patient
          ? {
              origin: patient.origin,
              doctorId: patient.doctorId,
              doctorName: patient.doctor?.user?.name ?? null,
              referralCode: patient.doctor?.referralCode ?? null,
              prescribedModuleIds: prescribed,
              prescribedLevels,
              pendingDocIdRequest,
              previousReferralCodes,
              trial: toPatientTrialStatus(patient.trialStartedAt, patient.trialEndsAt),
            }
          : null,
        allowedModuleIds,
      };
    }
    return {
      user: publicUser,
      organization,
      doctor: null,
      patient: null,
      allowedModuleIds: [] as string[],
    };
  }

  /**
   * Starts the one-time 7-day trial on first successful session build (login).
   * Atomic conditional UPDATE — concurrent first logins share one window; never resets.
   */
  async ensurePatientTrialStarted(patient: PatientProfile): Promise<PatientProfile> {
    if (patient.trialStartedAt && patient.trialEndsAt) {
      return patient;
    }
    if (typeof this.dataSource?.query !== 'function') {
      return patient;
    }
    const startedAt = new Date();
    const endsAt = computeTrialEnd(startedAt);
    // Only the first writer wins; later writers read the established window.
    const rows: Array<{ trial_started_at: Date; trial_ends_at: Date }> = await this.dataSource.query(
      `
        UPDATE patients
        SET trial_started_at = $1, trial_ends_at = $2
        WHERE user_id = $3
          AND trial_started_at IS NULL
          AND trial_ends_at IS NULL
        RETURNING trial_started_at, trial_ends_at
      `,
      [startedAt.toISOString(), endsAt.toISOString(), patient.userId],
    );
    if (rows.length > 0) {
      patient.trialStartedAt = new Date(rows[0].trial_started_at);
      patient.trialEndsAt = new Date(rows[0].trial_ends_at);
      return patient;
    }
    const existing = await this.patients.findOne({ where: { userId: patient.userId } });
    if (existing?.trialStartedAt && existing?.trialEndsAt) {
      patient.trialStartedAt = existing.trialStartedAt;
      patient.trialEndsAt = existing.trialEndsAt;
    }
    return patient;
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone ?? '',
      role: user.role,
      organizationId: user.organizationId ?? null,
    };
  }

  private async toPatientSummary(patientId: string) {
    const patient = await this.patients.findOne({
      where: { userId: patientId },
      relations: ['user', 'organization', 'doctor', 'doctor.user', 'prescriptions'],
    });
    if (!patient) {
      return null;
    }
    const [summary] = await this.attachDocIdMeta([this.patientToSummary(patient)]);
    return summary;
  }

  private patientToSummary(patient: PatientProfile) {
    const prescribedLevels = patient.prescriptions?.reduce((acc, p) => {
      acc[p.moduleId] = p.levels || [];
      return acc;
    }, {} as Record<string, string[]>) ?? {};

    return {
      ...this.toPublicUser(patient.user),
      // PublicUser.organizationId is the user's legacy field; surface patient owning org explicitly.
      organizationId: patient.organizationId ?? null,
      organizationName: patient.organization?.name ?? null,
      origin: patient.origin,
      doctorId: patient.doctorId,
      doctorName: patient.doctor?.user?.name ?? null,
      referralCode: patient.doctor?.referralCode ?? null,
      prescribedModuleIds: patient.prescriptions?.map((p) => p.moduleId) ?? [],
      prescribedLevels,
      previousReferralCodes: [] as string[],
    };
  }

  private async attachDocIdMeta<T extends { id: string; previousReferralCodes: string[] }>(
    summaries: T[],
  ): Promise<T[]> {
    const history = await this.docid.listHistoryCodesByPatientIds(summaries.map((s) => s.id));
    return summaries.map((summary) => ({
      ...summary,
      previousReferralCodes: history.get(summary.id) ?? [],
    }));
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  if (code === '23505') return true;
  const driver = (err as { driverError?: { code?: string } }).driverError;
  return driver?.code === '23505';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function readRefreshCookie(cookies: Record<string, string | undefined> | undefined): string | undefined {
  return cookies?.[REFRESH_COOKIE];
}
