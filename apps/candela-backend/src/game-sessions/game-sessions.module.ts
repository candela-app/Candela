import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameSession } from '../entities/game-session.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { DoctorGameSessionsController, PatientGameSessionsController } from './game-sessions.controller';
import { GameSessionsService } from './game-sessions.service';

@Module({
  imports: [TypeOrmModule.forFeature([GameSession, PatientProfile])],
  controllers: [PatientGameSessionsController, DoctorGameSessionsController],
  providers: [GameSessionsService],
})
export class GameSessionsModule {}
