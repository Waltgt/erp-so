import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

// nombre_original es VarChar(255)
export const NOMBRE_ARCHIVO_MAXIMO = 255;
// Al subir, si después de limpiar no queda nada
export const NOMBRE_ARCHIVO_POR_DEFECTO = 'archivo';

// Caracteres de control (Cc: \0, \n, \r, \t...) y de formato (Cf: incluye
// U+202E, que invierte el texto: "factura\u202Efdp.exe" se ve como
// "facturaexe.pdf")
const NO_IMPRIMIBLES = /[\p{Cc}\p{Cf}]/gu;

// Nombre original: solo para mostrar. Se queda solo el último segmento
// ("C:\fakepath\a.mp3" o "../../a.mp3" → "a.mp3"), sin caracteres de
// control, en NFC y sin espacios a los lados. "." y ".." quedan vacíos.
export function limpiarNombreArchivo(nombre: string): string {
  const ultimo = nombre.split(/[/\\]/).pop() ?? '';
  const limpio = ultimo.normalize('NFC').replace(NO_IMPRIMIBLES, '').trim();
  return limpio === '.' || limpio === '..' ? '' : limpio;
}

// Al subir no se rechaza un nombre largo: se recorta a 255 caracteres
// conservando la extensión. Cuenta puntos de código (como VarChar en
// PostgreSQL), así no parte un emoji por la mitad.
export function recortarNombreArchivo(nombre: string): string {
  const caracteres = Array.from(nombre);
  if (caracteres.length <= NOMBRE_ARCHIVO_MAXIMO) {
    return nombre;
  }
  const punto = nombre.lastIndexOf('.');
  const extension =
    punto > 0 ? Array.from(nombre.slice(punto)) : ([] as string[]);
  // Una "extensión" absurdamente larga no se conserva
  const conservar = extension.length <= 20 ? extension : [];
  return [
    ...caracteres.slice(0, NOMBRE_ARCHIVO_MAXIMO - conservar.length),
    ...conservar,
  ].join('');
}

// Nombre del archivo al subir: limpio, recortado y nunca vacío
export function nombreArchivoSubido(nombre: string | undefined): string {
  const limpio = limpiarNombreArchivo(nombre ?? '');
  return recortarNombreArchivo(limpio || NOMBRE_ARCHIVO_POR_DEFECTO);
}

// Renombrar (PATCH): se limpia igual que al subir, pero un nombre vacío o
// de más de 255 se rechaza con 400 en vez de corregirlo en silencio
export function IsNombreArchivo(): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({
      example: 'informe-octubre.pdf',
      maxLength: NOMBRE_ARCHIVO_MAXIMO,
      description:
        'Solo para mostrar. Se quitan rutas y caracteres de control. ' +
        'El objeto en el almacenamiento conserva su UUID.',
    }),
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? limpiarNombreArchivo(value) : value,
    ),
    IsString(),
    IsNotEmpty({ message: 'nombreOriginal no puede quedar vacío' }),
    MaxLength(NOMBRE_ARCHIVO_MAXIMO),
  );
}

// Query string y campos multipart llegan como texto: "3" → 3 y "" → raíz
// (undefined). Lo que no sean solo dígitos se deja como está y falla IsInt.
const aIdOpcional = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }
  const recortado = value.trim();
  if (recortado === '') {
    return undefined;
  }
  return /^\d+$/.test(recortado) ? Number(recortado) : value;
};

// Id de carpeta opcional. Ausente o vacío = raíz; en un PATCH, null mueve a
// la raíz. Que la carpeta sea del mismo usuario se valida en el servicio
// (400 si no).
export function IsCarpetaIdOpcional(descripcion: string): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({
      type: Number,
      nullable: true,
      example: 3,
      description: descripcion,
    }),
    Transform(aIdOpcional),
    IsOptional(),
    IsInt(),
    Min(1),
  );
}

// ?buscar= recortado; vacío se ignora (igual que en los demás listados)
export function IsBuscar(descripcion: string): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({ description: descripcion, maxLength: 100 }),
    IsOptional(),
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim() || undefined : value,
    ),
    IsString(),
    MaxLength(100),
  );
}
