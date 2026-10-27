// Prisma 7 NO escapa los comodines de LIKE en `contains`/`startsWith`/
// `endsWith`: buscar "%" o "_" encontraría todo. Se escapan con "\", que es
// el carácter de escape por defecto de LIKE/ILIKE en PostgreSQL.
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}
