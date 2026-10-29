// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Archivo, Carpeta } from '@/types/archivos'
import { filtrarNivel, validarNombreArchivo, validarNombreCarpeta, visorDe } from '../archivos'

function carpeta(id: number, nombre: string): Carpeta {
  return { id, nombre, parentId: null, usuarioId: 1, creadoEn: '2026-10-01T00:00:00.000Z' }
}

function archivo(
  id: number,
  nombreOriginal: string,
  tipo: Archivo['tipo'],
  mimeType = '',
): Archivo {
  return {
    id,
    nombreOriginal,
    mimeType,
    tamanoBytes: 10,
    tipo,
    duracionSeg: null,
    carpetaId: null,
    usuarioId: 1,
    creadoEn: '2026-10-01T00:00:00.000Z',
  }
}

describe('validarNombreCarpeta', () => {
  it('acepta un nombre normal (recortado)', () => {
    expect(validarNombreCarpeta('  Facturas 2026 ')).toBeNull()
    expect(validarNombreCarpeta('Música')).toBeNull()
  })

  it('rechaza vacío, largo, barras, control, "." y ".."', () => {
    expect(validarNombreCarpeta('   ')).toBe('Escribe un nombre')
    expect(validarNombreCarpeta('a'.repeat(101))).toBe('Máximo 100 caracteres')
    expect(validarNombreCarpeta('a'.repeat(100))).toBeNull()
    expect(validarNombreCarpeta('a/b')).toMatch(/\//)
    expect(validarNombreCarpeta('a\\b')).toMatch(/\//)
    expect(validarNombreCarpeta('a\u0007b')).toBe('Tiene caracteres no permitidos')
    expect(validarNombreCarpeta('a​b')).toBe('Tiene caracteres no permitidos')
    expect(validarNombreCarpeta('.')).toMatch(/"\."/)
    expect(validarNombreCarpeta(' .. ')).toMatch(/"\."/)
  })

  it('cuenta un emoji como un carácter', () => {
    expect(validarNombreCarpeta('😀'.repeat(100))).toBeNull()
  })
})

describe('validarNombreArchivo', () => {
  it('acepta hasta 255 y rechaza vacío', () => {
    expect(validarNombreArchivo('informe.pdf')).toBeNull()
    expect(validarNombreArchivo('a'.repeat(255))).toBeNull()
    expect(validarNombreArchivo('a'.repeat(256))).toBe('Máximo 255 caracteres')
    expect(validarNombreArchivo('  ')).toBe('Escribe un nombre')
  })
})

describe('filtrarNivel', () => {
  const contenido = {
    carpetas: [carpeta(1, 'Fotos'), carpeta(2, 'Facturas')],
    archivos: [
      archivo(1, 'Canción.mp3', 'MUSICA'),
      archivo(2, 'foto-playa.png', 'IMAGEN'),
      archivo(3, 'factura.pdf', 'DOCUMENTO'),
    ],
  }

  it('sin filtros devuelve todo', () => {
    expect(filtrarNivel(contenido, '', null)).toEqual(contenido)
  })

  it('busca en carpetas y archivos sin distinguir mayúsculas', () => {
    const r = filtrarNivel(contenido, ' FOT ', null)
    expect(r.carpetas.map((c) => c.id)).toEqual([1])
    expect(r.archivos.map((a) => a.id)).toEqual([2])
    expect(filtrarNivel(contenido, 'canción', null).archivos.map((a) => a.id)).toEqual([1])
  })

  it('con tipo oculta las carpetas', () => {
    const r = filtrarNivel(contenido, '', 'DOCUMENTO')
    expect(r.carpetas).toEqual([])
    expect(r.archivos.map((a) => a.id)).toEqual([3])
    expect(filtrarNivel(contenido, 'playa', 'DOCUMENTO').archivos).toEqual([])
  })
})

describe('visorDe', () => {
  it('elige el visor por tipo y el PDF por MIME', () => {
    expect(visorDe({ tipo: 'MUSICA', mimeType: 'audio/mpeg' })).toBe('audio')
    expect(visorDe({ tipo: 'VIDEO', mimeType: 'video/mp4' })).toBe('video')
    expect(visorDe({ tipo: 'IMAGEN', mimeType: 'image/png' })).toBe('imagen')
    expect(visorDe({ tipo: 'DOCUMENTO', mimeType: 'application/pdf' })).toBe('pdf')
    expect(visorDe({ tipo: 'DOCUMENTO', mimeType: 'text/plain' })).toBe('descargar')
    expect(visorDe({ tipo: 'OTRO', mimeType: 'application/zip' })).toBe('descargar')
  })
})
