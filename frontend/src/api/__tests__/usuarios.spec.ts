// @vitest-environment node
import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cambiarPassword } from '../auth'
import { http } from '../http'
import {
  actualizarUsuario,
  crearUsuario,
  listarUsuarios,
  obtenerUsuario,
  restablecerPassword,
} from '../usuarios'

describe('api de usuarios', () => {
  let peticiones: InternalAxiosRequestConfig[]

  beforeEach(() => {
    peticiones = []
    http.defaults.adapter = (config) => {
      peticiones.push(config)
      return Promise.resolve({
        data: { data: [], total: 0, page: 1, limit: 20 },
        status: 200,
        statusText: '',
        headers: new AxiosHeaders(),
        config,
      })
    }
  })

  afterEach(() => {
    http.defaults.adapter = undefined
  })

  const ultima = () => {
    const p = peticiones[peticiones.length - 1]!
    return {
      metodo: p.method,
      ruta: p.url,
      params: p.params as unknown,
      body: typeof p.data === 'string' ? (JSON.parse(p.data) as unknown) : undefined,
    }
  }

  it('listar: GET /usuarios con paginación e incluirInactivos', async () => {
    await listarUsuarios({ page: 2, limit: 10, incluirInactivos: true })
    expect(ultima()).toMatchObject({
      metodo: 'get',
      ruta: '/usuarios',
      params: { page: 2, limit: 10, incluirInactivos: true },
    })
  })

  it('obtener: GET /usuarios/:id', async () => {
    await obtenerUsuario(7)
    expect(ultima()).toMatchObject({ metodo: 'get', ruta: '/usuarios/7' })
  })

  it('crear: POST /usuarios con el body completo', async () => {
    const datos = {
      nombre: 'Ana',
      email: 'ana@empresa.com',
      password: 'Prueba-2026!',
      rol: 'VENDEDOR' as const,
    }
    await crearUsuario(datos)
    expect(ultima()).toMatchObject({ metodo: 'post', ruta: '/usuarios', body: datos })
  })

  it('activar/desactivar y editar: PATCH /usuarios/:id solo con lo que cambia', async () => {
    await actualizarUsuario(3, { activo: false })
    expect(ultima()).toMatchObject({
      metodo: 'patch',
      ruta: '/usuarios/3',
      body: { activo: false },
    })
  })

  it('restablecer contraseña: PATCH /usuarios/:id/password', async () => {
    await restablecerPassword(3, { password: 'Nueva-2026!' })
    expect(ultima()).toMatchObject({
      metodo: 'patch',
      ruta: '/usuarios/3/password',
      body: { password: 'Nueva-2026!' },
    })
  })

  it('cambiar la propia contraseña: PATCH /auth/password', async () => {
    await cambiarPassword({ passwordActual: 'a'.repeat(10), passwordNueva: 'b'.repeat(10) })
    expect(ultima()).toMatchObject({
      metodo: 'patch',
      ruta: '/auth/password',
      body: { passwordActual: 'a'.repeat(10), passwordNueva: 'b'.repeat(10) },
    })
  })
})
