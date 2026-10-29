import axios, { isAxiosError, type AxiosError } from 'axios'
import type { ErrorApi } from '@/types/api'

declare module 'axios' {
  interface AxiosRequestConfig {
    // En esta petición un 401 es una respuesta esperada (ej. login con la
    // contraseña equivocada), no una sesión vencida
    omitirSesionTerminada?: boolean
  }
}

// Lo que http necesita de la sesión. Lo conecta el store de auth al arrancar
// (así este archivo no importa el store y no hay dependencias circulares).
export interface SesionHttp {
  obtenerToken: () => string | null
  // Un 401: token vencido, inválido o usuario desactivado
  alSesionTerminada: () => void
}

let sesion: SesionHttp = {
  obtenerToken: () => null,
  alSesionTerminada: () => undefined,
}

export function configurarSesionHttp(nueva: SesionHttp): void {
  sesion = nueva
}

// Única instancia de axios. Rutas siempre relativas (/api/...): en desarrollo
// las reenvía el proxy de Vite y en producción Nginx (mismo origen, sin CORS).
export const http = axios.create({
  baseURL: '/api',
  timeout: 30_000,
})

http.interceptors.request.use((config) => {
  const token = sesion.obtenerToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(undefined, (error: unknown) => {
  if (
    isAxiosError(error) &&
    error.response?.status === 401 &&
    !error.config?.omitirSesionTerminada
  ) {
    sesion.alSesionTerminada()
  }
  return Promise.reject(error)
})

// Error HTTP con el cuerpo de error de NestJS
export function esErrorApi(error: unknown): error is AxiosError<ErrorApi> {
  return isAxiosError(error) && typeof error.response?.data === 'object'
}
