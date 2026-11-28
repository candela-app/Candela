import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { CaseloadAnalyticsQueryDto, DoctorAnalyticsService } from '../auth/doctor-analytics.service';
import { DoctorDashboardService } from '../auth/doctor-dashboard.service';
import { EmergencyAuditService } from '../audit/emergency-audit.service';
import { PrescriptionAnalyticsService, PrescriptionPeriodQueryDto } from '../prescriptions/prescription-analytics.service';
import { CreateAccountDto, CreatePatientDto, AddPrescriptionDto, UpdateDoctorDto } from '../auth/dto';
import { isTherapyModuleId } from '../common/catalog';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/decorators';
import { readEmergencyReason, requireEmergencyReason } from '../common/emergency-access';
import { User } from '../entities/user.entity';
import { RepairPatientOrganizationDto } from '../docid/docid.dto';
import { MembershipsService } from '../memberships/memberships.service';
import { requireOrganizationScopeHeader } from '../memberships/organization-scope';
import { ProfilesService } from '../profiles/profiles.service';

@Controller('api/admin')
@Roles('super_admin', 'admin')
export class AdminController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(MembershipsService) private readonly memberships: MembershipsService,
    @Inject(EmergencyAuditService) private readonly emergencyAudit: EmergencyAuditService,
  ) {}

  private async withSaEmergency<T>(
    user: User,
    req: Request,
    meta: {
      action: string;
      resourceType: string;
      resourceId?: string | null;
      organizationId?: string | null;
      notify?: boolean;
    },
    run: () => Promise<T>,
  ): Promise<T> {
    if (user.role !== 'super_admin') {
      return run();
    }
    const reason = requireEmergencyReason(user, readEmergencyReason(req));
    try {
      const result = await run();
      await this.emergencyAudit.record({
        actor: user,
        organizationId: meta.organizationId,
        resourceType: meta.resourceType,
        resourceId: meta.resourceId,
        action: meta.action,
        reason,
        outcome: 'success',
        notifyHospitalAdmins: Boolean(meta.notify && meta.organizationId),
      });
      return result;
    } catch (err) {
      await this.emergencyAudit.record({
        actor: user,
        organizationId: meta.organizationId,
        resourceType: meta.resourceType,
        resourceId: meta.resourceId,
        action: meta.action,
        reason,
        outcome: 'failure',
        errorMessage: err instanceof Error ? err.message : 'failed',
      });
      throw err;
    }
  }

  @Post('doctors')
  createDoctor(@CurrentUser() user: User, @Req() req: Request, @Body() dto: CreateAccountDto) {
    return this.withSaEmergency(
      user,
      req,
      {
        action: 'create_doctor',
        resourceType: 'doctor',
        organizationId: user.organizationId,
        notify: true,
      },
      () => this.auth.createDoctor(dto, user.organizationId),
    );
  }

  @Get('doctors')
  listDoctors(@CurrentUser() user: User, @Req() req: Request) {
    return this.withSaEmergency(
      user,
      req,
      { action: 'list_doctors', resourceType: 'doctor' },
      () => this.auth.listDoctors(user.role === 'super_admin' ? null : user.organizationId),
    );
  }

  @Patch('doctors/:id')
  updateDoctor(
    @CurrentUser() user: User,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateDoctorDto,
  ) {
    return this.withSaEmergency(
      user,
      req,
      { action: 'update_doctor', resourceType: 'doctor', resourceId: id, notify: true },
      () => this.auth.updateDoctor(user, id, dto),
    );
  }

  @Delete('doctors/:id')
  deleteDoctor(@CurrentUser() user: User, @Req() req: Request, @Param('id') id: string) {
    return this.withSaEmergency(
      user,
      req,
      { action: 'delete_doctor', resourceType: 'doctor', resourceId: id, notify: true },
      () => this.auth.deleteDoctor(user, id),
    );
  }

  @Get('patients')
  listPatients(@CurrentUser() user: User, @Req() req: Request) {
    return this.withSaEmergency(
      user,
      req,
      { action: 'list_patients', resourceType: 'patient' },
      () => this.auth.listAllPatients(user.role === 'super_admin' ? null : user.organizationId),
    );
  }

  /** Ownership repair — admin may only set their own organisation; no primary fallback. */
  @Post('patients/:patientId/organization')
  repairPatientOrganization(
    @CurrentUser() user: User,
    @Req() req: Request,
    @Param('patientId') patientId: string,
    @Body() dto: RepairPatientOrganizationDto,
  ) {
    return this.withSaEmergency(
      user,
      req,
      {
        action: 'repair_patient_organization',
        resourceType: 'patient',
        resourceId: patientId,
        organizationId: dto.organizationId,
        notify: true,
      },
      () => this.memberships.repairPatientOrganization(user, patientId, dto.organizationId),
    );
  }

  @Post('patients/:patientId/invitations/resend')
  resendPatientInvitation(
    @CurrentUser() user: User,
    @Req() req: Request,
    @Param('patientId') patientId: string,
  ) {
    return this.withSaEmergency(
      user,
      req,
      { action: 'resend_patient_invitation', resourceType: 'patient', resourceId: patientId },
      () => this.auth.resendPatientInvitation(user, patientId),
    );
  }
}


