import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocIdHistory } from '../entities/docid-history.entity';
import { DocIdRequest } from '../entities/docid-request.entity';
import { DoctorProfile } from '../entities/doctor-profile.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { User } from '../entities/user.entity';
import { MailModule } from '../mail/mail.module';
import { DocIdController } from './docid.controller';
import { DocIdService } from './docid.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocIdRequest, DocIdHistory, DoctorProfile, PatientProfile, User]),
    MailModule,
  ],
  controllers: [DocIdController],
  providers: [DocIdService],
  exports: [DocIdService],
})
export class DocIdModule {}
