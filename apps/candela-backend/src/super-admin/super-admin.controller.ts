import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { SuperAdminService } from './super-admin.service';
import { CreateOrganizationDto } from '../auth/dto';

@Controller('api/super-admin')
@Roles('super_admin')
export class SuperAdminController {
  constructor(
    @Inject(SuperAdminService)
    private readonly superAdmin: SuperAdminService,
  ) {}

  @Get('organizations')
  listOrganizations() {
    return this.superAdmin.listOrganizations();
  }

  @Post('organizations')
  createOrganization(@Body() dto: CreateOrganizationDto) {
    return this.superAdmin.createOrganization(dto);
  }

  @Get('self-users')
  listSelfUsers() {
    return this.superAdmin.listSelfUsers();
  }

  @Get('metrics')
  getMetrics() {
    return this.superAdmin.getMetrics();
  }
}
