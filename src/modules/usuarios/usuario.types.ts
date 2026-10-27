import { Prisma, Usuario } from '../../generated/prisma/client';

// Se pasa como `omit` en TODA consulta de usuarios que llegue a una respuesta
export const OMITIR_PASSWORD = {
  passwordHash: true,
} as const satisfies Prisma.UsuarioOmit;

export type UsuarioPublico = Omit<Usuario, 'passwordHash'>;

// Para el único caso en que se lee el hash (login): quitarlo antes de responder
export function sinPassword(usuario: Usuario): UsuarioPublico {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    activo: usuario.activo,
    creadoEn: usuario.creadoEn,
    actualizadoEn: usuario.actualizadoEn,
  };
}
