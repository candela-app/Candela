import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorOrganizationInvitation } from '../entities/doctor-organization-invitation.entity';
import { DoctorOrganizationMembership } from '../entities/doctor-organization-membership.entity';
import { DoctorProfile } from '../entities/doctor-profile.entity';
import { Organization } from '../entities/organization.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { User } from '../entities/user.entity';
import { MailModule } from '../mail/mail.module';
import {
  DoctorOrganizationInvitationsController,
  MeOrganizationsController,
  OrganizationMembershipsController,
} from './memberships.controller';
import { MembershipsService } from './memberships.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DoctorOrganizationMembership,
      DoctorOrganizationInvitation,
      DoctorProfile,
      Organization,
      User,
      PatientProfile,
    ]),
    MailModule,
  ],
  controllers: [
    MeOrganizationsController,
    OrganizationMembershipsController,
    DoctorOrganizationInvitationsController,
  ],
  providers: [MembershipsService],
  exports: [MembershipsService],
})
export class MembershipsModule {}
