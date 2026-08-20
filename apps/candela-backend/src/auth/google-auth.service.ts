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

  private audienceAllowed(audience: string | undefined): boolean {
    if (!audience) {
      return false;
    }
    return this.audiences().includes(audience);
  }

  async verifyAccessToken(accessToken: string): Promise<GoogleProfile> {
    const audiences = this.audiences();
    if (audiences.length === 0) {
      throw new UnauthorizedException('Google sign-in is not configured');
    }
    try {
      const client = new OAuth2Client();
      const info = await client.getTokenInfo(accessToken);
      if (!this.audienceAllowed(info.aud) && !this.audienceAllowed(info.azp)) {
        throw new UnauthorizedException('Invalid Google sign-in');
      }

      const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userinfoRes.ok) {
        throw new UnauthorizedException('Invalid Google sign-in');
      }
      const userinfo = (await userinfoRes.json()) as {
        sub?: string;
        email?: string;
        email_verified?: boolean | string;
        name?: string;
      };

      const email = (userinfo.email ?? info.email)?.trim().toLowerCase();
      const googleId = userinfo.sub ?? info.sub;
      const verified =
        userinfo.email_verified === true ||
        userinfo.email_verified === 'true' ||
        info.email_verified === true;

      if (!email || !googleId || !verified) {
        throw new UnauthorizedException('Google account is not verified');
      }

      return {
        googleId,
        email,
        name: (userinfo.name ?? email.split('@')[0]).trim(),
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('Invalid Google sign-in');
    }
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
