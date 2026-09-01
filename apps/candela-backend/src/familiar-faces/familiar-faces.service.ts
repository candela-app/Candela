import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { FamiliarFace } from '../entities/familiar-face.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { SupabaseStorageService } from './supabase-storage';

const MAX_PHOTOS = 20;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

type UploadedImage = {
  buffer: Buffer;
  size: number;
  mimetype: string;
};

export type FamiliarFaceDto = {
  id: string;
  relationLabel: string;
  imageUrl: string;
  createdAt: string;
};

@Injectable()
export class FamiliarFacesService {
  constructor(
    @InjectRepository(FamiliarFace) private readonly faces: Repository<FamiliarFace>,
    @InjectRepository(PatientProfile) private readonly patients: Repository<PatientProfile>,
    @Inject(SupabaseStorageService) private readonly storage: SupabaseStorageService,
  ) {}

  async list(patientId: string): Promise<FamiliarFaceDto[]> {
    await this.requirePatient(patientId);
    const rows = await this.faces.find({
      where: { patientId },
      order: { createdAt: 'ASC' },
    });
    const urls = await this.storage.signedUrls(rows.map((row) => row.storagePath));
    const result: FamiliarFaceDto[] = [];
    for (const row of rows) {
      let imageUrl = urls.get(row.storagePath) || '';
      if (!imageUrl) {
        try {
          imageUrl = await this.storage.signedUrl(row.storagePath);
        } catch {
          imageUrl = '';
        }
      }
      result.push({
        id: row.id,
        relationLabel: row.relationLabel,
        imageUrl,
        createdAt: row.createdAt.toISOString(),
      });
    }
    return result;
  }

  async upload(
    patientId: string,
    file: UploadedImage | undefined,
    relationLabel: string,
  ): Promise<FamiliarFaceDto> {
    await this.requirePatient(patientId);
    const label = this.cleanLabel(relationLabel);
    if (!file?.buffer?.length) {
      throw new BadRequestException('Choose a photo to upload');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('Photo must be 5 MB or smaller');
    }
    const ext = ALLOWED_TYPES[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Use a JPG, PNG, or WebP photo');
    }
    const count = await this.faces.count({ where: { patientId } });
    if (count >= MAX_PHOTOS) {
      throw new BadRequestException(`You can save up to ${MAX_PHOTOS} photos`);
    }

    const id = randomUUID();
    const storagePath = `${patientId}/${id}${ext}`;
    await this.storage.upload(storagePath, file.buffer, file.mimetype);

    const row = this.faces.create({
      id,
      patientId,
      relationLabel: label,
      storagePath,
    });
    await this.faces.save(row);
    const imageUrl = await this.storage.signedUrl(storagePath);
    return {
      id: row.id,
      relationLabel: row.relationLabel,
      imageUrl,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async updateLabel(patientId: string, id: string, relationLabel: string): Promise<FamiliarFaceDto> {
    const row = await this.getOwned(patientId, id);
    row.relationLabel = this.cleanLabel(relationLabel);
    await this.faces.save(row);
    const imageUrl = await this.storage.signedUrl(row.storagePath);
    return {
      id: row.id,
      relationLabel: row.relationLabel,
      imageUrl,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async remove(patientId: string, id: string): Promise<void> {
    const row = await this.getOwned(patientId, id);
    await this.storage.remove(row.storagePath);
    await this.faces.remove(row);
  }

  private async requirePatient(patientId: string): Promise<void> {
    const patient = await this.patients.findOne({ where: { userId: patientId } });
    if (!patient) {
      throw new NotFoundException('Patient profile not found');
    }
  }

  private async getOwned(patientId: string, id: string): Promise<FamiliarFace> {
    const row = await this.faces.findOne({ where: { id, patientId } });
    if (!row) {
      throw new NotFoundException('Photo not found');
    }
    return row;
  }

  private cleanLabel(raw: string): string {
    const label = raw.replace(/\s+/g, ' ').trim();
    if (!label) {
      throw new BadRequestException('Enter who this person is');
    }
    return label.slice(0, 64);
  }
}
