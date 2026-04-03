import { Controller, Get, Patch, Body } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.findById(user.sub);
  }

  @Get('me/tenants')
  async getTenants(@CurrentUser() user: JwtPayload) {
    return this.usersService.getTenants(user.sub);
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() data: { name?: string },
  ) {
    return this.usersService.updateProfile(user.sub, data);
  }
}
