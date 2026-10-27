import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { VariablesEntorno } from '../../config/env.validation';
import { UsuarioPublico } from '../usuarios/usuario.types';
import { AuthService, PayloadJwt } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<VariablesEntorno, true>,
    private readonly auth: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
      algorithms: ['HS256'],
    });
  }

  // Lo que devuelve queda en request.user (@UsuarioActual)
  validate(payload: PayloadJwt): Promise<UsuarioPublico> {
    return this.auth.validarUsuarioDelToken(payload);
  }
}
