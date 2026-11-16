import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorProfile } from '../entities/doctor-profile.entity';
import { Organization } from '../entities/organization.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { User } from '../entities/user.entity';
import { FamiliarFacesModule } from '../familiar-faces/familiar-faces.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { ProfileMediaService } from './profile-media.service';
import { MeProfileController, OrganizationProfileController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, PatientProfile, DoctorProfile, Organization]),
    forwardRef(() => MembershipsModule),
    FamiliarFacesModule,
  ],
  controllers: [MeProfileController, OrganizationProfileController],
  providers: [ProfilesService, ProfileMediaService],
  exports: [ProfilesService, ProfileMediaService],
})
export class ProfilesModule {}
