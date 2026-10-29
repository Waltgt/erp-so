// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Cliente } from '@/types/clientes'
import {
  cambiosDeCliente,
  datosNuevoCliente,
  formularioDeCliente,
  validarCliente,
  type FormularioCliente,
} from '../clientes'

const valido: FormularioCliente = {
  nit: '1234567-8',
  nombre: 'Juan Pérez',
  email: '',
  telefono: '',
  direccion: '',
}

const juan: Cliente = {
  id: 1,
  nit: '12345678',
  nombre: 'Juan Pérez',
  email: 'juan@correo.com',
  telefono: null,
  direccion: 'Zona 1',
  activo: true,
  creadoEn: '2026-10-01T00:00:00.000Z',
  actualizadoEn: '2026-10-01T00:00:00.000Z',
}

describe('validarCliente', () => {
  it('solo NIT y nombre: válido (también CF)', () => {
    expect(validarCliente(valido)).toEqual({})
    expect(validarCliente({ ...valido, nit: 'CF' })).toEqual({})
  })

  it('NIT y nombre vacíos', () => {
    expect(Object.keys(validarCliente({ ...valido, nit: ' ', nombre: '  ' }))).toEqual([
      'nit',
      'nombre',
    ])
  })

  it.each([
    ['nombre de más de 150', { nombre: 'x'.repeat(151) }, 'nombre'],
    ['email inválido', { email: 'no-es-email' }, 'email'],
    ['teléfono con letras', { telefono: 'llamar luego' }, 'telefono'],
    ['teléfono corto', { telefono: '123' }, 'telefono'],
    ['dirección de más de 255', { direccion: 'x'.repeat(256) }, 'direccion'],
  ])('rechaza %s', (_caso, cambio, campo) => {
    expect(validarCliente({ ...valido, ...cambio })).toHaveProperty(campo)
  })

  it('acepta un teléfono con +, espacios y guiones', () => {
    expect(validarCliente({ ...valido, telefono: '+502 5555-1234' })).toEqual({})
  })
})

describe('datos para la API', () => {
  it('crear: recorta y envía null en los opcionales vacíos', () => {
    expect(datosNuevoCliente({ ...valido, nombre: ' Juan Pérez ', direccion: '  ' })).toEqual({
      nit: '1234567-8',
      nombre: 'Juan Pérez',
      email: null,
      telefono: null,
      direccion: null,
    })
  })

  it('editar sin cambios: body vacío', () => {
    expect(cambiosDeCliente(juan, formularioDeCliente(juan))).toEqual({})
  })

  it('editar: solo lo que cambió; vaciar un opcional envía null', () => {
    const f = { ...formularioDeCliente(juan), telefono: '5555-1234', direccion: '' }
    expect(cambiosDeCliente(juan, f)).toEqual({ telefono: '5555-1234', direccion: null })
  })
})
