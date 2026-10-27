import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

// Envoltura de argon2 (argon2id, parámetros por defecto de @node-rs/argon2)
@Injectable()
export class PasswordService {
  hashear(password: string): Promise<string> {
    return hash(password);
  }

  // Un hash mal formado cuenta como contraseña incorrecta, no como error 500
  async verificar(hashGuardado: string, password: string): Promise<boolean> {
    try {
      return await verify(hashGuardado, password);
    } catch {
      return false;
    }
  }
}
