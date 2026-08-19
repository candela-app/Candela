import { createHash, randomBytes } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { isValidReferralCode } from '../common/referral-code';
import { DocIdHistory } from '../entities/docid-history.entity';
import { DocIdRequest, DocIdRequestSource } from '../entities/docid-request.entity';
import { DoctorProfile } from '../entities/doctor-profile.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { User } from '../entities/user.entity';
import { MailService } from '../mail/mail.service';

const DEFAULT_TTL_HOURS = 48;

export type PendingDocIdView = {
  id: string;
  source: DocIdRequestSource;
  targetReferralCode: string;
  targetDoctorName: string;
  fromReferralCode: string | null;
  recipientRole: 'doctor' | 'patient';
  expiresAt: string;
};

export type DocIdRequestPreview = PendingDocIdView & {
  patientName: string;
  status: DocIdRequest['status'];
};

export type IncomingDocIdRequestView = {
  id: string;
  source: 'self' | 'change';
  patientName: string;
  patientEmail: string;
  targetReferralCode: string;
  expiresAt: string;
};

export type DocIdRequestResult = {
  emailSent: boolean;
  recipientRole: 'doctor' | 'patient';
  targetReferralCode: string;
  expiresAt: string;
};

@Injectable()
export class DocIdService {
  constructor(
    @InjectRepository(DocIdRequest) private readonly requests: Repository<DocIdRequest>,
    @InjectRepository(DocIdHistory) private readonly history: Repository<DocIdHistory>,
    @InjectRepository(DoctorProfile) private readonly doctors: Repository<DoctorProfile>,
    @InjectRepository(PatientProfile) private readonly patients: Repository<PatientProfile>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(MailService) private readonly mail: MailService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async requestByPatient(user: User, rawCode: string): Promise<DocIdRequestResult> {
    if (user.role !== 'patient') {
      throw new ForbiddenException('Only patients can attach or change a DocID');
    }
    const patient = await this.requirePatient(user.id);
    const doctor = await this.requireDoctorByCode(rawCode);
    if (patient.doctorId === doctor.userId) {
      throw new ConflictException('You are already linked to this doctor');
    }
    if (!patient.doctorId) {
      if (patient.origin !== 'self_signup') {
        throw new BadRequestException('Ask an administrator to transfer you to a doctor');
      }
      return this.createAndNotify(patient, doctor, 'self');
    }
    return this.createAndNotify(patient, doctor, 'change');
  }

  async requestByAdmin(patientId: string, rawCode: string): Promise<DocIdRequestResult> {
    const patient = await this.requirePatient(patientId);
    const doctor = await this.requireDoctorByCode(rawCode);
    if (patient.doctorId === doctor.userId) {
      throw new ConflictException('Patient is already linked to this doctor');
    }
    return this.createAndNotify(patient, doctor, 'internal');
  }

  async previewByToken(token: string): Promise<DocIdRequestPreview> {
    const request = await this.requireByToken(token);
    await this.expireIfNeeded(request);
    return this.toPreview(request);
  }

  async settleByToken(token: string, accept: boolean): Promise<DocIdRequestPreview> {
    const request = await this.requireByToken(token);
    await this.settle(request, accept);
    return this.toPreview(request);
  }

  async settleAsRecipient(user: User, requestId: string, accept: boolean): Promise<DocIdRequestPreview> {
    const request = await this.requests.findOne({
      where: { id: requestId },
      relations: ['patient', 'patient.user', 'toDoctor', 'toDoctor.user', 'fromDoctor'],
    });
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    if (request.recipientUserId !== user.id) {
      throw new ForbiddenException('You cannot confirm this request');
    }
    await this.settle(request, accept);
    return this.toPreview(request);
  }

  async getPendingForPatient(patientId: string): Promise<PendingDocIdView | null> {
    const request = await this.requests.findOne({
      where: { patientId, status: 'pending' },
      relations: ['toDoctor', 'toDoctor.user', 'patient', 'patient.user'],
      order: { createdAt: 'DESC' },
    });
    if (!request) {
      return null;
    }
    if (await this.expireIfNeeded(request)) {
      return null;
    }
    return this.toPendingView(request);
  }

  async listIncomingForDoctor(doctorUserId: string): Promise<IncomingDocIdRequestView[]> {
    const pending = await this.requests.find({
      where: { recipientUserId: doctorUserId, status: 'pending' },
      relations: ['patient', 'patient.user', 'toDoctor'],
      order: { createdAt: 'DESC' },
    });
    const open: IncomingDocIdRequestView[] = [];
    for (const request of pending) {
      if (request.source === 'internal') {
        continue;
      }
      if (await this.expireIfNeeded(request)) {
        continue;
      }
      open.push({
        id: request.id,
        source: request.source === 'change' ? 'change' : 'self',
        patientName: request.patient.user.name,
        patientEmail: request.patient.user.email,
        targetReferralCode: request.toDoctor.referralCode,
        expiresAt: request.expiresAt.toISOString(),
      });
    }
    return open;
  }

  async listHistoryCodes(patientId: string): Promise<string[]> {
    const rows = await this.history.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => row.referralCode);
  }

