import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { CreateAccountDto, AddPrescriptionDto, UpdateDoctorDto } from '../auth/dto';
import { isTherapyModuleId } from '../common/catalog';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/decorators';
import { User } from '../entities/user.entity';

@Controller('api/admin')
@Roles('admin')
export class AdminController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('doctors')
  createDoctor(@Body() dto: CreateAccountDto) {
    return this.auth.createDoctor(dto);
  }

  @Get('doctors')
  listDoctors() {
    return this.auth.listDoctors();
  }

  @Patch('doctors/:id')
  updateDoctor(@Param('id') id: string, @Body() dto: UpdateDoctorDto) {
    return this.auth.updateDoctor(id, dto);
  }

  @Delete('doctors/:id')
  deleteDoctor(@Param('id') id: string) {
    return this.auth.deleteDoctor(id);
  }

  @Get('patients')
  listPatients() {
    return this.auth.listAllPatients();
  }
}

@Controller('api/doctors/me')
@Roles('doctor')
export class DoctorController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('patients')
  createPatient(@CurrentUser() user: User, @Body() dto: CreateAccountDto) {
    return this.auth.createDoctorPatient(user.id, dto);
  }

  @Get('patients')
  listPatients(@CurrentUser() user: User) {
    return this.auth.listDoctorPatients(user.id);
  }

  @Get('patients/:id')
  async getPatient(@CurrentUser() user: User, @Param('id') id: string) {
    const patient = await this.auth.getOwnedPatient(user.id, id);
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    return patient;
  }

  @Post('patients/:patientId/prescriptions')
  async addPrescription(
    @CurrentUser() user: User,
    @Param('patientId') patientId: string,
    @Body() body: AddPrescriptionDto,
  ) {
    if (!body?.moduleId || !isTherapyModuleId(body.moduleId)) {
      throw new NotFoundException('Unknown therapy module');
    }
    const patient = await this.auth.addPrescription(user.id, patientId, body.moduleId, body.levels);
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    return patient;
  }

  @Delete('patients/:patientId/prescriptions/:moduleId')
  async removePrescription(
    @CurrentUser() user: User,
    @Param('patientId') patientId: string,
    @Param('moduleId') moduleId: string,
  ) {
    const patient = await this.auth.removePrescription(user.id, patientId, moduleId);
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    return patient;
  }
}

@Controller('api/me')
export class MeController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get()
  me(@CurrentUser() user: User) {
    return this.auth.getSession(user);
  }

  @Get('modules')
  async modules(@CurrentUser() user: User) {
    const session = await this.auth.getSession(user);
    return { allowedModuleIds: session.allowedModuleIds };
  }
}
