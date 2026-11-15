import { Controller, Get, Inject, Param, Patch, Post, Req } from '@nestjs/common';
import { Body } from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '../common/current-user.decorator';
import { Public, Roles } from '../common/decorators';
import { User } from '../entities/user.entity';
import { InviteDoctorDto, SetPrimaryOrganizationDto, UpdateMembershipStatusDto } from './memberships.dto';
import { MembershipsService } from './memberships.service';
import { readOrganizationScopeHeader, requireOrganizationScopeHeader } from './organization-scope';

@Controller('api/me')
export class MeOrganizationsController {
  constructor(@Inject(MembershipsService) private readonly memberships: MembershipsService) {}

  @Get('organizations')
  @Roles('doctor')
  listMine(@CurrentUser() user: User) {
    return this.memberships.listMyOrganizations(user.id);
  }

  @Post('organizations/primary')
  @Roles('doctor')
  setPrimary(@CurrentUser() user: User, @Body() dto: SetPrimaryOrganizationDto) {
    return this.memberships.setPrimary(user.id, dto.organizationId);
  }

  /** Validates X-Organization-Id against an active membership for the calling doctor. */
  @Get('organizations/active-scope')
  @Roles('doctor')
  async validateScope(@CurrentUser() user: User, @Req() req: Request) {
    const organizationId = requireOrganizationScopeHeader(req);
    const membership = await this.memberships.assertActiveMembership(user.id, organizationId);
    return {
      organizationId: membership.organizationId,
      organizationName: membership.organization?.name ?? null,
      isPrimary: membership.isPrimary,
      header: readOrganizationScopeHeader(req),
    };
  }
}

@Controller('api/organizations')
export class OrganizationMembershipsController {
  constructor(@Inject(MembershipsService) private readonly memberships: MembershipsService) {}

  @Get(':id/memberships')
  @Roles('super_admin', 'admin')
  list(@CurrentUser() user: User, @Param('id') id: string) {
    return this.memberships.listOrganizationMemberships(user, id);
  }

  @Post(':id/memberships/invitations')
  @Roles('super_admin', 'admin')
  invite(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: InviteDoctorDto) {
    return this.memberships.inviteDoctor(user, id, dto);
  }

  @Patch(':id/memberships/:doctorId')
  @Roles('super_admin', 'admin')
  updateStatus(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('doctorId') doctorId: string,
    @Body() dto: UpdateMembershipStatusDto,
  ) {
    return this.memberships.updateMembershipStatus(user, id, doctorId, dto);
  }
}

@Controller('api/doctor-organization-invitations')
export class DoctorOrganizationInvitationsController {
  constructor(@Inject(MembershipsService) private readonly memberships: MembershipsService) {}

  /** Safe preview — does not activate membership. */
  @Public()
  @Get(':token/preview')
  preview(@Param('token') token: string) {
    return this.memberships.previewInvitationByToken(token);
  }

  /** Authenticated invitee only. */
  @Roles('doctor')
  @Post(':token/accept')
  accept(@CurrentUser() user: User, @Param('token') token: string) {
    return this.memberships.acceptInvitationByToken(user, token);
  }

  /** Authenticated invitee only. */
  @Roles('doctor')
  @Post(':token/decline')
  decline(@CurrentUser() user: User, @Param('token') token: string) {
    return this.memberships.declineInvitationByToken(user, token);
  }
}
