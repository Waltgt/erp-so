// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { formatoDinero, formatoFecha, formatoTamano } from '../useFormato'

describe('useFormato', () => {
  it('dinero (string del backend) en quetzales', () => {
    // El espacio después de "Q" depende de los datos de ICU del motor
    expect(formatoDinero('1234.5')).toMatch(/^Q\s?1,234\.50$/u)
    expect(formatoDinero('0.00')).toMatch(/^Q\s?0\.00$/u)
    expect(formatoDinero(null)).toBe('')
    expect(formatoDinero('no-numero')).toBe('no-numero')
  })

  it('fecha: dd/MM/yyyy HH:mm en America/Guatemala (UTC-6)', () => {
    expect(formatoFecha('2026-10-29T02:05:00.000Z')).toBe('28/10/2026 20:05')
    expect(formatoFecha('2026-01-01T06:00:00Z')).toBe('01/01/2026 00:00')
    expect(formatoFecha('')).toBe('')
    expect(formatoFecha('no es fecha')).toBe('')
  })

  it('tamaño de archivo', () => {
    expect(formatoTamano(512)).toBe('512 B')
    expect(formatoTamano(1536)).toBe('1.5 KB')
    expect(formatoTamano(4 * 1024 * 1024)).toBe('4 MB')
    expect(formatoTamano(15 * 1024 * 1024)).toBe('15 MB')
  })
})
