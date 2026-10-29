import { onScopeDispose, reactive, ref, shallowRef, watch, type UnwrapRef } from 'vue'
import type { DataTablePageEvent } from 'primevue/datatable'
import type { Paginado } from '@/types/api'

export const ESPERA_BUSQUEDA_MS = 300

export interface ParametrosListado {
  page: number
  limit: number
  buscar?: string
}

export interface OpcionesTablaPaginada<F extends object> {
  // Filtros además de la búsqueda (ej. { tipo: undefined, carpetaId: 3 }).
  // Cambiarlos recarga desde la página 1 sin esperar.
  filtros?: F
  limit?: number
  // En un componente: useApiError().mostrarError (se recibe como parámetro
  // para poder probar el composable sin PrimeVue)
  alError: (error: unknown) => void
  // false: no carga al crear (ej. si falta un dato para la primera consulta)
  cargarAlInicio?: boolean
}

// Listado del servidor conectado a un DataTable lazy:
//   <DataTable lazy paginator :value="filas" :totalRecords="total"
//              :rows="limit" :first="primera" :loading="cargando"
//              @page="alCambiarPagina">
export function useTablaPaginada<T, F extends object = Record<string, never>>(
  cargar: (parametros: ParametrosListado & UnwrapRef<F>) => Promise<Paginado<T>>,
  opciones: OpcionesTablaPaginada<F>,
) {
  const filas = shallowRef<T[]>([])
  const total = ref(0)
  const pagina = ref(1)
  const limit = ref(opciones.limit ?? 20)
  const cargando = ref(false)
  const buscar = ref('')
  const filtros = reactive(opciones.filtros ?? ({} as F))

  // Índice de la primera fila (lo que usa el DataTable)
  const primera = ref(0)

  // Cada consulta lleva un número; si llega una respuesta vieja después de
  // una nueva (búsquedas rápidas), se ignora
  let ultimaConsulta = 0

  async function recargar(): Promise<void> {
    const consulta = ++ultimaConsulta
    cargando.value = true
    try {
      const texto = buscar.value.trim()
      const parametros = Object.assign(
        {},
        filtros as UnwrapRef<F>,
        { page: pagina.value, limit: limit.value },
        texto ? { buscar: texto } : {},
      )
      const respuesta = await cargar(parametros)
      if (consulta !== ultimaConsulta) {
        return
      }
      // Se borró lo último de esta página: ir a la última que queda
      const ultimaPagina = Math.max(1, Math.ceil(respuesta.total / limit.value))
      if (respuesta.data.length === 0 && pagina.value > ultimaPagina) {
        pagina.value = ultimaPagina
        primera.value = (ultimaPagina - 1) * limit.value
        return recargar()
      }
      filas.value = respuesta.data
      total.value = respuesta.total
    } catch (error) {
      if (consulta === ultimaConsulta) {
        opciones.alError(error)
      }
    } finally {
      if (consulta === ultimaConsulta) {
        cargando.value = false
      }
    }
  }

  function irAPagina(numero: number): Promise<void> {
    pagina.value = numero
    primera.value = (numero - 1) * limit.value
    return recargar()
  }

  function alCambiarPagina(evento: Pick<DataTablePageEvent, 'page' | 'rows'>): Promise<void> {
    limit.value = evento.rows
    return irAPagina(evento.page + 1)
  }

  // La búsqueda espera a que se deje de escribir
  let temporizador: ReturnType<typeof setTimeout> | undefined
  watch(buscar, () => {
    clearTimeout(temporizador)
    temporizador = setTimeout(() => void irAPagina(1), ESPERA_BUSQUEDA_MS)
  })
  watch(filtros, () => {
    clearTimeout(temporizador)
    void irAPagina(1)
  })
  onScopeDispose(() => clearTimeout(temporizador))

  if (opciones.cargarAlInicio !== false) {
    void recargar()
  }

  return {
    filas,
    total,
    pagina,
    limit,
    primera,
    cargando,
    buscar,
    filtros,
    recargar,
    irAPagina,
    alCambiarPagina,
  }
}
