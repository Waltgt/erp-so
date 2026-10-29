import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export const ARCHIVO_TAMANO_MAX_MB_TOPE = 2047;

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

  // Proxies delante de la app (Nginx = 1). Express toma la IP real de
  // X-Forwarded-For saltando esa cantidad. 0 = sin proxy.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  TRUST_PROXY: number = 1;

  // ─── Almacenamiento de archivos (S3: Garage en server-files) ───

  // Garage expone la API S3 en el puerto 3900 (ej. http://192.168.56.13:3900)
  @IsString()
  @Matches(/^https?:\/\/[^/\s]+\/?$/, {
    message:
      'S3_ENDPOINT debe ser http(s)://host:puerto, sin ruta (ej. http://192.168.56.13:3900)',
  })
  S3_ENDPOINT!: string;

  // Dirección de Garage que usa el NAVEGADOR (URLs firmadas): Nginx en
  // server-web, puerto 3900. El host forma parte de la firma, así que debe
  // ser exactamente el host:puerto al que llega el navegador.
  @IsString()
  @Matches(/^https?:\/\/[^/\s]+\/?$/, {
    message:
      'S3_PUBLIC_ENDPOINT debe ser http(s)://host:puerto, sin ruta (ej. http://192.168.56.10:3900)',
  })
  S3_PUBLIC_ENDPOINT!: string;

  // Vigencia de las URLs firmadas. Máximo de SigV4: 7 días.
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(604800)
  URL_FIRMADA_SEGUNDOS: number = 900;

  // Debe coincidir con s3_region de garage.toml (por defecto "garage")
  @IsString()
  @IsNotEmpty()
  S3_REGION!: string;

  @IsString()
  @IsNotEmpty()
  S3_ACCESS_KEY!: string;

  @IsString()
  @IsNotEmpty()
  S3_SECRET_KEY!: string;

  // Reglas de nombres de bucket de S3: minúsculas, dígitos, punto y guion
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, {
    message:
      'S3_BUCKET debe tener de 3 a 63 caracteres: minúsculas, dígitos, "." o "-"',
  })
  S3_BUCKET!: string;

  // tamano_bytes es INTEGER en la base (máx. 2 147 483 647 bytes ≈ 2047 MB)
  @IsInt()
  @Min(1)
  @Max(ARCHIVO_TAMANO_MAX_MB_TOPE)
  ARCHIVO_TAMANO_MAX_MB!: number;
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
