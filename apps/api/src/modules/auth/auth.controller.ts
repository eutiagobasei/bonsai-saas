import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SwitchTenantDto } from './dto/switch-tenant.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { LoginThrottlerGuard } from '../../common/guards/login-throttler.guard';
import { getTokenCookieConfig, COOKIE_NAMES, TokenCookieConfig } from '../../common/security';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly cookieConfig: TokenCookieConfig;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.cookieConfig = getTokenCookieConfig(configService);
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    res.cookie(COOKIE_NAMES.ACCESS_TOKEN, accessToken, this.cookieConfig.accessToken);
    res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, this.cookieConfig.refreshToken);
  }

  private clearAuthCookies(res: Response): void {
    res.cookie(COOKIE_NAMES.ACCESS_TOKEN, '', { ...this.cookieConfig.accessToken, maxAge: 0 });
    res.cookie(COOKIE_NAMES.REFRESH_TOKEN, '', { ...this.cookieConfig.refreshToken, maxAge: 0 });
  }

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 registrations per minute per IP
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Email already registered or validation error' })
  @ApiResponse({ status: 429, description: 'Too many registration attempts' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto, req);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    // Return only non-sensitive data (tokens are in HttpOnly cookies)
    return {
      user: result.user,
      tenant: result.tenant,
      tenants: result.tenants,
    };
  }

  @Public()
  @Post('login')
  @UseGuards(LoginThrottlerGuard)
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
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    // Return only non-sensitive data (tokens are in HttpOnly cookies)
    return {
      user: result.user,
      tenant: result.tenant,
      tenants: result.tenants,
    };
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
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    // Return only non-sensitive data (tokens are in HttpOnly cookies)
    return {
      user: result.user,
      tenant: result.tenant,
      tenants: result.tenants,
    };
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
    const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }
    const result = await this.authService.refreshTokens(refreshToken);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    // Return only non-sensitive data (tokens are in HttpOnly cookies)
    return {
      user: result.user,
      tenant: result.tenant,
      tenants: result.tenants,
    };
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
    const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN];
    await this.authService.logout(user.sub, refreshToken);
    this.clearAuthCookies(res);
  }
}
