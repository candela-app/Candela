import { Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { CreateOrganizationDto } from '../auth/dto';
import { EmergencyAuditService } from '../audit/emergency-audit.service';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/decorators';
import { readEmergencyReason, requireEmergencyReason } from '../common/emergency-access';
import { RepairPatientOrganizationDto } from '../docid/docid.dto';
import { User } from '../entities/user.entity';
import { MembershipsService } from '../memberships/memberships.service';
import { SuperAdminService } from './super-admin.service';

@Controller('api/super-admin')
@Roles('super_admin')
export class SuperAdminController {
  constructor(
    @Inject(SuperAdminService)
    private readonly superAdmin: SuperAdminService,
    @Inject(MembershipsService) private readonly memberships: MembershipsService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(EmergencyAuditService) private readonly emergencyAudit: EmergencyAuditService,
  ) {}

  /** Platform operation — no emergency reason. */
  @Get('organizations')
  listOrganizations() {
    return this.superAdmin.listOrganizations();
  }

  /** Sensitive: org doctor/patient identity — emergency reason required. */
  @Get('organizations/:id')
  async getOrganizationDetail(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const reason = requireEmergencyReason(user, readEmergencyReason(req));
    try {
      const detail = await this.superAdmin.getOrganizationDetail(id);
      await this.emergencyAudit.record({
        actor: user,
        organizationId: id,
        resourceType: 'organization',
        resourceId: id,
        action: 'view_organization_detail',
        reason,
        outcome: 'success',
        after: {
          doctorCount: detail.doctors?.length ?? 0,
          patientCount: detail.patients?.length ?? 0,
        },
      });
      return detail;
    } catch (err) {
      await this.emergencyAudit.record({
        actor: user,
        organizationId: id,
        resourceType: 'organization',
        resourceId: id,
        action: 'view_organization_detail',
        reason,
        outcome: 'failure',
        errorMessage: err instanceof Error ? err.message : 'failed',
      });
      throw err;
    }
  }

  /** Platform operation — no emergency reason. */
  @Post('organizations')
  createOrganization(@Body() dto: CreateOrganizationDto) {
    return this.superAdmin.createOrganization(dto);
  }

  /** Sensitive: self-user identity listing — emergency reason required. */
  @Get('self-users')
  async listSelfUsers(@CurrentUser() user: User, @Req() req: Request) {
    const reason = requireEmergencyReason(user, readEmergencyReason(req));
    const rows = await this.superAdmin.listSelfUsers();
    await this.emergencyAudit.record({
      actor: user,
      resourceType: 'self_users',
      action: 'list_self_users',
      reason,
      outcome: 'success',
      after: { count: rows.length },
    });
    return rows;
  }

  /** Platform operation — no emergency reason. */
  @Get('metrics')
  getMetrics() {
    return this.superAdmin.getMetrics();
  }

  /** Sensitive mutation — emergency reason + hospital admin notification. */
  @Post('patients/:patientId/organization')
  async repairPatientOrganization(
    @CurrentUser() user: User,
    @Param('patientId') patientId: string,
    @Body() dto: RepairPatientOrganizationDto,
    @Req() req: Request,
  ) {
    const reason = requireEmergencyReason(user, readEmergencyReason(req));
    try {
      const result = await this.memberships.repairPatientOrganization(
        user,
        patientId,
        dto.organizationId,
      );
      await this.emergencyAudit.record({
        actor: user,
        organizationId: dto.organizationId,
        resourceType: 'patient',
        resourceId: patientId,
        action: 'repair_patient_organization',
        reason,
        outcome: 'success',
        after: { organizationId: dto.organizationId },
        notifyHospitalAdmins: true,
      });
      return result;
    } catch (err) {
      await this.emergencyAudit.record({
        actor: user,
        organizationId: dto.organizationId,
        resourceType: 'patient',
        resourceId: patientId,
        action: 'repair_patient_organization',
        reason,
        outcome: 'failure',
        errorMessage: err instanceof Error ? err.message : 'failed',
        notifyHospitalAdmins: false,
      });
      throw err;
    }
  }

  /** Sensitive mutation — emergency reason required. */
  @Post('patients/:patientId/invitations/resend')
  async resendPatientInvitation(
    @CurrentUser() user: User,
    @Param('patientId') patientId: string,
    @Req() req: Request,
  ) {
    const reason = requireEmergencyReason(user, readEmergencyReason(req));
    try {
      const result = await this.auth.resendPatientInvitation(user, patientId);
      await this.emergencyAudit.record({
        actor: user,
        resourceType: 'patient',
        resourceId: patientId,
        action: 'resend_patient_invitation',
        reason,
        outcome: 'success',
        after: { emailSent: result.emailSent },
      });
      return result;
    } catch (err) {
      await this.emergencyAudit.record({
        actor: user,
        resourceType: 'patient',
        resourceId: patientId,
        action: 'resend_patient_invitation',
        reason,
        outcome: 'failure',
        errorMessage: err instanceof Error ? err.message : 'failed',
      });
      throw err;
    }
  }
}
