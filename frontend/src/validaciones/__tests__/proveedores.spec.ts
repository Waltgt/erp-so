// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { ProveedorConProductos } from '@/types/proveedores'
import {
  cambiosDeProveedor,
  datosNuevoProveedor,
  formularioDeProveedor,
  validarProveedor,
} from '../proveedores'

const sol: ProveedorConProductos = {
  id: 1,
  nit: '12345678',
  nombre: 'Distribuidora El Sol',
  contacto: 'María Gómez',
  telefono: null,
  email: null,
  direccion: null,
  activo: true,
  creadoEn: '2026-10-01T00:00:00.000Z',
  actualizadoEn: '2026-10-01T00:00:00.000Z',
  productosActivos: 2,
}

const vacio = formularioDeProveedor(null)

describe('validarProveedor', () => {
  it('válido con NIT y nombre', () => {
    expect(validarProveedor({ ...vacio, nit: '1234-5', nombre: 'X' })).toEqual({})
  })

  it('el NIT CF no se rechaza en el cliente: lo rechaza el backend', () => {
    expect(validarProveedor({ ...vacio, nit: 'CF', nombre: 'X' })).toEqual({})
  })

  it('NIT vacío, contacto largo y email inválido', () => {
    const errores = validarProveedor({
      ...vacio,
      nombre: 'X',
      contacto: 'x'.repeat(101),
      email: 'no-es-email',
    })
    expect(Object.keys(errores).sort()).toEqual(['contacto', 'email', 'nit'])
  })
})

describe('datos para la API', () => {
  it('crear: opcionales vacíos como null', () => {
    expect(datosNuevoProveedor({ ...vacio, nit: ' 1234-5 ', nombre: 'X' })).toEqual({
      nit: '1234-5',
      nombre: 'X',
      contacto: null,
      telefono: null,
      email: null,
      direccion: null,
    })
  })

  it('editar: solo lo que cambió (productosActivos no se envía)', () => {
    expect(cambiosDeProveedor(sol, formularioDeProveedor(sol))).toEqual({})
    expect(cambiosDeProveedor(sol, { ...formularioDeProveedor(sol), contacto: '' })).toEqual({
      contacto: null,
    })
  })
})
