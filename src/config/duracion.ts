const SEGUNDOS_POR_UNIDAD: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
};

// "3600" → 3600, "15m" → 900, "8h" → 28800, "7d" → 604800.
// Se pasa a jsonwebtoken como número (segundos): un string sin unidad lo
// interpretaría como milisegundos.
export function duracionEnSegundos(valor: string): number {
  const coincidencia = /^(\d+)([smhd]?)$/.exec(valor.trim());
  if (!coincidencia) {
    throw new Error(`Duración inválida: "${valor}"`);
  }
  const [, cantidad, unidad] = coincidencia;
  return Number(cantidad) * SEGUNDOS_POR_UNIDAD[unidad || 's'];
}
