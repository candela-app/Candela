import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmergencyAuditLog } from '../entities/emergency-audit-log.entity';
import { User } from '../entities/user.entity';
import { MailModule } from '../mail/mail.module';
import { EmergencyAuditService } from './emergency-audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([EmergencyAuditLog, User]), MailModule],
  providers: [EmergencyAuditService],
  exports: [EmergencyAuditService],
})
export class EmergencyAuditModule {}
