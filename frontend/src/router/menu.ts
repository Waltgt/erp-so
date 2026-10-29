import type { Router } from 'vue-router'
import type { Rol } from '@/types/auth'

export interface EntradaMenu {
  // Nombre de la ruta (router/index.ts)
  ruta: string
  etiqueta: string
  icono: string
}

// Orden del menú (docs/frontend/00-base.md). Los roles NO van aquí: se leen de
// meta.roles de cada ruta, así el menú y el guard no pueden contradecirse.
// Una entrada cuya ruta aún no existe (módulo sin implementar) no se muestra.
export const MENU: readonly EntradaMenu[] = [
  { ruta: 'inicio', etiqueta: 'Inicio', icono: 'pi pi-home' },
  { ruta: 'ventas', etiqueta: 'Ventas', icono: 'pi pi-shopping-cart' },
  { ruta: 'clientes', etiqueta: 'Clientes', icono: 'pi pi-users' },
  { ruta: 'productos', etiqueta: 'Productos', icono: 'pi pi-box' },
  { ruta: 'proveedores', etiqueta: 'Proveedores', icono: 'pi pi-truck' },
  { ruta: 'archivos', etiqueta: 'Archivos', icono: 'pi pi-folder' },
  { ruta: 'usuarios', etiqueta: 'Usuarios', icono: 'pi pi-id-card' },
]

export function menuPara(router: Router, rol: Rol | null): EntradaMenu[] {
  if (rol === null) {
    return []
  }
  return MENU.filter((entrada) => {
    if (!router.hasRoute(entrada.ruta)) {
      return false
    }
    const roles = router.resolve({ name: entrada.ruta }).meta.roles
    return !roles || roles.includes(rol)
  })
}
