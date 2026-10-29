import type { Dinero, FechaIso } from '@/types/api'

const ZONA = 'America/Guatemala'

const MONEDA = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' })

const PARTES_FECHA = new Intl.DateTimeFormat('es-GT', {
  timeZone: ZONA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

// Solo para MOSTRAR: el backend manda el dinero como string (Decimal) y el
// total oficial es siempre el suyo. Number alcanza para formatear un
// Decimal(12,2), pero no se usa para calcular lo que se guarda.
export function formatoDinero(valor: Dinero | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') {
    return ''
  }
  const numero = Number(valor)
  return Number.isFinite(numero) ? MONEDA.format(numero) : valor
}

// dd/MM/yyyy HH:mm en la hora de Guatemala, sin importar la zona del equipo.
// Se arma con las partes para no depender de los separadores del navegador.
export function formatoFecha(valor: FechaIso | Date | null | undefined): string {
  if (!valor) {
    return ''
  }
  const fecha = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(fecha.getTime())) {
    return ''
  }
  const p = Object.fromEntries(
    PARTES_FECHA.formatToParts(fecha).map((parte) => [parte.type, parte.value]),
  )
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}

// 4194304 → "4 MB" (archivos)
export function formatoTamano(bytes: number): string {
  const unidades = ['B', 'KB', 'MB', 'GB']
  let valor = bytes
  let i = 0
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024
    i++
  }
  const decimales = i === 0 || valor >= 10 ? 0 : 1
  return `${valor.toLocaleString('es-GT', { maximumFractionDigits: decimales })} ${unidades[i]}`
}

export function useFormato() {
  return { dinero: formatoDinero, fecha: formatoFecha, tamano: formatoTamano }
}
