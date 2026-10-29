// @vitest-environment node
import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { traducirError } from '../useApiError'

function errorHttp(status: number, message: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError(`HTTP ${status}`, 'ERR', config, null, {
    status,
    statusText: '',
    data: { statusCode: status, message },
    headers: {},
    config,
  })
}

describe('traducirError', () => {
  it('400 con lista: separa los mensajes por campo conocido', () => {
    const r = traducirError(
      errorHttp(400, [
        'nombre no puede quedar vacío',
        'email debe ser un correo válido',
        'items.0.cantidad must not be less than 1',
        'property extra should not exist',
      ]),
      ['nombre', 'email', 'items'],
    )
    expect(r.status).toBe(400)
    expect(r.campos).toEqual({
      nombre: ['nombre no puede quedar vacío'],
      email: ['email debe ser un correo válido'],
      'items.0.cantidad': ['items.0.cantidad must not be less than 1'],
    })
    expect(r.mensajes).toEqual(['property extra should not exist'])
  })

  it('400 con un solo texto del servicio: va al Toast, no a un campo', () => {
    const r = traducirError(errorHttp(400, 'El archivo está vacío'), ['archivo'])
    expect(r.campos).toEqual({})
    expect(r.mensajes).toEqual(['El archivo está vacío'])
  })

  it('400 solo con errores de campo: nada para el Toast', () => {
    const r = traducirError(errorHttp(400, ['nombre no puede quedar vacío']), ['nombre'])
    expect(r.mensajes).toEqual([])
  })

  it.each([
    [403, 'Forbidden resource', 'No tienes permiso para hacer esto.'],
    [404, 'Cliente no encontrado', 'No encontrado.'],
    [429, 'ThrottlerException', 'Demasiados intentos, espera un momento.'],
  ])('%i: mensaje fijo', (status, delBackend, esperado) => {
    expect(traducirError(errorHttp(status, delBackend)).mensajes).toEqual([esperado])
  })

  it.each([
    [409, 'La carpeta no está vacía: tiene 1 subcarpeta(s) y 0 archivo(s)'],
    [413, 'El archivo supera el máximo de 50 MB'],
    [415, 'Tipo de archivo no permitido: application/x-msdownload'],
  ])('%i: el mensaje del backend', (status, mensaje) => {
    const r = traducirError(errorHttp(status, mensaje))
    expect(r.mensajes).toEqual([mensaje])
  })

  it('500: mensaje genérico (nunca el detalle del servidor)', () => {
    const r = traducirError(errorHttp(500, 'Error interno'))
    expect(r.titulo).toBe('Error del servidor')
    expect(r.mensajes[0]).toMatch(/inesperado/)
  })

  it('sin respuesta: problema de conexión', () => {
    expect(traducirError(new Error('Network Error'))).toMatchObject({
      status: null,
      titulo: 'Sin conexión',
    })
    const agotado = new AxiosError('timeout', 'ECONNABORTED')
    expect(traducirError(agotado).mensajes[0]).toMatch(/tardó demasiado/)
  })

  it('409 "Registro duplicado: email": junto al campo si el formulario lo declara', () => {
    const conCampo = traducirError(errorHttp(409, 'Registro duplicado: email'), ['email'])
    expect(conCampo.campos).toEqual({ email: ['Registro duplicado: email'] })
    expect(conCampo.mensajes).toEqual([])

    const sinCampo = traducirError(errorHttp(409, 'Registro duplicado: email'))
    expect(sinCampo.mensajes).toEqual(['Registro duplicado: email'])
  })

  it('otro 409 (último admin) va al Toast aunque haya campos', () => {
    const r = traducirError(
      errorHttp(409, 'No se puede desactivar al último administrador activo'),
      ['activo', 'rol'],
    )
    expect(r.campos).toEqual({})
    expect(r.mensajes).toHaveLength(1)
  })
})