  async listHistoryCodesByPatientIds(patientIds: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (patientIds.length === 0) {
      return map;
    }
    const rows = await this.history.find({
      where: { patientId: In(patientIds) },
      order: { createdAt: 'DESC' },
    });
    for (const row of rows) {
      const existing = map.get(row.patientId) ?? [];
      existing.push(row.referralCode);
      map.set(row.patientId, existing);
    }
    return map;
  }

  async cancelPendingForDoctor(doctorUserId: string): Promise<void> {
    await this.requests.update(
      { toDoctorId: doctorUserId, status: 'pending' },
      { status: 'rejected', resolvedAt: new Date() },
    );
    await this.requests.update(
      { recipientUserId: doctorUserId, status: 'pending' },
      { status: 'rejected', resolvedAt: new Date() },
    );
  }

  private async createAndNotify(
    patient: PatientProfile,
    toDoctor: DoctorProfile,
    source: DocIdRequestSource,
  ): Promise<DocIdRequestResult> {
    await this.requests.update(
      { patientId: patient.userId, status: 'pending' },
      { status: 'rejected', resolvedAt: new Date() },
    );

    const fromReferralCode = patient.doctor?.referralCode ?? null;
    const recipientIsDoctor = source === 'self' || source === 'change';
    const recipientUserId = recipientIsDoctor ? toDoctor.userId : patient.userId;
    const recipientRole: 'doctor' | 'patient' = recipientIsDoctor ? 'doctor' : 'patient';
    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.ttlMs());

    await this.requests.save(
      this.requests.create({
        patientId: patient.userId,
        fromDoctorId: patient.doctorId,
        fromReferralCode,
        toDoctorId: toDoctor.userId,
        source,
        status: 'pending',
        tokenHash: hashToken(rawToken),
        recipientUserId,
        expiresAt,
        resolvedAt: null,
      }),
    );

    const recipient = await this.users.findOne({ where: { id: recipientUserId } });
    if (!recipient) {
      throw new NotFoundException('Mail recipient not found');
    }

