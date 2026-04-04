import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SwitchTenantDto } from './dto/switch-tenant.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly isProduction: boolean;
  private readonly cookieMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.isProduction = configService.get<string>('NODE_ENV') === 'production';
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'strict',
      maxAge: this.cookieMaxAge,
      path: '/api/auth',
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    res.cookie('refreshToken', '', {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'strict',
      maxAge: 0,
      path: '/api/auth',
    });
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Email already registered or validation error' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);
    this.setRefreshTokenCookie(res, result.refreshToken);
    const { refreshToken, ...responseWithoutRefreshToken } = result;
    return responseWithoutRefreshToken;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setRefreshTokenCookie(res, result.refreshToken);
    const { refreshToken, ...responseWithoutRefreshToken } = result;
    return responseWithoutRefreshToken;
  }

  @Post('switch-tenant')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Switch to a different tenant' })
  @ApiResponse({ status: 200, description: 'Switched tenant successfully' })
  @ApiResponse({ status: 401, description: 'Not a member of the tenant' })
  async switchTenant(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SwitchTenantDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.switchTenant(user.sub, dto);
    this.setRefreshTokenCookie(res, result.refreshToken);
    const { refreshToken, ...responseWithoutRefreshToken } = result;
    return responseWithoutRefreshToken;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }
    const result = await this.authService.refreshTokens(refreshToken);
    this.setRefreshTokenCookie(res, result.refreshToken);
    const { refreshToken: newRefreshToken, ...responseWithoutRefreshToken } = result;
    return responseWithoutRefreshToken;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout and revoke tokens' })
  @ApiResponse({ status: 204, description: 'Logged out successfully' })
  async logout(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken;
    await this.authService.logout(user.sub, refreshToken);
    this.clearRefreshTokenCookie(res);
  }
}
