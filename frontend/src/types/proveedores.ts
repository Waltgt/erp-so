import type { FechaIso, ParametrosPaginacion } from './api'

// Los demás límites están en ./contacto (compartidos con clientes)
export const CONTACTO_MAX = 100

export interface Proveedor {
  id: number
  // Ya normalizado; único siempre (los proveedores no admiten "CF")
  nit: string
  nombre: string
  // Persona de contacto
  contacto: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  activo: boolean
  creadoEn: FechaIso
  actualizadoEn: FechaIso
}

// GET, GET /:id y DELETE agregan cuántos productos activos tiene asociados
// (POST y PATCH no)
export interface ProveedorConProductos extends Proveedor {
  productosActivos: number
}

// GET /api/proveedores (ADMIN, COMPRAS, BODEGUERO). ?buscar= en nombre o NIT.
export interface ListarProveedoresParametros extends ParametrosPaginacion {
  buscar?: string
  // ADMIN y COMPRAS; BODEGUERO recibe 403
  incluirInactivos?: boolean
}

// POST /api/proveedores (ADMIN, COMPRAS). "CF" da 400; un NIT repetido, 409
// "NIT ya registrado".
export interface CrearProveedorPeticion {
  nit: string
  nombre: string
  contacto?: string | null
  telefono?: string | null
  email?: string | null
  direccion?: string | null
}

// PATCH /api/proveedores/:id. Body vacío da 400; null borra los opcionales;
// activo: true reactiva.
export interface ActualizarProveedorPeticion extends Partial<CrearProveedorPeticion> {
  activo?: boolean
}
