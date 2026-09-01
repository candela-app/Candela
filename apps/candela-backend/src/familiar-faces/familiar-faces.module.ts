import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FamiliarFace } from '../entities/familiar-face.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { FamiliarFacesController } from './familiar-faces.controller';
import { FamiliarFacesService } from './familiar-faces.service';
import { SupabaseStorageService } from './supabase-storage';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([FamiliarFace, PatientProfile])],
  controllers: [FamiliarFacesController],
  providers: [SupabaseStorageService, FamiliarFacesService],
})
export class FamiliarFacesModule {}
