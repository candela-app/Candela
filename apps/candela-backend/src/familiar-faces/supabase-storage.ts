import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService {
  private client: SupabaseClient | null = null;
  private bucketName = 'familiar-faces';

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  get bucket(): string {
    this.ensureClient();
    return this.bucketName;
  }

  async upload(objectKey: string, bytes: Buffer, contentType: string): Promise<void> {
    const { error } = await this.ensureClient()
      .storage.from(this.bucketName)
      .upload(objectKey, bytes, { contentType, upsert: false });
    if (error) {
      throw new ServiceUnavailableException(error.message || 'Could not upload the photo');
    }
  }

  async remove(objectKey: string): Promise<void> {
    const { error } = await this.ensureClient().storage.from(this.bucketName).remove([objectKey]);
    if (error) {
      throw new ServiceUnavailableException(error.message || 'Could not delete the photo');
    }
  }

  async signedUrl(objectKey: string, expiresInSec = 3600): Promise<string> {
    const { data, error } = await this.ensureClient()
      .storage.from(this.bucketName)
      .createSignedUrl(objectKey, expiresInSec);
    if (error || !data?.signedUrl) {
      throw new ServiceUnavailableException(error?.message || 'Could not open the photo');
    }
    return data.signedUrl;
  }

  async signedUrls(objectKeys: string[], expiresInSec = 3600): Promise<Map<string, string>> {
    const urls = new Map<string, string>();
    if (objectKeys.length === 0) return urls;
    const { data, error } = await this.ensureClient()
      .storage.from(this.bucketName)
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
    this.bucketName = this.readEnv('SUPABASE_STORAGE_BUCKET') || 'familiar-faces';
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
