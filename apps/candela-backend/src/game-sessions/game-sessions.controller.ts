import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/decorators';
import { User } from '../entities/user.entity';
import { CreateGameSessionDto, GameSessionQueryDto } from './game-sessions.dto';
import { GameSessionsService } from './game-sessions.service';

@Controller('api/game-sessions')
@Roles('patient')
export class PatientGameSessionsController {
  constructor(@Inject(GameSessionsService) private readonly sessions: GameSessionsService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateGameSessionDto) {
    return this.sessions.createForPatient(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: User, @Query() query: GameSessionQueryDto) {
    return this.sessions.listForPatient(user.id, query);
  }
}

@Controller('api/doctors/me/patients/:patientId/game-sessions')
@Roles('doctor')
export class DoctorGameSessionsController {
  constructor(@Inject(GameSessionsService) private readonly sessions: GameSessionsService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Param('patientId') patientId: string,
    @Query() query: GameSessionQueryDto,
  ) {
    return this.sessions.listForDoctor(user.id, patientId, query);
  }
}
