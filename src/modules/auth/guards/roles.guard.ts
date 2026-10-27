import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES } from '../../../common/decorators/roles.decorator';
import { Rol } from '../../../generated/prisma/client';
import { UsuarioPublico } from '../../usuarios/usuario.types';

// Guard global, corre DESPUÉS de JwtAuthGuard. Compara con el rol que la
// estrategia leyó de la base (no con el del token).
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) {
      return true;
    }

    const usuario = context.switchToHttp().getRequest<Request>().user as
      UsuarioPublico | undefined;
    // false → 403 Forbidden
    return usuario !== undefined && roles.includes(usuario.rol);
  }
}
