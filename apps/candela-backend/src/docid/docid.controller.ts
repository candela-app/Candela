import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { Public, Roles } from '../common/decorators';
import { User } from '../entities/user.entity';
import { RequestDocIdDto, TransferDocIdDto } from './docid.dto';
import { DocIdService } from './docid.service';

@Controller('api/docid')
export class DocIdController {
  constructor(@Inject(DocIdService) private readonly docid: DocIdService) {}

  @Roles('patient')
  @Post('requests')
  requestAttach(@CurrentUser() user: User, @Body() dto: RequestDocIdDto) {
    return this.docid.requestByPatient(user, dto.referralCode);
  }

  @Roles('admin')
  @Post('transfers')
  requestTransfer(@Body() dto: TransferDocIdDto) {
    return this.docid.requestByAdmin(dto.patientId, dto.referralCode);
  }

  @Roles('doctor')
  @Get('incoming')
  listIncoming(@CurrentUser() user: User) {
    return this.docid.listIncomingForDoctor(user.id);
  }

  @Public()
  @Get('requests/token/:token')
  previewByToken(@Param('token') token: string) {
    return this.docid.previewByToken(token);
  }

  @Public()
  @Post('requests/token/:token/accept')
  acceptByToken(@Param('token') token: string) {
    return this.docid.settleByToken(token, true);
  }

  @Public()
  @Post('requests/token/:token/reject')
  rejectByToken(@Param('token') token: string) {
    return this.docid.settleByToken(token, false);
  }

  @Post('requests/:id/accept')
  acceptMine(@CurrentUser() user: User, @Param('id') id: string) {
    return this.docid.settleAsRecipient(user, id, true);
  }

  @Post('requests/:id/reject')
  rejectMine(@CurrentUser() user: User, @Param('id') id: string) {
    return this.docid.settleAsRecipient(user, id, false);
  }
}
