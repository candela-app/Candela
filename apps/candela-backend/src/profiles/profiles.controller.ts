import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/decorators';
import { User } from '../entities/user.entity';
import { ProfileMediaService } from './profile-media.service';
import { PatchMeProfileDto, PatchOrganizationProfileDto } from './profiles.dto';
import { ProfilesService } from './profiles.service';

type UploadedPhoto = {
  buffer: Buffer;
  size: number;
  mimetype: string;
};

@Controller('api/me')
export class MeProfileController {
  constructor(
    @Inject(ProfilesService) private readonly profiles: ProfilesService,
    @Inject(ProfileMediaService) private readonly media: ProfileMediaService,
  ) {}

  @Get('profile')
  getProfile(@CurrentUser() user: User) {
    return this.profiles.getMeProfile(user);
  }

  @Patch('profile')
  patchProfile(@CurrentUser() user: User, @Body() dto: PatchMeProfileDto) {
    return this.profiles.patchMeProfile(user, dto);
  }

  @Post('profile/complete')
  completeProfile(@CurrentUser() user: User) {
    return this.profiles.completeMeProfile(user);
  }

  @Post('profile/photo')
  @Roles('patient', 'doctor')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadPhoto(@CurrentUser() user: User, @UploadedFile() file: UploadedPhoto | undefined) {
    return this.media.uploadMePhoto(user, file);
  }

  @Delete('profile/photo')
  @Roles('patient', 'doctor')
  deletePhoto(@CurrentUser() user: User) {
    return this.media.deleteMePhoto(user);
  }
}

@Controller('api/organizations')
export class OrganizationProfileController {
  constructor(
    @Inject(ProfilesService) private readonly profiles: ProfilesService,
    @Inject(ProfileMediaService) private readonly media: ProfileMediaService,
  ) {}

  @Get(':id/profile')
  getProfile(@CurrentUser() user: User, @Param('id') id: string) {
    return this.profiles.getOrganizationProfile(user, id);
  }

  @Patch(':id/profile')
  @Roles('super_admin', 'admin')
  patchProfile(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: PatchOrganizationProfileDto,
  ) {
    return this.profiles.patchOrganizationProfile(user, id, dto);
  }

  @Post(':id/profile/complete')
  @Roles('super_admin', 'admin')
  completeProfile(@CurrentUser() user: User, @Param('id') id: string) {
    return this.profiles.completeOrganizationProfile(user, id);
  }

  @Post(':id/profile/logo')
  @Roles('super_admin', 'admin')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadLogo(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @UploadedFile() file: UploadedPhoto | undefined,
  ) {
    return this.media.uploadOrganizationLogo(user, id, file);
  }

  @Delete(':id/profile/logo')
  @Roles('super_admin', 'admin')
  deleteLogo(@CurrentUser() user: User, @Param('id') id: string) {
    return this.media.deleteOrganizationLogo(user, id);
  }
}
