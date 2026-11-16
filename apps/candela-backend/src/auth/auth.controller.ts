import { Body, Controller, Get, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../common/decorators';
import { CurrentUser } from '../common/current-user.decorator';
import { User } from '../entities/user.entity';
import { ProfilesService } from '../profiles/profiles.service';
import { AuthService, readRefreshCookie } from './auth.service';
import {
  AcceptGooglePatientInvitationDto,
  AcceptPatientInvitationDto,
  GoogleAuthDto,
  LoginDto,
  SignupDto,
  RefreshDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
} from './dto';

@Controller('api/auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ProfilesService) private readonly profiles: ProfilesService,
  ) {}

  @Public()
  @Post('signup')
  signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.signup(dto, res);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(dto, res);
  }

  @Public()
  @Post('google')
  loginGoogle(@Body() dto: GoogleAuthDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.loginWithGoogle(dto, res);
  }

  @Public()
  @Post('refresh')
  refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: RefreshDto,
  ) {
    return this.auth.refresh(body?.refreshToken || readRefreshCookie(req.cookies), res);
  }

  @Public()
  @Post('logout')
  logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: RefreshDto,
  ) {
    return this.auth.logout(body?.refreshToken || readRefreshCookie(req.cookies), res);
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Public()
  @Post('invitations/accept')
  acceptInvitation(@Body() dto: AcceptPatientInvitationDto) {
    return this.auth.acceptPatientInvitation(dto);
  }

  /** H2 Option C — explicit accept after Google auth (restricted challenge, then session). */
  @Public()
  @Post('invitations/accept-google')
  acceptGoogleInvitation(
    @Body() dto: AcceptGooglePatientInvitationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.acceptGooglePatientInvitation(dto, res);
  }

  @Get('me')
  me(@CurrentUser() user: User) {
    return this.auth.getSession(user);
  }

  /**
   * Compatibility alias — updates display name only, then returns a fresh SessionUser
   * (not MeProfileResponse) so existing name-edit clients keep working.
   */
  @Patch('profile')
  async updateProfile(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    await this.profiles.patchLegacyName(user, dto.name);
    return this.auth.getSession(user);
  }
}
