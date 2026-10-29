import 'primeicons/primeicons.css'
import './assets/base.css'

import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import { createApp } from 'vue'

import App from './App.vue'
import { opcionesPrimeVue } from './config/primevue'
import { crearRouter } from './router'
import { conectarSesion } from './sesion'
import { useAuthStore } from './stores/auth'

async function iniciar(): Promise<void> {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)

  const router = crearRouter()
  const auth = useAuthStore(pinia)
  conectarSesion(auth, router)

  // Con una sesión guardada, confirmar con /auth/me ANTES de la primera
  // navegación: si el token venció o el usuario fue desactivado (401), la
  // sesión se borra y el guard lleva al login
  await auth.verificarSesion()

  app.use(router)
  app.use(PrimeVue, opcionesPrimeVue)
  app.use(ToastService)
  app.use(ConfirmationService)
  app.directive('tooltip', Tooltip)

  // Cerrar sesión en otra pestaña (o borrar el token a mano) saca también
  // de esta, sin esperar a la próxima navegación
  window.addEventListener('storage', () => {
    const antes = auth.autenticado
    auth.sincronizarConAlmacenamiento()
    if (antes && !auth.autenticado) {
      void router.replace({ name: 'login' })
    }
  })

  await router.isReady()
  app.mount('#app')
}

void iniciar()
