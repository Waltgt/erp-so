import type { FechaIso, ParametrosPaginacion } from './api'

// Mismos límites que el backend (src/common/validators/campos-contacto.ts),
// para avisar antes de enviar. La validación que manda es la del servidor.
export const NIT_CONSUMIDOR_FINAL = 'CF'
export const NIT_MAX = 20
export const NOMBRE_CLIENTE_MAX = 150
export const EMAIL_CLIENTE_MAX = 150
export const TELEFONO_MAX = 20
export const DIRECCION_MAX = 255
export const BUSCAR_MAX = 100

export interface Cliente {
  id: number
  // Ya normalizado: sin espacios ni guiones, en mayúsculas ("CF" se repite)
  nit: string
  nombre: string
  email: string | null
  telefono: string | null
  direccion: string | null
  activo: boolean
  creadoEn: FechaIso
  actualizadoEn: FechaIso
}

// GET /api/clientes (ADMIN, VENDEDOR). ?buscar= en nombre o NIT: no
// distingue mayúsculas, pero el backend NO ignora tildes.
export interface ListarClientesParametros extends ParametrosPaginacion {
  buscar?: string
  // Solo ADMIN; con otro rol el backend responde 403
  incluirInactivos?: boolean
}

// POST /api/clientes. 409 "Registro duplicado: nit" si el NIT ya existe
// (salvo CF). Los opcionales vacíos se guardan como null.
export interface CrearClientePeticion {
  nit: string
  nombre: string
  email?: string | null
  telefono?: string | null
  direccion?: string | null
}

// PATCH /api/clientes/:id. Body vacío → 400; null borra email, teléfono o
// dirección. activo solo lo envía ADMIN (true reactiva).
export interface ActualizarClientePeticion extends Partial<CrearClientePeticion> {
  activo?: boolean
}
