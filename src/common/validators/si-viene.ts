import { ValidateIf } from 'class-validator';

// Para campos opcionales NOT NULL en un PATCH: si no viene, no se valida;
// si viene null, SÍ se valida (y falla). @IsOptional() dejaría pasar el null.
export const SiViene = (): PropertyDecorator =>
  ValidateIf((_dto, valor) => valor !== undefined);
