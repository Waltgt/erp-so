import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { esErrorApi } from '@/api/http'
import { rutaDeRegreso } from '@/router'
import { useAuthStore } from '@/stores/auth'
import { traducirError } from './useApiError'
import { useBloqueoTemporal } from './useBloqueoTemporal'

export const SEGUNDOS_BLOQUEO_LOGIN = 60

export const MENSAJE_CREDENCIALES = 'Email o contraseña incorrectos'
export const MENSAJE_DEMASIADOS_INTENTOS = 'Demasiados intentos. Espera un minuto.'

export interface ResultadoErrorLogin {
  mensaje: string
  bloquear: boolean
}

// Un solo mensaje para email inexistente, contraseña incorrecta y usuario
// desactivado: el backend no los distingue y el front tampoco debe hacerlo.
// 400 (email vacío o sin formato) también: no revela nada distinto.
export function errorDeLogin(error: unknown): ResultadoErrorLogin {
  const status = esErrorApi(error) ? error.response?.status : undefined
  if (status === 401 || status === 400) {
    return { mensaje: MENSAJE_CREDENCIALES, bloquear: false }
  }
  if (status === 429) {
    return { mensaje: MENSAJE_DEMASIADOS_INTENTOS, bloquear: true }
  }
  return { mensaje: traducirError(error).mensajes.join(' '), bloquear: false }
}

// Lógica de la pantalla /login: enviar, mostrar el error, bloquear 60 s tras
// un 429 y, al entrar, volver a la ruta guardada (?redirect=) o al inicio
export function useFormularioLogin() {
  const auth = useAuthStore()
  const router = useRouter()
  const route = useRoute()
  const { bloqueado, restantes, bloquear } = useBloqueoTemporal()

  const enviando = ref(false)
  const error = ref<string | null>(null)

  async function ingresar(email: string, password: string): Promise<void> {
    // El botón ya está deshabilitado, pero Enter en el formulario también envía
    if (enviando.value || bloqueado.value) {
      return
    }
    error.value = null
    enviando.value = true
    try {
      await auth.iniciarSesion(email.trim(), password)
      await router.replace(rutaDeRegreso(route.query.redirect))
    } catch (e) {
      const resultado = errorDeLogin(e)
      error.value = resultado.mensaje
      if (resultado.bloquear) {
        bloquear(SEGUNDOS_BLOQUEO_LOGIN)
      }
    } finally {
      enviando.value = false
    }
  }

  return { ingresar, enviando, error, bloqueado, restantes }
}
