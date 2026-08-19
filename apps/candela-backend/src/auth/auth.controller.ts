import { Body, Controller, Get, Inject, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../common/decorators';
import { CurrentUser } from '../common/current-user.decorator';
import { User } from '../entities/user.entity';
import { AuthService, readRefreshCookie } from './auth.service';
import { GoogleAuthDto, LoginDto, SignupDto, RefreshDto } from './dto';

@Controller('api/auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

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
    return this.auth.loginWithGoogle(dto.idToken, res);
  }

  @Public()
  @Post('refresh')
  refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: RefreshDto,
  ) {
    return this.auth.refresh(readRefreshCookie(req.cookies) || body?.refreshToken, res);
  }

  @Public()
  @Post('logout')
  logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: RefreshDto,
  ) {
    return this.auth.logout(readRefreshCookie(req.cookies) || body?.refreshToken, res);
  }

  @Get('me')
  me(@CurrentUser() user: User) {
    return this.auth.getSession(user);
  }
}
