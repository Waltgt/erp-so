// @vitest-environment node
import { AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { login } from '../auth'
import { configurarSesionHttp, esErrorApi, http } from '../http'

// Adaptador falso: responde `status` y guarda la petición que llegó
function responder(status: number, data: unknown = {}) {
  const peticiones: InternalAxiosRequestConfig[] = []
  const adaptador: AxiosAdapter = (config) => {
    peticiones.push(config)
    const respuesta = { data, status, statusText: '', headers: new AxiosHeaders(), config }
    return status < 400
      ? Promise.resolve(respuesta)
      : Promise.reject(
          Object.assign(new Error(`HTTP ${status}`), {
            isAxiosError: true,
            config,
            response: respuesta,
          }),
        )
  }
  http.defaults.adapter = adaptador
  return peticiones
}

describe('http', () => {
  const alSesionTerminada = vi.fn<() => void>()
  let token: string | null

  beforeEach(() => {
    token = 'abc.def.ghi'
    alSesionTerminada.mockReset()
    configurarSesionHttp({ obtenerToken: () => token, alSesionTerminada })
  })

  afterEach(() => {
    http.defaults.adapter = undefined
  })

  it('usa rutas relativas bajo /api', () => {
    expect(http.defaults.baseURL).toBe('/api')
  })

  it('agrega el token como Bearer', async () => {
    const peticiones = responder(200)
    await http.get('/clientes')
    expect(peticiones[0]?.headers.Authorization).toBe('Bearer abc.def.ghi')
  })

  it('sin sesión no envía Authorization', async () => {
    token = null
    const peticiones = responder(200)
    await http.get('/clientes')
    expect(peticiones[0]?.headers.Authorization).toBeUndefined()
  })

  it('un 401 cualquiera termina la sesión', async () => {
    responder(401, { statusCode: 401, message: 'Unauthorized' })
    await expect(http.get('/clientes')).rejects.toThrow('HTTP 401')
    expect(alSesionTerminada).toHaveBeenCalledOnce()
  })

  it('el 401 del login (contraseña mala) NO termina la sesión', async () => {
    responder(401, { statusCode: 401, message: 'Credenciales inválidas' })
    await expect(login({ email: 'a@b.com', password: 'x' })).rejects.toThrow('HTTP 401')
    expect(alSesionTerminada).not.toHaveBeenCalled()
  })

  it('otros errores (403, 409) no terminan la sesión', async () => {
    responder(403)
    await expect(http.get('/usuarios')).rejects.toThrow('HTTP 403')
    responder(409)
    await expect(http.delete('/carpetas/1')).rejects.toThrow('HTTP 409')
    expect(alSesionTerminada).not.toHaveBeenCalled()
  })

  it('esErrorApi reconoce el cuerpo de error de NestJS', async () => {
    responder(400, { statusCode: 400, message: ['nombre no debe estar vacío'] })
    const error = await http.post('/clientes', {}).catch((e: unknown) => e)
    expect(esErrorApi(error)).toBe(true)
    expect(esErrorApi(new Error('red'))).toBe(false)
  })
})
