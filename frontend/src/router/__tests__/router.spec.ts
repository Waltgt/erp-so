import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, type Router } from 'vue-router'
import { CLAVE_SESION } from '@/stores/auth'
import type { Rol } from '@/types/auth'
import { crearRouter, rutaDeRegreso } from '../index'
import { menuPara } from '../menu'

function iniciarSesionComo(rol: Rol): void {
  localStorage.setItem(
    CLAVE_SESION,
    JSON.stringify({
      accessToken: 'tok',
      usuario: {
        id: 1,
        nombre: 'Prueba',
        email: 'p@empresa.com',
        rol,
        activo: true,
        creadoEn: '2026-10-01T00:00:00Z',
        actualizadoEn: '2026-10-01T00:00:00Z',
      },
    }),
  )
}

// El router real de la app, con historial en memoria
function crear(): Router {
  return crearRouter(createMemoryHistory())
}

async function ir(router: Router, ruta: string) {
  await router.push(ruta)
  return router.currentRoute.value
}

describe('router', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('sin sesión, una ruta interna lleva a /login recordando adónde iba', async () => {
    const r = await ir(crear(), '/productos?page=2')
    expect(r.name).toBe('login')
    expect(r.query.redirect).toBe('/productos?page=2')
  })

  it('sin sesión, la raíz lleva a /login sin redirect', async () => {
    const r = await ir(crear(), '/')
    expect(r.name).toBe('login')
    expect(r.query.redirect).toBeUndefined()
  })

  it('con sesión (recargar la página), se queda dentro', async () => {
    iniciarSesionComo('VENDEDOR')
    expect((await ir(crear(), '/productos')).name).toBe('productos')
  })

  it('con sesión, /login lleva al inicio', async () => {
    iniciarSesionComo('VENDEDOR')
    expect((await ir(crear(), '/login')).name).toBe('inicio')
  })

  it('rol sin permiso: /sin-permiso', async () => {
    iniciarSesionComo('VENDEDOR')
    expect((await ir(crear(), '/usuarios')).name).toBe('sin-permiso')
    setActivePinia(createPinia())
    iniciarSesionComo('ADMIN')
    expect((await ir(crear(), '/usuarios')).name).toBe('usuarios')
  })

  it('token borrado a mano de localStorage: al navegar vuelve al login', async () => {
    iniciarSesionComo('ADMIN')
    const router = crear()
    expect((await ir(router, '/productos')).name).toBe('productos')

    localStorage.removeItem(CLAVE_SESION)
    expect((await ir(router, '/usuarios')).name).toBe('login')
  })

  it('ruta inexistente con sesión: no encontrado', async () => {
    iniciarSesionComo('COMPRAS')
    expect((await ir(crear(), '/no/existe')).name).toBe('no-encontrado')
  })

  it('ventas: ADMIN y VENDEDOR; /ventas/nueva no se toma como un :id', async () => {
    iniciarSesionComo('BODEGUERO')
    expect((await ir(crear(), '/ventas')).name).toBe('sin-permiso')
    setActivePinia(createPinia())
    iniciarSesionComo('VENDEDOR')
    const router = crear()
    expect((await ir(router, '/ventas/nueva')).name).toBe('venta-nueva')
    expect((await ir(router, '/ventas/25')).params.id).toBe('25')
  })

  it('stock bajo: ADMIN, BODEGUERO y COMPRAS (no VENDEDOR)', async () => {
    iniciarSesionComo('VENDEDOR')
    expect((await ir(crear(), '/productos/stock-bajo')).name).toBe('sin-permiso')
    setActivePinia(createPinia())
    iniciarSesionComo('COMPRAS')
    expect((await ir(crear(), '/productos/stock-bajo')).name).toBe('stock-bajo')
  })

  it('clientes: ADMIN y VENDEDOR; el detalle solo acepta un id numérico', async () => {
    iniciarSesionComo('BODEGUERO')
    expect((await ir(crear(), '/clientes/3')).name).toBe('sin-permiso')
    setActivePinia(createPinia())
    iniciarSesionComo('VENDEDOR')
    const router = crear()
    const r = await ir(router, '/clientes/3')
    expect(r.name).toBe('cliente')
    expect(r.params.id).toBe('3')
    expect((await ir(router, '/clientes/abc')).name).toBe('no-encontrado')
  })

  it('menú: según meta.roles, y solo con rutas que existen', () => {
    const router = crear()
    const nombres = (rol: Rol) => menuPara(router, rol).map((e) => e.ruta)
    expect(nombres('ADMIN')).toEqual([
      'inicio',
      'ventas',
      'clientes',
      'productos',
      'proveedores',
      'usuarios',
    ])
    expect(nombres('VENDEDOR')).toEqual(['inicio', 'ventas', 'clientes', 'productos'])
    expect(nombres('BODEGUERO')).toEqual(['inicio', 'productos', 'proveedores'])
    expect(nombres('COMPRAS')).toEqual(['inicio', 'productos', 'proveedores'])
    expect(menuPara(router, null)).toEqual([])
  })
})

describe('rutaDeRegreso', () => {
  it.each([
    ['/ventas/3?x=1', '/ventas/3?x=1'],
    ['//sitio-malo.com', '/'],
    ['https://sitio-malo.com', '/'],
    [undefined, '/'],
    [['/a', '/b'], '/'],
  ])('%p → %p', (entrada, esperado) => {
    expect(rutaDeRegreso(entrada)).toBe(esperado)
  })
})
