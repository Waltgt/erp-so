// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { formatoDinero, formatoDuracion, formatoFecha, formatoTamano } from '../useFormato'

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

  it('duración en m:ss (o h:mm:ss); desconocida vacía', () => {
    expect(formatoDuracion(185)).toBe('3:05')
    expect(formatoDuracion(59.9)).toBe('0:59')
    expect(formatoDuracion(3725)).toBe('1:02:05')
    expect(formatoDuracion(null)).toBe('')
    expect(formatoDuracion(Number.NaN)).toBe('')
  })
})
