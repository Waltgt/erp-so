import { flushPromises, mount } from '@vue/test-utils'
import { AxiosError, AxiosHeaders } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import * as apiAuth from '@/api/auth'
import type { Usuario } from '@/types/auth'
import { useBloqueoTemporal } from '../useBloqueoTemporal'
import {
  errorDeLogin,
  MENSAJE_CREDENCIALES,
  MENSAJE_DEMASIADOS_INTENTOS,
  SEGUNDOS_BLOQUEO_LOGIN,
  useFormularioLogin,
} from '../useFormularioLogin'

vi.mock('@/api/auth')

const ana: Usuario = {
  id: 2,
  nombre: 'Ana',
  email: 'ana@empresa.com',
  rol: 'VENDEDOR',
  activo: true,
  creadoEn: '2026-10-01T00:00:00Z',
  actualizadoEn: '2026-10-01T00:00:00Z',
}

function errorHttp(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError(`HTTP ${status}`, 'ERR', config, null, {
    status,
    statusText: '',
    data: { statusCode: status, message: 'Credenciales inválidas' },
    headers: {},
    config,
  })
}

describe('errorDeLogin', () => {
  it.each([401, 400])('%i: un solo mensaje de credenciales', (status) => {
    expect(errorDeLogin(errorHttp(status))).toEqual({
      mensaje: MENSAJE_CREDENCIALES,
      bloquear: false,
    })
  })

  it('429: aviso de espera y bloqueo', () => {
    expect(errorDeLogin(errorHttp(429))).toEqual({
      mensaje: MENSAJE_DEMASIADOS_INTENTOS,
      bloquear: true,
    })
  })

  it('sin conexión: el mensaje de red', () => {
    expect(errorDeLogin(new Error('Network Error')).mensaje).toMatch(/conectar/)
  })
})

describe('useBloqueoTemporal', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('cuenta hacia atrás y se desbloquea al llegar a 0', () => {
    const Prueba = defineComponent({ setup: () => useBloqueoTemporal(), template: '<div />' })
    const { vm } = mount(Prueba)
    vm.bloquear(3)
    expect(vm.bloqueado).toBe(true)
    vi.advanceTimersByTime(2000)
    expect(vm.restantes).toBe(1)
    vi.advanceTimersByTime(1000)
    expect(vm.bloqueado).toBe(false)
  })
})

describe('useFormularioLogin', () => {
  let router: Router

  async function montar(ruta: string) {
    setActivePinia(createPinia())
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'inicio', component: { template: '<div />' } },
        { path: '/login', name: 'login', component: { template: '<div />' } },
        { path: '/ventas/:id', component: { template: '<div />' } },
      ],
    })
    await router.push(ruta)
    const Prueba = defineComponent({ setup: () => useFormularioLogin(), template: '<div />' })
    return mount(Prueba, { global: { plugins: [router] } }).vm
  }

  beforeEach(() => {
    localStorage.clear()
    vi.resetAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('login correcto sin redirect: al inicio; el email va recortado', async () => {
    vi.mocked(apiAuth.login).mockResolvedValue({ accessToken: 'tok', usuario: ana })
    const vm = await montar('/login')
    await vm.ingresar('  ana@empresa.com ', 'secreto123')
    await flushPromises()
    expect(apiAuth.login).toHaveBeenCalledWith({ email: 'ana@empresa.com', password: 'secreto123' })
    expect(router.currentRoute.value.name).toBe('inicio')
  })

  it('sesión vencida: vuelve a la ruta guardada', async () => {
    vi.mocked(apiAuth.login).mockResolvedValue({ accessToken: 'tok', usuario: ana })
    const vm = await montar('/login?redirect=/ventas/5&motivo=sesion-terminada')
    await vm.ingresar('ana@empresa.com', 'secreto123')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/ventas/5')
  })

  it('redirect a otro sitio: se ignora y va al inicio', async () => {
    vi.mocked(apiAuth.login).mockResolvedValue({ accessToken: 'tok', usuario: ana })
    const vm = await montar('/login?redirect=//sitio-malo.com')
    await vm.ingresar('ana@empresa.com', 'secreto123')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('inicio')
  })

  it('contraseña incorrecta: mensaje y se queda en /login', async () => {
    vi.mocked(apiAuth.login).mockRejectedValue(errorHttp(401))
    const vm = await montar('/login')
    await vm.ingresar('ana@empresa.com', 'mala')
    expect(vm.error).toBe(MENSAJE_CREDENCIALES)
    expect(vm.enviando).toBe(false)
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('429: bloquea 60 s y no envía mientras tanto', async () => {
    vi.mocked(apiAuth.login).mockRejectedValue(errorHttp(429))
    const vm = await montar('/login')
    await vm.ingresar('ana@empresa.com', 'x')
    expect(vm.bloqueado).toBe(true)
    expect(vm.restantes).toBe(SEGUNDOS_BLOQUEO_LOGIN)

    await vm.ingresar('ana@empresa.com', 'x')
    expect(apiAuth.login).toHaveBeenCalledOnce()

    vi.advanceTimersByTime(SEGUNDOS_BLOQUEO_LOGIN * 1000)
    expect(vm.bloqueado).toBe(false)
  })
})
