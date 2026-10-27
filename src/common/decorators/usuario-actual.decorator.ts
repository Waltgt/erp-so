import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { UsuarioPublico } from '../../modules/usuarios/usuario.types';

// Usuario autenticado, recién leído de la base por la estrategia JWT
export const UsuarioActual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioPublico => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as UsuarioPublico;
  },
);
