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
import { UpdateFamiliarFaceDto, UploadFamiliarFaceDto } from './familiar-faces.dto';
import { FamiliarFacesService } from './familiar-faces.service';

@Controller('api/familiar-faces')
@Roles('patient')
export class FamiliarFacesController {
  constructor(@Inject(FamiliarFacesService) private readonly faces: FamiliarFacesService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.faces.list(user.id);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFamiliarFaceDto,
  ) {
    return this.faces.upload(user.id, file, dto.relationLabel);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateFamiliarFaceDto,
  ) {
    return this.faces.updateLabel(user.id, id, dto.relationLabel);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    await this.faces.remove(user.id, id);
    return { ok: true };
  }
}