    const frontendUrl = (this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    const confirmUrl = `${frontendUrl}/docid/confirm?token=${rawToken}`;
    const rejectUrl = `${frontendUrl}/docid/reject?token=${rawToken}`;
    const mail = this.buildMail({
      source,
      recipientRole,
      patientName: patient.user.name,
      patientEmail: patient.user.email,
      doctorName: toDoctor.user.name,
      targetReferralCode: toDoctor.referralCode,
      fromReferralCode,
      confirmUrl,
      rejectUrl,
    });

    let emailSent = false;
    try {
      emailSent = await this.mail.send({
        to: recipient.email,
        ...mail,
      });
    } catch {
      emailSent = false;
    }

    if (!emailSent && (this.config.get<string>('MAIL_TRANSPORT') || 'log').trim().toLowerCase() === 'log') {
      console.log(`[mail] DocID ${source} ${recipientRole} confirm: ${confirmUrl}`);
      console.log(`[mail] DocID ${source} ${recipientRole} reject: ${rejectUrl}`);
    }

    return {
      emailSent,
      recipientRole,
      targetReferralCode: toDoctor.referralCode,
      expiresAt: expiresAt.toISOString(),
    };
  }

  private async settle(request: DocIdRequest, accept: boolean): Promise<void> {
    if (await this.expireIfNeeded(request)) {
      throw new GoneException('This confirmation link has expired');
    }
    if (request.status !== 'pending') {
      throw new ConflictException(
        request.status === 'accepted' ? 'This request was already accepted' : 'This request was already rejected',
      );
    }

    if (!accept) {
      request.status = 'rejected';
      request.resolvedAt = new Date();
      await this.requests.save(request);
      return;
    }

    const patient = await this.requirePatient(request.patientId);
    const toDoctor = await this.doctors.findOne({
      where: { userId: request.toDoctorId },
      relations: ['user'],
    });
    if (!toDoctor) {
      request.status = 'rejected';
      request.resolvedAt = new Date();
      await this.requests.save(request);
      throw new NotFoundException('The requested doctor is no longer available');
    }

    if (request.source === 'self' && patient.doctorId) {
      throw new ConflictException('This patient is already linked to a doctor');
    }

    if (request.fromReferralCode && request.source !== 'self') {
      await this.history.save(
        this.history.create({
          patientId: patient.userId,
          referralCode: request.fromReferralCode,
          doctorId: request.fromDoctorId,
          source: request.source === 'internal' ? 'internal' : 'change',
        }),
      );
    }

    patient.doctorId = toDoctor.userId;
    await this.patients.save(patient);

    request.status = 'accepted';
    request.resolvedAt = new Date();
    await this.requests.save(request);
  }

  private async expireIfNeeded(request: DocIdRequest): Promise<boolean> {
    if (request.status !== 'pending') {
      return false;
    }
    if (request.expiresAt.getTime() >= Date.now()) {
      return false;
    }
    request.status = 'rejected';
    request.resolvedAt = new Date();
    await this.requests.save(request);
    return true;
  }

