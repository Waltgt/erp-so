import { START_LOCATION, type Router } from 'vue-router'
import { configurarSesionHttp } from '@/api/http'
import type { useAuthStore } from '@/stores/auth'

export const MOTIVO_SESION_TERMINADA = 'sesion-terminada'

// Conecta axios con la sesión: el token sale del store y cualquier 401 (fuera
// del login) borra la sesión y lleva a /login con el aviso "Tu sesión
// terminó", recordando la ruta para volver a ella después.
export function conectarSesion(auth: ReturnType<typeof useAuthStore>, router: Router): void {
  configurarSesionHttp({
    obtenerToken: () => auth.accessToken,
    alSesionTerminada: () => {
      auth.cerrarSesion()
      const actual = router.currentRoute.value
      // Antes de la primera navegación (verificación al arrancar) o ya en
      // una ruta pública: el guard se encarga
      if (actual === START_LOCATION || actual.meta.publica) {
        return
      }
      void router.replace({
        name: 'login',
        query: { redirect: actual.fullPath, motivo: MOTIVO_SESION_TERMINADA },
      })
    },
  })
}
