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
    console.log('[JwtAuthGuard] canActivate called');
    if (authHeader) {
      console.log('[JwtAuthGuard] Authorization header present, length:', authHeader.length);
    } else {
      console.log('[JwtAuthGuard] WARNING: No Authorization header');
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
      console.error('[JwtAuthGuard] JWT error:', {
        name: err.name,
        message: err.message,
      });
      throw err;
    }
    if (!user) {
      console.error('[JwtAuthGuard] JWT validation failed', {
        info: info?.message || info,
        status,
      });
      throw new UnauthorizedException(`Unauthorized: ${info?.message || 'Invalid token'}`);
    }
    console.log('[JwtAuthGuard] User authenticated:', user.sub);
    return user;
  }
}
