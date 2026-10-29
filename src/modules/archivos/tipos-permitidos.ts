import { TipoArchivo } from '../../generated/prisma/client';

// Lista blanca por MIME. Lo que no está aquí se rechaza con 415.
//
// El MIME se valida SOLO por la cabecera Content-Type de la parte del
// multipart (decisión del proyecto): no se leen los primeros bytes del
// archivo, así que un cliente podría mentir en la cabecera. El archivo nunca
// se ejecuta en el servidor y se guarda con un UUID, sin extensión.
//
// Varios tipos tienen más de un MIME según el navegador/sistema operativo
// (ej. wav: audio/wav o audio/x-wav; m4a: audio/mp4 o audio/x-m4a).
export const TIPOS_PERMITIDOS: Readonly<Record<string, TipoArchivo>> = {
  // Música: mp3, ogg, wav, flac, m4a
  'audio/mpeg': TipoArchivo.MUSICA,
  'audio/mp3': TipoArchivo.MUSICA,
  'audio/ogg': TipoArchivo.MUSICA,
  'audio/wav': TipoArchivo.MUSICA,
  'audio/x-wav': TipoArchivo.MUSICA,
  'audio/wave': TipoArchivo.MUSICA,
  'audio/flac': TipoArchivo.MUSICA,
  'audio/x-flac': TipoArchivo.MUSICA,
  'audio/mp4': TipoArchivo.MUSICA,
  'audio/x-m4a': TipoArchivo.MUSICA,
  // Documentos: pdf, docx, xlsx, txt
  'application/pdf': TipoArchivo.DOCUMENTO,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    TipoArchivo.DOCUMENTO,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    TipoArchivo.DOCUMENTO,
  'text/plain': TipoArchivo.DOCUMENTO,
  // Imágenes: png, jpg, webp
  'image/png': TipoArchivo.IMAGEN,
  'image/jpeg': TipoArchivo.IMAGEN,
  'image/webp': TipoArchivo.IMAGEN,
  // Video: mp4, webm
  'video/mp4': TipoArchivo.VIDEO,
  'video/webm': TipoArchivo.VIDEO,
};

// "Text/Plain; charset=UTF-8" → "text/plain"
export function normalizarMime(contentType: string): string {
  return contentType.split(';')[0].trim().toLowerCase();
}

// null = no permitido (→ 415). TipoArchivo.OTRO existe en el enum pero no
// se usa: todo lo que no está en la lista blanca se rechaza.
export function tipoDesdeMime(contentType: string): TipoArchivo | null {
  return TIPOS_PERMITIDOS[normalizarMime(contentType)] ?? null;
}