  private async requirePatient(patientId: string): Promise<PatientProfile> {
    const patient = await this.patients.findOne({
      where: { userId: patientId },
      relations: ['user', 'doctor', 'doctor.user'],
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    return patient;
  }

  private async requireDoctorByCode(rawCode: string): Promise<DoctorProfile> {
    const referralCode = rawCode.trim().toUpperCase();
    if (!isValidReferralCode(referralCode)) {
      throw new BadRequestException('DocID must be 6 characters: 3 letters and 3 digits');
    }
    const doctor = await this.doctors.findOne({
      where: { referralCode },
      relations: ['user'],
    });
    if (!doctor) {
      throw new NotFoundException('No doctor found for that DocID');
    }
    return doctor;
  }

  private async requireByToken(token: string): Promise<DocIdRequest> {
    const tokenHash = hashToken(token.trim());
    const request = await this.requests.findOne({
      where: { tokenHash },
      relations: ['patient', 'patient.user', 'toDoctor', 'toDoctor.user', 'fromDoctor'],
    });
    if (!request) {
      throw new NotFoundException('Confirmation link is invalid');
    }
    return request;
  }

  private toPendingView(request: DocIdRequest): PendingDocIdView {
    return {
      id: request.id,
      source: request.source,
      targetReferralCode: request.toDoctor.referralCode,
      targetDoctorName: request.toDoctor.user.name,
      fromReferralCode: request.fromReferralCode,
      recipientRole: request.source === 'internal' ? 'patient' : 'doctor',
      expiresAt: request.expiresAt.toISOString(),
    };
  }

  private toPreview(request: DocIdRequest): DocIdRequestPreview {
    return {
      ...this.toPendingView(request),
      patientName: request.patient.user.name,
      status: request.status,
    };
  }

  private ttlMs(): number {
    const hours = Number(this.config.get<string>('DOC_ID_REQUEST_TTL_HOURS') || DEFAULT_TTL_HOURS);
    const safe = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_TTL_HOURS;
    return safe * 60 * 60 * 1000;
  }

  private buildMail(input: {
    source: DocIdRequestSource;
    recipientRole: 'doctor' | 'patient';
    patientName: string;
    patientEmail: string;
    doctorName: string;
    targetReferralCode: string;
    fromReferralCode: string | null;
    confirmUrl: string;
    rejectUrl: string;
  }): { subject: string; text: string; html: string } {
    if (input.source === 'self' || input.source === 'change') {
      const switching = input.source === 'change' && input.fromReferralCode;
      const subject = switching
        ? `Patient requests to switch to your clinic (DocID ${input.targetReferralCode})`
        : `Patient requests to join your clinic (DocID ${input.targetReferralCode})`;
      const detail = switching
        ? `${input.patientName} is currently on DocID ${input.fromReferralCode} and wants to switch to your DocID ${input.targetReferralCode}.`
        : `${input.patientName} wants to attach to your DocID ${input.targetReferralCode}.`;
      const text = [detail, `Confirm: ${input.confirmUrl}`, `Reject: ${input.rejectUrl}`].join('\n');
      return {
        subject,
        text,
        html: this.htmlShell(
          subject,
          `<p><strong>${escapeHtml(input.patientName)}</strong> ${
            switching
              ? `is currently on DocID <strong>${escapeHtml(input.fromReferralCode || '')}</strong> and wants to switch to your DocID`
              : 'wants to attach to your DocID'
          } <strong>${escapeHtml(input.targetReferralCode)}</strong>.</p>
           <p>If you confirm, they will appear on your patient list. You can then prescribe modules.</p>`,
          input.confirmUrl,
          input.rejectUrl,
        ),
      };
    }

    const fromBit = input.fromReferralCode
      ? `from DocID ${input.fromReferralCode} to DocID ${input.targetReferralCode}`
      : `to DocID ${input.targetReferralCode}`;
    const subject = `Confirm doctor transfer to ${input.targetReferralCode}`;
    const text = [
      `An administrator requested transferring you ${fromBit} (Dr. ${input.doctorName}).`,
      `Confirm: ${input.confirmUrl}`,
      `Reject: ${input.rejectUrl}`,
    ].join('\n');
    return {
      subject,
      text,
      html: this.htmlShell(
        subject,
        `<p>An administrator requested transferring you <strong>${escapeHtml(fromBit)}</strong> (Dr. ${escapeHtml(input.doctorName)}).</p>
         <p>Nothing changes until you confirm.</p>`,
        input.confirmUrl,
        input.rejectUrl,
      ),
    };
  }

  private htmlShell(title: string, body: string, confirmUrl: string, rejectUrl: string): string {
    return `<!doctype html>
<html><body style="font-family:sans-serif;line-height:1.5;color:#111;padding:24px">
  <h2 style="margin:0 0 16px">${escapeHtml(title)}</h2>
  ${body}
  <p style="margin:24px 0">
    <a href="${confirmUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:700">Confirm</a>
    <a href="${rejectUrl}" style="display:inline-block;margin-left:8px;background:#f3f4f6;color:#111;text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:700">Reject</a>
  </p>
  <p style="font-size:12px;color:#6b7280">If the buttons do not work, copy these links:<br/>${escapeHtml(confirmUrl)}<br/>${escapeHtml(rejectUrl)}</p>
</body></html>`;
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