@Controller('api/doctors/me')
@Roles('doctor')
export class DoctorController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(DoctorAnalyticsService) private readonly doctorAnalytics: DoctorAnalyticsService,
    @Inject(DoctorDashboardService) private readonly dashboard: DoctorDashboardService,
    @Inject(PrescriptionAnalyticsService) private readonly prescriptionAnalytics: PrescriptionAnalyticsService,
    @Inject(ProfilesService) private readonly profiles: ProfilesService,
  ) {}

  @Get('analytics/caseload')
  getCaseloadAnalytics(
    @CurrentUser() user: User,
    @Query() query: CaseloadAnalyticsQueryDto,
  ) {
    return this.doctorAnalytics.getCaseload(user.id, query);
  }

  @Get('dashboard-summary')
  getDashboardSummary(@CurrentUser() user: User, @Query('timeZone') timeZone?: string) {
    return this.dashboard.getSummary(user.id, timeZone);
  }

  @Post('patients')
  createPatient(@CurrentUser() user: User, @Req() req: Request, @Body() dto: CreatePatientDto) {
    const organizationId = requireOrganizationScopeHeader(req);
    return this.auth.createDoctorPatient(user.id, dto, organizationId);
  }

  @Post('patients/:patientId/invitations/resend')
  resendPatientInvitation(@CurrentUser() user: User, @Param('patientId') patientId: string) {
    return this.auth.resendPatientInvitation(user, patientId);
  }

  @Get('patients/:patientId/profile')
  getPatientProfile(@CurrentUser() user: User, @Param('patientId') patientId: string) {
    return this.profiles.getPatientProfileForDoctor(user.id, patientId);
  }

  @Get('patients')
  listPatients(@CurrentUser() user: User) {
    return this.auth.listDoctorPatients(user.id);
  }

  @Get('patients/:patientId/assignments')
  getPatientAssignments(@CurrentUser() user: User, @Param('patientId') patientId: string) {
    return this.doctorAnalytics.getPatientAssignments(user.id, patientId);
  }

  @Get('patients/:patientId/prescription-analytics')
  async readPrescriptionAnalytics(
    @CurrentUser() user: User,
    @Param('patientId') patientId: string,
    @Query() query: PrescriptionPeriodQueryDto,
  ) {
    const analytics = await this.prescriptionAnalytics.forDoctor(user.id, patientId, query);
    if (!analytics) {
      throw new NotFoundException('Patient not found');
    }
    return analytics;
  }

  @Get('patients/:id')
  async getPatient(@CurrentUser() user: User, @Param('id') id: string) {
    const patient = await this.auth.getOwnedPatient(user.id, id);
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    return patient;
  }

  @Post('patients/:patientId/prescriptions')
  async addPrescription(
    @CurrentUser() user: User,
    @Param('patientId') patientId: string,
    @Body() body: AddPrescriptionDto,
  ) {
    if (!body?.moduleId || !isTherapyModuleId(body.moduleId)) {
      throw new BadRequestException(`Unknown therapy module: ${body?.moduleId ?? '(missing)'}`);
    }
    const patient = await this.auth.addPrescription(user.id, patientId, body.moduleId, body.levels);
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    return patient;
  }

  @Delete('patients/:patientId/prescriptions/:moduleId')
  async removePrescription(
    @CurrentUser() user: User,
    @Param('patientId') patientId: string,
    @Param('moduleId') moduleId: string,
  ) {
    const patient = await this.auth.removePrescription(user.id, patientId, moduleId);
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    return patient;
  }
}

@Controller('api/me')
export class MeController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(PrescriptionAnalyticsService) private readonly prescriptionAnalytics: PrescriptionAnalyticsService,
  ) {}

  @Get()
  me(@CurrentUser() user: User) {
    return this.auth.getSession(user);
  }

  @Get('prescription-practice')
  prescriptionPractice(@CurrentUser() user: User, @Query() query: PrescriptionPeriodQueryDto) {
    return this.prescriptionAnalytics.forPatient(user, query);
  }

  @Get('modules')
  async modules(@CurrentUser() user: User) {
    const session = await this.auth.getSession(user);
    return { allowedModuleIds: session.allowedModuleIds };
  }
}
