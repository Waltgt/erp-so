// inline: el navegador lo muestra o reproduce; attachment: lo descarga
export type Disposicion = 'inline' | 'attachment';

// Content-Disposition con el nombre original (RFC 6266):
// - filename="...": copia solo ASCII para clientes antiguos (lo demás → _)
// - filename*=UTF-8''...: el nombre real, codificado (RFC 5987)
// El nombre ya viene limpio (sin rutas ni caracteres de control), pero las
// comillas y la barra invertida romperían filename="...".
export function contentDisposition(
  disposicion: Disposicion,
  nombre: string,
): string {
  const ascii = nombre.replace(/[^\x20-\x7E]|["\\]/gu, '_');
  return `${disposicion}; filename="${ascii}"; filename*=UTF-8''${codificarRfc5987(nombre)}`;
}

// encodeURIComponent deja sin codificar ' ( ) *, que en filename* no van
function codificarRfc5987(texto: string): string {
  return encodeURIComponent(texto).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
