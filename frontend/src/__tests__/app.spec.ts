import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import * as apiProductos from '@/api/productos'
import App from '@/App.vue'
import { opcionesPrimeVue } from '@/config/primevue'
import { crearRouter } from '@/router'
import { CLAVE_SESION } from '@/stores/auth'
import type { Rol } from '@/types/auth'

vi.mock('@/api/productos')

// jsdom no implementa matchMedia (lo usa el layout para el menú)
window.matchMedia = (() => ({
  matches: false,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
})) as unknown as typeof window.matchMedia

async function montarComo(rol: Rol | null, ruta = '/') {
  if (rol) {
    localStorage.setItem(
      CLAVE_SESION,
      JSON.stringify({
        accessToken: 'tok',
        usuario: {
          id: 1,
          nombre: 'Ana López',
          email: 'ana@empresa.com',
          rol,
          activo: true,
          creadoEn: '2026-10-01T00:00:00Z',
          actualizadoEn: '2026-10-01T00:00:00Z',
        },
      }),
    )
  }
  const router = crearRouter(createMemoryHistory())
  const wrapper = mount(App, {
    global: {
      plugins: [
        createPinia(),
        router,
        [PrimeVue, opcionesPrimeVue],
        ToastService,
        ConfirmationService,
      ],
      directives: { tooltip: Tooltip },
    },
  })
  await router.push(ruta)
  await flushPromises()
  return { wrapper, router }
}

describe('App (humo)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(apiProductos.contarStockBajo).mockReset().mockResolvedValue(3)
  })

  it('sin sesión muestra el login', async () => {
    const { wrapper, router } = await montarComo(null, '/')
    expect(router.currentRoute.value.name).toBe('login')
    expect(wrapper.text()).toContain('ERP')
  })

  it('aviso "Tu sesión terminó" en el login', async () => {
    const { wrapper } = await montarComo(null, '/login?motivo=sesion-terminada')
    expect(wrapper.text()).toContain('Tu sesión terminó')
  })

  it('BODEGUERO: layout, saludo con rol y tarjeta de stock bajo', async () => {
    const { wrapper } = await montarComo('BODEGUERO')
    expect(wrapper.text()).toContain('Hola, Ana López')
    expect(wrapper.text()).toContain('Bodeguero')
    expect(wrapper.text()).toContain('Stock bajo')
    expect(wrapper.find('.cifra').text()).toBe('3')
    expect(wrapper.find('nav').text()).toContain('Inicio')
  })

  it('VENDEDOR: sin tarjeta de stock bajo (no puede verlo)', async () => {
    const { wrapper } = await montarComo('VENDEDOR')
    expect(wrapper.text()).not.toContain('Stock bajo')
    expect(apiProductos.contarStockBajo).not.toHaveBeenCalled()
  })

  it('sin permiso y no encontrado se muestran dentro del layout', async () => {
    const { wrapper, router } = await montarComo('COMPRAS', '/sin-permiso')
    expect(wrapper.text()).toContain('No tienes permiso')
    await router.push('/no/existe')
    await flushPromises()
    expect(wrapper.text()).toContain('Página no encontrada')
  })
})
