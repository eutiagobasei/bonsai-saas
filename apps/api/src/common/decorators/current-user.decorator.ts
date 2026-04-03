import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

/**
 * Decorator to extract the current user from the JWT token.
 *
 * Usage:
 * @Get('me')
 * getProfile(@CurrentUser() user: JwtPayload) {
 *   return this.userService.findById(user.sub);
 * }
 *
 * @Get('me')
 * getEmail(@CurrentUser('email') email: string) {
 *   return { email };
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (data) {
      return user?.[data];
    }

    return user;
  },
);
