import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Res,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import * as express from 'express';
import { AuthService } from './auth.service';
import { GoogleOAuthService } from './google-oauth.service';
import { EncryptionService } from './encryption.service';
import { CurrentUser } from './current-user.decorator';
import { Public } from './public.decorator';
import { PrismaService } from '../prisma';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SignupDto, LoginDto, ChangePasswordDto } from './dto/auth.dto';
import type { User } from '@prisma/client';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleOAuth: GoogleOAuthService,
    private readonly jwtService: JwtService,
    private readonly encryption: EncryptionService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // Extra strict for signup
  @Post('signup')
  @ApiOperation({ summary: 'Register a new user' })
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const result = await this.authService.signup(dto.email, dto.password, dto.name);
    this.setAuthCookie(res, result.access_token);
    return { user: result.user };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login with email and password' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const result = await this.authService.login(dto.email, dto.password);
    this.setAuthCookie(res, result.access_token);
    return { user: result.user };
  }

  @Public()
  @Get('google')
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  googleAuth(@Res() res: express.Response): void {
    const url = this.googleOAuth.getAuthorizationUrl();
    res.redirect(url);
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(
    @Query('code') code: string,
    @Res() res: express.Response,
  ): Promise<void> {
    let frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );

    // Force legacy relio.in redirects to app.relio.in
    if (frontendUrl === 'https://relio.in') {
      frontendUrl = 'https://app.relio.in';
    }

    try {
      const tokens = await this.googleOAuth.exchangeCodeForTokens(code);

      // Upsert user
      const user = await this.prisma.user.upsert({
        where: { email: tokens.email },
        update: {
          name: tokens.name,
          googleAccessToken: this.encryption.encrypt(tokens.accessToken),
          googleRefreshToken: tokens.refreshToken
            ? this.encryption.encrypt(tokens.refreshToken)
            : undefined,
          tokenExpiry: tokens.expiry,
        },
        create: {
          email: tokens.email,
          name: tokens.name,
          googleAccessToken: this.encryption.encrypt(tokens.accessToken),
          googleRefreshToken: tokens.refreshToken
            ? this.encryption.encrypt(tokens.refreshToken)
            : undefined,
          tokenExpiry: tokens.expiry,
        },
      });

      // Ensure org + owner membership exists
      await this.authService.ensureOrgMembership(user.id, user.name || user.email);

      // Create JWT
      const jwt = this.jwtService.sign({
        sub: user.id,
        email: user.email,
      });

      this.setAuthCookie(res, jwt);
      res.redirect(`${frontendUrl}/dashboard?auth=success`);
    } catch {
      res.redirect(`${frontendUrl}/login?auth=error`);
    }
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Logout and clear auth cookie' })
  logout(@Res({ passthrough: true }) res: express.Response) {
    res.clearCookie('access_token', { path: '/' });
    return { success: true };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user info' })
  getMe(@CurrentUser() user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      timezone: user.timezone,
      hasGoogleToken: !!user.googleAccessToken,
      lastSyncAt: user.lastSyncAt,
      createdAt: user.createdAt,
    };
  }

  @Patch('password')
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
  ) {
    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!fullUser?.passwordHash) {
      throw new BadRequestException(
        'No password set — you may have signed up via Google OAuth',
      );
    }

    const valid = await this.authService.validatePassword(
      dto.currentPassword,
      fullUser.passwordHash,
    );
    if (!valid) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (!dto.newPassword || dto.newPassword.length < 6) {
      throw new BadRequestException(
        'New password must be at least 6 characters',
      );
    }

    const newHash = await this.authService.hashPassword(dto.newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    return { success: true };
  }

  private setAuthCookie(res: express.Response, jwt: string) {
    res.cookie('access_token', jwt, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });
  }
}
