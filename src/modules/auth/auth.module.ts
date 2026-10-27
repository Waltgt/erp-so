import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { duracionEnSegundos } from '../../config/duracion';
import { VariablesEntorno } from '../../config/env.validation';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    UsuariosModule,
    PassportModule,
    // Rate limit del login: 5 intentos por minuto por IP. Solo lo usa
    // POST /auth/login (@UseGuards(ThrottlerGuard)), no es global.
    // Contadores en memoria de cada proceso: con PM2 cluster el límite real
    // sería 5 × workers. Se complementa con Nginx en la fase 6
    // (docs/infra/pendientes.md).
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'login', ttl: 60_000, limit: 5 }],
      errorMessage:
        'Demasiados intentos de inicio de sesión; espere un minuto e intente de nuevo',
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<VariablesEntorno, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: duracionEnSegundos(
            config.get('JWT_EXPIRES_IN', { infer: true }),
          ),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // Guards globales, en este orden: primero autenticar, luego roles
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
