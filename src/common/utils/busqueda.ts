import { normalizarNit } from '../validators/campos-contacto';
import { escaparLike } from './escapar-like';

type FiltroTexto = {
  contains: string;
  mode?: 'insensitive';
};

// Condiciones OR para ?buscar= en entidades con nombre y NIT (clientes,
// proveedores):
// - nombre: contiene el texto, sin distinguir mayúsculas (no ignora tildes)
// - nit: contiene el texto normalizado igual que al guardar ("1234567-8"
//   encuentra "12345678"). Si no queda nada útil (ej. "-"), no se agrega.
// Los comodines de LIKE se escapan (Prisma no lo hace).
export function busquedaNombreONit(
  buscar: string,
): { nombre?: FiltroTexto; nit?: FiltroTexto }[] {
  const condiciones: { nombre?: FiltroTexto; nit?: FiltroTexto }[] = [
    { nombre: { contains: escaparLike(buscar), mode: 'insensitive' } },
  ];
  const nit = normalizarNit(buscar);
  if (nit) {
    condiciones.push({ nit: { contains: escaparLike(nit) } });
  }
  return condiciones;
}
