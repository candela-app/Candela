import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from '../entities/announcement.entity';
import { UserAnnouncementRead } from '../entities/user-announcement-read.entity';
import { User } from '../entities/user.entity';
import { Organization } from '../entities/organization.entity';
import { AnnouncementsService } from './announcements.service';
import {
  SuperAdminAnnouncementsController,
  SuperAdminRecipientsController,
  UserAnnouncementsController,
} from './announcements.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Announcement,
      UserAnnouncementRead,
      User,
      Organization,
    ]),
  ],
  controllers: [
    SuperAdminAnnouncementsController,
    SuperAdminRecipientsController,
    UserAnnouncementsController,
  ],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
