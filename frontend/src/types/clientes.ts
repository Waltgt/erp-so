import type { FechaIso, ParametrosPaginacion } from './api'

// Los límites de los campos están en ./contacto (compartidos con proveedores)
export const NIT_CONSUMIDOR_FINAL = 'CF'

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
