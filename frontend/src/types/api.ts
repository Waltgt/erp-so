// Formas comunes de las respuestas del backend (docs/modulos/00-base.md)

// Listados: ?page=1&limit=20 (limit máximo 100)
export interface Paginado<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export interface ParametrosPaginacion {
  page?: number
  limit?: number
}

export const LIMITE_MAXIMO = 100

// Cuerpo de error de NestJS. En un 400 del ValidationPipe, `message` es la
// lista de mensajes de validación; en los demás casos, un solo texto.
export interface ErrorApi {
  statusCode: number
  message: string | string[]
  error?: string
}

// Las fechas llegan en ISO 8601 (JSON no tiene tipo fecha)
export type FechaIso = string

// El dinero llega como string (Decimal(12,2)): nunca convertirlo a number
// para calcular algo que se vaya a guardar
export type Dinero = string
