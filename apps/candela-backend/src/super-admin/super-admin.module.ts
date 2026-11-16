import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmergencyAuditModule } from '../audit/emergency-audit.module';
import { AuthModule } from '../auth/auth.module';
import { Organization } from '../entities/organization.entity';
import { User } from '../entities/user.entity';
import { DoctorProfile } from '../entities/doctor-profile.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { GameSession } from '../entities/game-session.entity';
import { MembershipsModule } from '../memberships/memberships.module';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      User,
      DoctorProfile,
      PatientProfile,
      GameSession,
    ]),
    MembershipsModule,
    EmergencyAuditModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [SuperAdminController],
  providers: [SuperAdminService],
  exports: [SuperAdminService],
})
export class SuperAdminModule {}
