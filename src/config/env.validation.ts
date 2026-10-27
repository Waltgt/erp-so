import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum Entorno {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

// Variables obligatorias para arrancar. Si alguna falta o es inválida,
// la app no arranca (ConfigModule lanza el error de validate()).
export class VariablesEntorno {
  @IsOptional()
  @IsEnum(Entorno)
  NODE_ENV: Entorno = Entorno.Development;

  @IsString()
  @Matches(/^postgres(ql)?:\/\//, {
    message: 'DATABASE_URL debe ser una URL postgresql://',
  })
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET debe tener al menos 32 caracteres' })
  JWT_SECRET!: string;

  // Formato de jsonwebtoken: segundos ("3600") o con unidad ("15m", "8h", "7d")
  @IsString()
  @Matches(/^\d+[smhd]?$/, {
    message:
      'JWT_EXPIRES_IN debe ser un número con unidad opcional s/m/h/d (ej. "8h")',
  })
  JWT_EXPIRES_IN!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;
}

export function validarEntorno(
  config: Record<string, unknown>,
): VariablesEntorno {
  const variables = plainToInstance(VariablesEntorno, config, {
    enableImplicitConversion: true,
  });
  const errores = validateSync(variables, { skipMissingProperties: false });

  if (errores.length > 0) {
    const detalle = errores
      .map((e) => {
        const valor = config[e.property];
        if (valor === undefined || valor === '') {
          return `  - ${e.property}: falta la variable`;
        }
        return `  - ${e.property}: ${Object.values(e.constraints ?? {}).join('; ')}`;
      })
      .join('\n');
    throw new Error(`Configuración inválida en .env:\n${detalle}`);
  }

  return variables;
}
