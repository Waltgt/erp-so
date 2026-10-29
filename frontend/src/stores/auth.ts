import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as apiAuth from '@/api/auth'
import { esErrorApi } from '@/api/http'
import { ROLES, type Rol, type Usuario } from '@/types/auth'

// Copia de la sesión en localStorage, para sobrevivir a la recarga.
// Riesgo aceptado (docs/frontend/00-base.md): un XSS podría leerla. Por eso
// no hay v-html con datos de la API y el token nunca va a una URL ni a la
// consola.
export const CLAVE_SESION = 'erp.sesion'

interface SesionGuardada {
  accessToken: string
  usuario: Usuario
}

// Lo que haya en localStorage puede estar corrupto o haber sido editado a
// mano: solo se acepta si tiene la forma esperada
function leerSesionGuardada(): SesionGuardada | null {
  try {
    const crudo = localStorage.getItem(CLAVE_SESION)
    if (!crudo) {
      return null
    }
    const sesion = JSON.parse(crudo) as Partial<SesionGuardada> | null
    const usuario = sesion?.usuario
    if (
      typeof sesion?.accessToken === 'string' &&
      sesion.accessToken !== '' &&
      typeof usuario?.id === 'number' &&
      typeof usuario.nombre === 'string' &&
      ROLES.includes(usuario.rol)
    ) {
      return { accessToken: sesion.accessToken, usuario }
    }
  } catch {
    // JSON inválido o localStorage no disponible
  }
  return null
}

function escribirSesionGuardada(sesion: SesionGuardada | null): void {
  try {
    if (sesion) {
      localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion))
    } else {
      localStorage.removeItem(CLAVE_SESION)
    }
  } catch {
    // Sin localStorage (modo privado estricto): la sesión vive solo en memoria
  }
}

export const useAuthStore = defineStore('auth', () => {
  const guardada = leerSesionGuardada()
  const accessToken = ref<string | null>(guardada?.accessToken ?? null)
  const usuario = ref<Usuario | null>(guardada?.usuario ?? null)

  const autenticado = computed(() => accessToken.value !== null && usuario.value !== null)
  const rol = computed<Rol | null>(() => usuario.value?.rol ?? null)

  function establecer(sesion: SesionGuardada | null): void {
    accessToken.value = sesion?.accessToken ?? null
    usuario.value = sesion?.usuario ?? null
    escribirSesionGuardada(sesion)
  }

  async function iniciarSesion(email: string, password: string): Promise<Usuario> {
    const respuesta = await apiAuth.login({ email, password })
    establecer(respuesta)
    return respuesta.usuario
  }

  // Al arrancar con una sesión guardada: GET /auth/me. Si responde 401 (token
  // vencido o usuario desactivado) se borra la sesión. Si el backend no
  // responde, la sesión se conserva: la próxima llamada lo volverá a intentar.
  async function verificarSesion(): Promise<boolean> {
    if (!accessToken.value) {
      return false
    }
    try {
      const actual = await apiAuth.obtenerUsuarioActual()
      // El rol o el nombre pudieron cambiar desde el login
      establecer({ accessToken: accessToken.value, usuario: actual })
      return true
    } catch (error) {
      if (esErrorApi(error) && error.response?.status === 401) {
        cerrarSesion()
        return false
      }
      return autenticado.value
    }
  }

  // El usuario de la sesión cambió (ej. el ADMIN editó su propio nombre)
  function actualizarUsuarioActual(actual: Usuario): void {
    if (accessToken.value && actual.id === usuario.value?.id) {
      establecer({ accessToken: accessToken.value, usuario: actual })
    }
  }

  function cerrarSesion(): void {
    establecer(null)
  }

  // Si alguien borró o cambió la copia de localStorage (a mano, o al cerrar
  // sesión en otra pestaña), la memoria se alinea con ella. Lo usa el guard
  // del router en cada navegación.
  function sincronizarConAlmacenamiento(): void {
    const actual = leerSesionGuardada()
    if (actual?.accessToken !== accessToken.value) {
      accessToken.value = actual?.accessToken ?? null
      usuario.value = actual?.usuario ?? null
    }
  }

  // Solo para mostrar u ocultar cosas: la autorización real es del backend
  function tieneRol(...roles: readonly Rol[]): boolean {
    return rol.value !== null && roles.includes(rol.value)
  }

  return {
    accessToken,
    usuario,
    autenticado,
    rol,
    iniciarSesion,
    verificarSesion,
    actualizarUsuarioActual,
    cerrarSesion,
    sincronizarConAlmacenamiento,
    tieneRol,
  }
})
