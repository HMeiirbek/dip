import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppRole } from './security.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'secret',
    });
    console.log('[JWT] JwtStrategy initialized with secret length:', (process.env.JWT_SECRET || 'secret').length);
  }

  async validate(payload: { sub: string; role?: AppRole; sid?: string }) {
    console.log('[JWT] Token validated for user:', payload.sub);
    return { sub: payload.sub, role: payload.role || 'user', sid: payload.sid };
  }
}
