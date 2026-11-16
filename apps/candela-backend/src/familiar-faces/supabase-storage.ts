import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService {
  private client: SupabaseClient | null = null;
  private familiarFacesBucket = 'familiar-faces';
  private profilePhotosBucket = 'profile-photos';

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  get bucket(): string {
    this.ensureClient();
    return this.familiarFacesBucket;
  }

  get profileBucket(): string {
    this.ensureClient();
    return this.profilePhotosBucket;
  }

  async upload(objectKey: string, bytes: Buffer, contentType: string): Promise<void> {
    await this.uploadToBucket(this.bucket, objectKey, bytes, contentType);
  }

  async uploadProfile(objectKey: string, bytes: Buffer, contentType: string): Promise<void> {
    await this.uploadToBucket(this.profileBucket, objectKey, bytes, contentType);
  }

  async remove(objectKey: string): Promise<void> {
    await this.removeFromBucket(this.bucket, objectKey);
  }

  async removeProfile(objectKey: string): Promise<void> {
    await this.removeFromBucket(this.profileBucket, objectKey);
  }

  async signedUrl(objectKey: string, expiresInSec = 3600): Promise<string> {
    return this.signedUrlFromBucket(this.bucket, objectKey, expiresInSec);
  }

  async signedProfileUrl(objectKey: string, expiresInSec = 3600): Promise<string> {
    return this.signedUrlFromBucket(this.profileBucket, objectKey, expiresInSec);
  }

  async signedUrls(objectKeys: string[], expiresInSec = 3600): Promise<Map<string, string>> {
    return this.signedUrlsFromBucket(this.bucket, objectKeys, expiresInSec);
  }

  private async uploadToBucket(
    bucket: string,
    objectKey: string,
    bytes: Buffer,
    contentType: string,
  ): Promise<void> {
    const { error } = await this.ensureClient()
      .storage.from(bucket)
      .upload(objectKey, bytes, { contentType, upsert: true });
    if (error) {
      throw new ServiceUnavailableException(error.message || 'Could not upload the photo');
    }
  }

  private async removeFromBucket(bucket: string, objectKey: string): Promise<void> {
    const { error } = await this.ensureClient().storage.from(bucket).remove([objectKey]);
    if (error) {
      throw new ServiceUnavailableException(error.message || 'Could not delete the photo');
    }
  }

  private async signedUrlFromBucket(
    bucket: string,
    objectKey: string,
    expiresInSec: number,
  ): Promise<string> {
    const { data, error } = await this.ensureClient()
      .storage.from(bucket)
      .createSignedUrl(objectKey, expiresInSec);
    if (error || !data?.signedUrl) {
      throw new ServiceUnavailableException(error?.message || 'Could not open the photo');
    }
    return data.signedUrl;
  }

  private async signedUrlsFromBucket(
    bucket: string,
    objectKeys: string[],
    expiresInSec: number,
  ): Promise<Map<string, string>> {
    const urls = new Map<string, string>();
    if (objectKeys.length === 0) return urls;
    const { data, error } = await this.ensureClient()
      .storage.from(bucket)
      .createSignedUrls(objectKeys, expiresInSec);
    if (error) {
      throw new ServiceUnavailableException(error.message || 'Could not open the photos');
    }
    for (const row of data ?? []) {
      const url = row.signedUrl || (row as { signedURL?: string }).signedURL;
      if (row.path && url) {
        urls.set(row.path, url);
      }
    }
    return urls;
  }

  private readEnv(name: string): string {
    const fromConfig = this.config?.get<string>(name);
    const fromProcess = process.env[name];
    return (fromConfig || fromProcess || '').trim();
  }

  private ensureClient(): SupabaseClient {
    if (this.client) return this.client;
    const url = this.readEnv('SUPABASE_URL');
    const secretKey = this.readEnv('SUPABASE_SECRET_KEY');
    this.familiarFacesBucket = this.readEnv('SUPABASE_STORAGE_BUCKET') || 'familiar-faces';
    this.profilePhotosBucket =
      this.readEnv('SUPABASE_PROFILE_PHOTOS_BUCKET') || 'profile-photos';
    if (!url || !secretKey || secretKey.startsWith('change-me')) {
      throw new ServiceUnavailableException(
        'Photo storage is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY on the backend.',
      );
    }
    this.client = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return this.client;
  }
}
