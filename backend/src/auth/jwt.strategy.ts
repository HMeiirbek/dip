import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppRole } from './security.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.JWT_SECRET || 'secret';
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
    console.log('[JwtStrategy] Initialized with secret length:', secret.length);
    console.log('[JwtStrategy] Secret configured from env:', !!process.env.JWT_SECRET);
  }

  async validate(payload: { sub: string; role?: AppRole; sid?: string }) {
    console.log('[JwtStrategy] Token payload validated:', { sub: payload.sub, role: payload.role });
    return { sub: payload.sub, role: payload.role || 'user', sid: payload.sid };
  }
}
