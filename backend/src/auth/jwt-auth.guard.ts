import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    console.log('[JwtAuthGuard] canActivate called. Authorization header present:', !!authHeader);
    if (authHeader) {
      console.log('[JwtAuthGuard] Auth header detected, length:', authHeader.length);
    }
    return super.canActivate(context);
  }

  handleRequest(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
    status?: any,
  ) {
    if (err) {
      console.error('[JwtAuthGuard] JWT validation error:', err.message);
      throw err;
    }
    if (!user) {
      console.error('[JwtAuthGuard] No user after JWT validation. Info:', info?.message);
      throw new UnauthorizedException();
    }
    console.log('[JwtAuthGuard] User authenticated:', user.sub);
    return user;
  }
}
