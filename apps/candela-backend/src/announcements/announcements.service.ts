import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThan, Repository } from 'typeorm';
import { Announcement } from '../entities/announcement.entity';
import { UserAnnouncementRead } from '../entities/user-announcement-read.entity';
import { User } from '../entities/user.entity';
import { Organization } from '../entities/organization.entity';
import type {
  AnnouncementItem,
  CreateAnnouncementDto,
  PublicUser,
  RecipientSearchItem,
} from '@candela/shared';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private readonly announcementsRepo: Repository<Announcement>,
    @InjectRepository(UserAnnouncementRead)
    private readonly readsRepo: Repository<UserAnnouncementRead>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Organization)
    private readonly orgsRepo: Repository<Organization>,
  ) {}

  async createAnnouncement(
    dto: CreateAnnouncementDto,
    createdByUserId: string,
  ): Promise<AnnouncementItem> {
    if (!dto.title?.trim()) {
      throw new BadRequestException('Announcement title is required');
    }
    if (!dto.content?.trim()) {
      throw new BadRequestException('Announcement content is required');
    }

    let targetHospitalIdsStr: string | null = null;
    let targetUserIdsStr: string | null = null;

    if (dto.targetType === 'selected_hospitals') {
      if (!dto.targetHospitalIds || dto.targetHospitalIds.length === 0) {
        throw new BadRequestException('Please select at least one hospital');
      }
      targetHospitalIdsStr = JSON.stringify(dto.targetHospitalIds);
    } else if (dto.targetType === 'selected_users') {
      if (!dto.targetUserIds || dto.targetUserIds.length === 0) {
        throw new BadRequestException('Please select at least one user');
      }
      targetUserIdsStr = JSON.stringify(dto.targetUserIds);
    }

    const created = await this.announcementsRepo.save(
      this.announcementsRepo.create({
        title: dto.title.trim(),
        content: dto.content.trim(),
        priority: dto.priority || 'info',
        targetType: dto.targetType || 'all',
        targetHospitalIds: targetHospitalIdsStr,
        targetUserIds: targetUserIdsStr,
        isActive: dto.isActive ?? true,
        createdByUserId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      }),
    );

    return this.mapToItem(created);
  }

  async listAllAnnouncements(): Promise<AnnouncementItem[]> {
    const list = await this.announcementsRepo.find({
      order: { createdAt: 'DESC' },
    });

    const items: AnnouncementItem[] = [];
    for (const item of list) {
      const mapped = await this.mapToItem(item);
      const readCount = await this.readsRepo.count({
        where: { announcementId: item.id },
      });
      const dismissedCount = await this.readsRepo.count({
        where: {
          announcementId: item.id,
          dismissedAt: MoreThan(new Date(0)),
        },
      });
      mapped.readCount = readCount;
      mapped.dismissedCount = dismissedCount;
      items.push(mapped);
    }

    return items;
  }

  async toggleActive(id: string): Promise<AnnouncementItem> {
    const item = await this.announcementsRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('Announcement not found');
    }
    item.isActive = !item.isActive;
    const updated = await this.announcementsRepo.save(item);
    return this.mapToItem(updated);
  }

  async updateAnnouncement(
    id: string,
    dto: Partial<CreateAnnouncementDto>,
  ): Promise<AnnouncementItem> {
    const item = await this.announcementsRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('Announcement not found');
    }

    if (dto.title !== undefined) {
      if (!dto.title.trim()) {
        throw new BadRequestException('Announcement title is required');
      }
      item.title = dto.title.trim();
    }

    if (dto.content !== undefined) {
      if (!dto.content.trim()) {
        throw new BadRequestException('Announcement content is required');
      }
      item.content = dto.content.trim();
    }

    if (dto.priority !== undefined) {
      item.priority = dto.priority;
    }

    if (dto.targetType !== undefined) {
      item.targetType = dto.targetType;
    }

    const currentTargetType = dto.targetType !== undefined ? dto.targetType : item.targetType;

    if (dto.targetHospitalIds !== undefined || dto.targetType !== undefined) {
      item.targetHospitalIds =
        currentTargetType === 'selected_hospitals' && dto.targetHospitalIds?.length
          ? JSON.stringify(dto.targetHospitalIds)
          : null;
    }

    if (dto.targetUserIds !== undefined || dto.targetType !== undefined) {
      item.targetUserIds =
        currentTargetType === 'selected_users' && dto.targetUserIds?.length
          ? JSON.stringify(dto.targetUserIds)
          : null;
    }

    if (dto.isActive !== undefined) {
      item.isActive = dto.isActive;
    }

    if (dto.expiresAt !== undefined) {
      item.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }

    const saved = await this.announcementsRepo.save(item);
    return this.mapToItem(saved);
  }

  async deleteAnnouncement(id: string): Promise<{ success: boolean }> {
    const item = await this.announcementsRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('Announcement not found');
    }
    await this.announcementsRepo.remove(item);
    return { success: true };
  }

  async searchRecipients(
    query: string,
    type?: 'hospital' | 'user',
  ): Promise<RecipientSearchItem[]> {
    const q = (query || '').trim().toLowerCase();
    const results: RecipientSearchItem[] = [];

    if (!type || type === 'hospital') {
      const orgs = await this.orgsRepo.find({ take: 20 });
      for (const org of orgs) {
        if (!q || org.name.toLowerCase().includes(q) || org.code.toLowerCase().includes(q)) {
          results.push({
            id: org.id,
            label: org.name,
            sublabel: `Code: ${org.code}${org.contactEmail ? ` • ${org.contactEmail}` : ''}`,
            type: 'hospital',
          });
        }
      }
    }

    if (!type || type === 'user') {
      const users = await this.usersRepo.find({ take: 30 });
      for (const user of users) {
        if (
          !q ||
          user.name.toLowerCase().includes(q) ||
          user.email.toLowerCase().includes(q) ||
          user.role.toLowerCase().includes(q)
        ) {
          const roleDisplay =
            user.role === 'super_admin'
              ? 'Super Admin'
              : user.role === 'admin'
              ? 'Hospital Admin'
              : user.role === 'doctor'
              ? 'Doctor'
              : 'Patient';
          results.push({
            id: user.id,
            label: user.name,
            sublabel: `${roleDisplay} • ${user.email}`,
            type: 'user',
            role: user.role as any,
          });
        }
      }
    }

    return results;
  }

  async getPublicActive(): Promise<AnnouncementItem[]> {
    const now = new Date();
    const list = await this.announcementsRepo
      .createQueryBuilder('a')
      .where('a.is_active = :isActive', { isActive: true })
      .andWhere('(a.expires_at IS NULL OR a.expires_at > :now)', { now })
      .andWhere("a.target_type IN ('all', 'homepage')")
      .orderBy('a.created_at', 'DESC')
      .getMany();

    const items: AnnouncementItem[] = [];
    for (const a of list) {
      items.push(await this.mapToItem(a));
    }
    return items;
  }

  async getActiveForUser(user: PublicUser): Promise<AnnouncementItem[]> {
    const now = new Date();
    const allActive = await this.announcementsRepo
      .createQueryBuilder('a')
      .where('a.is_active = :isActive', { isActive: true })
      .andWhere('(a.expires_at IS NULL OR a.expires_at > :now)', { now })
      .orderBy('a.created_at', 'DESC')
      .getMany();

    const userReads = await this.readsRepo.find({
      where: { userId: user.id },
    });
    const readMap = new Map<string, UserAnnouncementRead>();
    for (const r of userReads) {
      readMap.set(r.announcementId, r);
    }

    const relevant: AnnouncementItem[] = [];

    for (const a of allActive) {
      let matches = false;

      switch (a.targetType) {
        case 'all':
        case 'homepage':
          matches = true;
          break;
        case 'all_hospitals':
          matches = user.role === 'admin' || Boolean(user.organizationId);
          break;
        case 'all_doctors':
          matches = user.role === 'doctor';
          break;
        case 'all_patients':
          matches = user.role === 'patient';
          break;
        case 'selected_hospitals':
          if (user.organizationId && a.targetHospitalIds) {
            try {
              const ids: string[] = JSON.parse(a.targetHospitalIds);
              matches = ids.includes(user.organizationId);
            } catch {
              matches = false;
            }
          }
          break;
        case 'selected_users':
          if (a.targetUserIds) {
            try {
              const ids: string[] = JSON.parse(a.targetUserIds);
              matches = ids.includes(user.id);
            } catch {
              matches = false;
            }
          }
          break;
      }

      if (matches) {
        const item = await this.mapToItem(a);
        const readRecord = readMap.get(a.id);
        item.isRead = Boolean(readRecord?.readAt);
        item.isDismissed = Boolean(readRecord?.dismissedAt);
        relevant.push(item);
      }
    }

    return relevant;
  }

  async markRead(announcementId: string, userId: string): Promise<{ success: boolean }> {
    let record = await this.readsRepo.findOne({
      where: { announcementId, userId },
    });
    if (!record) {
      record = this.readsRepo.create({
        announcementId,
        userId,
        readAt: new Date(),
      });
    } else if (!record.readAt) {
      record.readAt = new Date();
    }
    await this.readsRepo.save(record);
    return { success: true };
  }

  async markDismissed(announcementId: string, userId: string): Promise<{ success: boolean }> {
    let record = await this.readsRepo.findOne({
      where: { announcementId, userId },
    });
    if (!record) {
      record = this.readsRepo.create({
        announcementId,
        userId,
        readAt: new Date(),
        dismissedAt: new Date(),
      });
    } else {
      if (!record.readAt) record.readAt = new Date();
      record.dismissedAt = new Date();
    }
    await this.readsRepo.save(record);
    return { success: true };
  }

  async markAllRead(userId: string): Promise<{ success: boolean }> {
    const activeAnnouncements = await this.announcementsRepo.find({
      where: { isActive: true },
    });
    for (const a of activeAnnouncements) {
      let record = await this.readsRepo.findOne({
        where: { announcementId: a.id, userId },
      });
      if (!record) {
        record = this.readsRepo.create({
          announcementId: a.id,
          userId,
          readAt: new Date(),
        });
        await this.readsRepo.save(record);
      }
    }
    return { success: true };
  }

  private async mapToItem(a: Announcement): Promise<AnnouncementItem> {
    let targetHospitalNames: string[] = [];
    let targetUserNames: string[] = [];
    let parsedHospIds: string[] | null = null;
    let parsedUserIds: string[] | null = null;

    if (a.targetHospitalIds) {
      try {
        parsedHospIds = JSON.parse(a.targetHospitalIds);
        if (parsedHospIds && parsedHospIds.length > 0) {
          const orgs = await this.orgsRepo.findBy({ id: In(parsedHospIds) });
          targetHospitalNames = orgs.map((o) => o.name);
        }
      } catch {
        parsedHospIds = null;
      }
    }

    if (a.targetUserIds) {
      try {
        parsedUserIds = JSON.parse(a.targetUserIds);
        if (parsedUserIds && parsedUserIds.length > 0) {
          const users = await this.usersRepo.findBy({ id: In(parsedUserIds) });
          targetUserNames = users.map((u) => u.name);
        }
      } catch {
        parsedUserIds = null;
      }
    }

    let createdByName: string | null = null;
    if (a.createdByUserId) {
      const creator = await this.usersRepo.findOne({ where: { id: a.createdByUserId } });
      if (creator) createdByName = creator.name;
    }

    return {
      id: a.id,
      title: a.title,
      content: a.content,
      priority: a.priority,
      targetType: a.targetType,
      targetHospitalIds: parsedHospIds,
      targetUserIds: parsedUserIds,
      targetHospitalNames,
      targetUserNames,
      isActive: a.isActive,
      createdByUserId: a.createdByUserId,
      createdByName,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      expiresAt: a.expiresAt ? a.expiresAt.toISOString() : null,
    };
  }
}
