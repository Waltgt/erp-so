import { ROLES, type Rol } from '@/types/auth'

export interface DatosRol {
  etiqueta: string
  // Color del Tag de PrimeVue
  color: 'danger' | 'info' | 'warn' | 'success'
}

export const DATOS_ROL: Record<Rol, DatosRol> = {
  ADMIN: { etiqueta: 'Administrador', color: 'danger' },
  VENDEDOR: { etiqueta: 'Vendedor', color: 'info' },
  BODEGUERO: { etiqueta: 'Bodeguero', color: 'warn' },
  COMPRAS: { etiqueta: 'Compras', color: 'success' },
}

// Para un Select: [{ label: 'Administrador', value: 'ADMIN' }, ...]
export const OPCIONES_ROL = ROLES.map((rol) => ({ label: DATOS_ROL[rol].etiqueta, value: rol }))
