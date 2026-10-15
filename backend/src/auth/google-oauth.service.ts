import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, Auth } from 'googleapis';
import { PrismaService } from '../prisma';
import { EncryptionService } from './encryption.service';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

@Injectable()
export class GoogleOAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {
    this.clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
    this.clientSecret = this.configService.getOrThrow<string>(
      'GOOGLE_CLIENT_SECRET',
    );
    this.redirectUri = this.configService.getOrThrow<string>(
      'GOOGLE_REDIRECT_URI',
    );
  }

  private createOAuth2Client(): Auth.OAuth2Client {
    return new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri,
    );
  }

  getAuthorizationUrl(): string {
    const client = this.createOAuth2Client();
    return client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent', // Always return refresh token
      include_granted_scopes: true,
    });
  }

  async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiry: Date | null;
    email: string;
    name: string;
  }> {
    const client = this.createOAuth2Client();
    const { tokens } = await client.getToken(code);

    if (!tokens.access_token) {
      throw new UnauthorizedException('Failed to obtain access token');
    }

    // Get user profile info
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data: profile } = await oauth2.userinfo.get();

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      email: profile.email || '',
      name: profile.name || '',
    };
  }

  async getGmailClient(
    userId: string,
  ): Promise<ReturnType<typeof google.gmail>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.googleAccessToken) {
      throw new UnauthorizedException('User not connected to Gmail');
    }

    const client = this.createOAuth2Client();
    client.setCredentials({
      access_token: this.encryption.decrypt(user.googleAccessToken),
      refresh_token: user.googleRefreshToken
        ? this.encryption.decrypt(user.googleRefreshToken)
        : undefined,
    });

    // Handle token refresh
    client.on('tokens', (tokens) => {
      const updateData: Record<string, string | Date> = {};
      if (tokens.access_token) {
        updateData.googleAccessToken = this.encryption.encrypt(
          tokens.access_token,
        );
      }
      if (tokens.refresh_token) {
        updateData.googleRefreshToken = this.encryption.encrypt(
          tokens.refresh_token,
        );
      }
      if (tokens.expiry_date) {
        updateData.tokenExpiry = new Date(tokens.expiry_date);
      }
      this.prisma.user
        .update({
          where: { id: userId },
          data: updateData,
        })
        .catch((err) => console.error('Token refresh update failed', err));
    });

    return google.gmail({ version: 'v1', auth: client });
  }
}
