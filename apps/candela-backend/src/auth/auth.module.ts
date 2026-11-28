import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { DoctorOrganizationMembership } from '../entities/doctor-organization-membership.entity';
import { DocIdRequest } from '../entities/docid-request.entity';
import { DoctorProfile } from '../entities/doctor-profile.entity';
import { GameSession } from '../entities/game-session.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { GoogleInvitationChallenge } from '../entities/google-invitation-challenge.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { Prescription } from '../entities/prescription.entity';
import { PrescriptionRevision } from '../entities/prescription-revision.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { User } from '../entities/user.entity';
import { Organization } from '../entities/organization.entity';
import { EmergencyAuditModule } from '../audit/emergency-audit.module';
import { DocIdModule } from '../docid/docid.module';
import { MailModule } from '../mail/mail.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { PrescriptionAnalyticsService } from '../prescriptions/prescription-analytics.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DoctorAnalyticsService } from './doctor-analytics.service';
import { DoctorDashboardService } from './doctor-dashboard.service';
import { GoogleAuthService } from './google-auth.service';
import { AdminController, DoctorController, MeController } from './role.controllers';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Organization,
      DoctorProfile,
      DoctorOrganizationMembership,
      DocIdRequest,
      PatientProfile,
      Prescription,
      PrescriptionRevision,
      GameSession,
      RefreshToken,
      PasswordResetToken,
      GoogleInvitationChallenge,
    ]),
    DocIdModule,
    MailModule,
    ProfilesModule,
    MembershipsModule,
    EmergencyAuditModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController, AdminController, DoctorController, MeController],
  providers: [
    AuthService,
    DoctorAnalyticsService,
    DoctorDashboardService,
    PrescriptionAnalyticsService,
    GoogleAuthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
