import { AxiosError, AxiosHeaders } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as apiAuth from '@/api/auth'
import type { Usuario } from '@/types/auth'
import { CLAVE_SESION, useAuthStore } from '../auth'

vi.mock('@/api/auth')

const ana: Usuario = {
  id: 2,
  nombre: 'Ana',
  email: 'ana@empresa.com',
  rol: 'VENDEDOR',
  activo: true,
  creadoEn: '2026-10-01T00:00:00.000Z',
  actualizadoEn: '2026-10-01T00:00:00.000Z',
}

function errorHttp(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError(`HTTP ${status}`, 'ERR', config, null, {
    status,
    statusText: '',
    data: { statusCode: status, message: 'x' },
    headers: {},
    config,
  })
}

function guardar(valor: unknown): void {
  localStorage.setItem(CLAVE_SESION, typeof valor === 'string' ? valor : JSON.stringify(valor))
}

describe('store auth', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetAllMocks()
    setActivePinia(createPinia())
  })

  it('sin sesión guardada: no autenticado', () => {
    const auth = useAuthStore()
    expect(auth.autenticado).toBe(false)
    expect(auth.rol).toBeNull()
  })

  it('login: guarda token y usuario en memoria y en localStorage', async () => {
    vi.mocked(apiAuth.login).mockResolvedValue({ accessToken: 'tok', usuario: ana })
    const auth = useAuthStore()

    await auth.iniciarSesion('ana@empresa.com', 'secreto123')

    expect(auth.autenticado).toBe(true)
    expect(auth.tieneRol('ADMIN', 'VENDEDOR')).toBe(true)
    expect(auth.tieneRol('ADMIN')).toBe(false)
    expect(JSON.parse(localStorage.getItem(CLAVE_SESION)!)).toEqual({
      accessToken: 'tok',
      usuario: ana,
    })
  })

  it('al recargar la página recupera la sesión guardada', () => {
    guardar({ accessToken: 'tok', usuario: ana })
    const auth = useAuthStore()
    expect(auth.autenticado).toBe(true)
    expect(auth.usuario?.nombre).toBe('Ana')
  })

  it.each([
    ['JSON inválido', '{no es json'],
    ['sin token', { usuario: ana }],
    ['rol desconocido', { accessToken: 'tok', usuario: { ...ana, rol: 'ROOT' } }],
    ['null', 'null'],
  ])('ignora una sesión guardada inválida (%s)', (_caso, valor) => {
    guardar(valor)
    expect(useAuthStore().autenticado).toBe(false)
  })

  it('verificarSesion: /auth/me actualiza el usuario (ej. cambió el rol)', async () => {
    guardar({ accessToken: 'tok', usuario: ana })
    vi.mocked(apiAuth.obtenerUsuarioActual).mockResolvedValue({ ...ana, rol: 'BODEGUERO' })
    const auth = useAuthStore()

    await expect(auth.verificarSesion()).resolves.toBe(true)
    expect(auth.rol).toBe('BODEGUERO')
    expect(localStorage.getItem(CLAVE_SESION)).toContain('BODEGUERO')
  })

  it('verificarSesion: 401 borra la sesión (token vencido o usuario desactivado)', async () => {
    guardar({ accessToken: 'tok', usuario: ana })
    vi.mocked(apiAuth.obtenerUsuarioActual).mockRejectedValue(errorHttp(401))
    const auth = useAuthStore()

    await expect(auth.verificarSesion()).resolves.toBe(false)
    expect(auth.autenticado).toBe(false)
    expect(localStorage.getItem(CLAVE_SESION)).toBeNull()
  })

  it('verificarSesion: si el backend no responde, conserva la sesión', async () => {
    guardar({ accessToken: 'tok', usuario: ana })
    vi.mocked(apiAuth.obtenerUsuarioActual).mockRejectedValue(new Error('Network Error'))
    const auth = useAuthStore()

    await expect(auth.verificarSesion()).resolves.toBe(true)
    expect(auth.autenticado).toBe(true)
  })

  it('cerrarSesion borra memoria y localStorage', () => {
    guardar({ accessToken: 'tok', usuario: ana })
    const auth = useAuthStore()
    auth.cerrarSesion()
    expect(auth.autenticado).toBe(false)
    expect(localStorage.getItem(CLAVE_SESION)).toBeNull()
  })

  it('actualizarUsuarioActual: cambia el usuario de la sesión, no a otro', () => {
    guardar({ accessToken: 'tok', usuario: ana })
    const auth = useAuthStore()

    auth.actualizarUsuarioActual({ ...ana, id: 99, nombre: 'Otro' })
    expect(auth.usuario?.nombre).toBe('Ana')

    auth.actualizarUsuarioActual({ ...ana, nombre: 'Ana María' })
    expect(auth.usuario?.nombre).toBe('Ana María')
    const guardada = JSON.parse(localStorage.getItem(CLAVE_SESION)!) as { usuario: Usuario }
    expect(guardada.usuario.nombre).toBe('Ana María')
  })

  it('token borrado a mano de localStorage: al sincronizar, sale de la sesión', () => {
    guardar({ accessToken: 'tok', usuario: ana })
    const auth = useAuthStore()
    localStorage.removeItem(CLAVE_SESION)

    auth.sincronizarConAlmacenamiento()
    expect(auth.autenticado).toBe(false)
  })
})
