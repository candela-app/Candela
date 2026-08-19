import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export type GoogleProfile = {
  googleId: string;
  email: string;
  name: string;
};

@Injectable()
export class GoogleAuthService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  private audiences(): string[] {
    const keys = [
      'GOOGLE_CLIENT_ID_WEB',
      'GOOGLE_CLIENT_ID_ANDROID',
      'GOOGLE_CLIENT_ID_IOS',
      'GOOGLE_CLIENT_ID_EXPO',
    ];
    const ids = keys.flatMap((key) =>
      (this.config.get<string>(key) ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );
    return [...new Set(ids)];
  }

  async verifyIdToken(idToken: string): Promise<GoogleProfile> {
    const audiences = this.audiences();
    if (audiences.length === 0) {
      throw new UnauthorizedException('Google sign-in is not configured');
    }
    try {
      const client = new OAuth2Client();
      const ticket = await client.verifyIdToken({ idToken, audience: audiences });
      const payload = ticket.getPayload();
      if (!payload?.email || !payload.email_verified || !payload.sub) {
        throw new UnauthorizedException('Google account is not verified');
      }
      return {
        googleId: payload.sub,
        email: payload.email.trim().toLowerCase(),
        name: (payload.name ?? payload.email.split('@')[0]).trim(),
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('Invalid Google sign-in');
    }
  }
}
