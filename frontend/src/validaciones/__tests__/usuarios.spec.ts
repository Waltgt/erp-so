// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  erroresDelServidor,
  validarCambioPassword,
  validarRestablecerPassword,
  validarUsuario,
  type FormularioUsuario,
} from '../usuarios'

const valido: FormularioUsuario = {
  nombre: 'Ana López',
  email: 'ana@empresa.com',
  rol: 'VENDEDOR',
  password: 'Prueba-2026!',
  confirmacion: 'Prueba-2026!',
}

describe('validarCambioPassword', () => {
  it('válido: sin errores', () => {
    expect(
      validarCambioPassword({
        passwordActual: 'actual',
        passwordNueva: 'nueva-12345',
        confirmacion: 'nueva-12345',
      }),
    ).toEqual({})
  })

  it('falta la actual, nueva corta y confirmación distinta', () => {
    expect(
      validarCambioPassword({ passwordActual: '', passwordNueva: 'corta', confirmacion: 'otra' }),
    ).toEqual({
      passwordActual: expect.any(String),
      passwordNueva: 'Debe tener al menos 10 caracteres',
      confirmacion: 'Las contraseñas no coinciden',
    })
  })

  it('la nueva debe ser distinta de la actual', () => {
    expect(
      validarCambioPassword({
        passwordActual: 'misma-12345',
        passwordNueva: 'misma-12345',
        confirmacion: 'misma-12345',
      }).passwordNueva,
    ).toBe('Debe ser distinta de la actual')
  })

  it('los espacios cuentan (no se recorta)', () => {
    const errores = validarCambioPassword({
      passwordActual: 'x',
      passwordNueva: '     abcde',
      confirmacion: '     abcde',
    })
    expect(errores).toEqual({})
  })
})

describe('validarUsuario', () => {
  it('crear: válido', () => {
    expect(validarUsuario(valido, 'crear')).toEqual({})
  })

  it('crear: nombre vacío, email inválido, sin rol, contraseñas', () => {
    expect(
      validarUsuario(
        { nombre: '   ', email: 'ana', rol: null, password: 'x', confirmacion: 'y' },
        'crear',
      ),
    ).toEqual({
      nombre: 'Escribe el nombre',
      email: 'Escribe un correo válido',
      rol: 'Elige un rol',
      password: 'Debe tener al menos 10 caracteres',
      confirmacion: 'Las contraseñas no coinciden',
    })
  })

  it('editar: no valida email ni contraseña', () => {
    expect(
      validarUsuario({ ...valido, email: '', password: '', confirmacion: '' }, 'editar'),
    ).toEqual({})
  })

  it('nombre de más de 100 caracteres', () => {
    expect(validarUsuario({ ...valido, nombre: 'x'.repeat(101) }, 'editar').nombre).toBe(
      'Máximo 100 caracteres',
    )
  })
})

describe('validarRestablecerPassword', () => {
  it('mínimo 10 y confirmación', () => {
    expect(validarRestablecerPassword('1234567890', '1234567890')).toEqual({})
    expect(validarRestablecerPassword('123', '124')).toEqual({
      password: expect.any(String),
      confirmacion: expect.any(String),
    })
  })
})

describe('erroresDelServidor', () => {
  it('une las listas de mensajes por campo', () => {
    expect(
      erroresDelServidor({ email: ['Registro duplicado: email'], nombre: ['a', 'b'] }),
    ).toEqual({ email: 'Registro duplicado: email', nombre: 'a b' })
  })
})
