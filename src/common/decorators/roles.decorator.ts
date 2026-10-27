import { SetMetadata } from '@nestjs/common';
import { Rol } from '../../generated/prisma/client';

export const ROLES = 'roles';

// Sin @Roles(): cualquier usuario autenticado. Con @Roles(...): solo esos roles.
// En el método reemplaza al de la clase.
export const Roles = (...roles: Rol[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES, roles);
