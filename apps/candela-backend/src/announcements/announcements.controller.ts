import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { Public, Roles } from '../common/decorators';
import { User } from '../entities/user.entity';
import { AnnouncementsService } from './announcements.service';
import type { CreateAnnouncementDto } from '@candela/shared';

@Controller('api/super-admin/announcements')
@Roles('super_admin')
export class SuperAdminAnnouncementsController {
  constructor(
    @Inject(AnnouncementsService)
    private readonly announcementsService: AnnouncementsService,
  ) {}

  @Get()
  listAll() {
    return this.announcementsService.listAllAnnouncements();
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateAnnouncementDto) {
    return this.announcementsService.createAnnouncement(dto, user.id);
  }

  @Patch(':id/toggle-active')
  toggleActive(@Param('id') id: string) {
    return this.announcementsService.toggleActive(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateAnnouncementDto>,
  ) {
    return this.announcementsService.updateAnnouncement(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.announcementsService.deleteAnnouncement(id);
  }
}

@Controller('api/super-admin')
@Roles('super_admin')
export class SuperAdminRecipientsController {
  constructor(
    @Inject(AnnouncementsService)
    private readonly announcementsService: AnnouncementsService,
  ) {}

  @Get('recipients-search')
  searchRecipients(
    @Query('q') query: string,
    @Query('type') type?: 'hospital' | 'user',
  ) {
    return this.announcementsService.searchRecipients(query, type);
  }
}

@Controller('api/announcements')
export class UserAnnouncementsController {
  constructor(
    @Inject(AnnouncementsService)
    private readonly announcementsService: AnnouncementsService,
  ) {}

  @Get('public')
  @Public()
  getPublicActive() {
    return this.announcementsService.getPublicActive();
  }

  @Get('my-active')
  getMyActive(@CurrentUser() user: User) {
    return this.announcementsService.getActiveForUser(user);
  }

  @Post(':id/read')
  markRead(@CurrentUser() user: User, @Param('id') id: string) {
    return this.announcementsService.markRead(id, user.id);
  }

  @Post(':id/dismiss')
  markDismissed(@CurrentUser() user: User, @Param('id') id: string) {
    return this.announcementsService.markDismissed(id, user.id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: User) {
    return this.announcementsService.markAllRead(user.id);
  }
}
