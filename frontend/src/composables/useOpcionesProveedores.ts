import { computed, ref, shallowRef } from 'vue'
import { listarProveedores } from '@/api/proveedores'
import { LIMITE_MAXIMO } from '@/types/api'
import type { ProveedorDeProducto } from '@/types/productos'

export interface OpcionProveedor {
  label: string
  value: number
}

// Opciones para un Select de proveedor (con su filtro de texto). Se piden los
// primeros 100 activos por nombre: el límite del backend por página. Solo
// ADMIN, COMPRAS y BODEGUERO pueden leer /api/proveedores (VENDEDOR: 403).
export function useOpcionesProveedores(alError: (error: unknown) => void) {
  const cargados = shallowRef<OpcionProveedor[]>([])
  // Proveedores que no vinieron en la lista (ej. el proveedor, ya inactivo,
  // del producto que se edita): se agregan para que el Select muestre su nombre
  const extra = ref<OpcionProveedor[]>([])
  const cargando = ref(false)
  const hayMas = ref(false)

  const opciones = computed(() => {
    const ids = new Set(cargados.value.map((o) => o.value))
    return [...cargados.value, ...extra.value.filter((o) => !ids.has(o.value))]
  })

  async function cargar(): Promise<void> {
    cargando.value = true
    try {
      const respuesta = await listarProveedores({ page: 1, limit: LIMITE_MAXIMO })
      cargados.value = respuesta.data.map((p) => ({ label: p.nombre, value: p.id }))
      hayMas.value = respuesta.total > respuesta.data.length
    } catch (error) {
      alError(error)
    } finally {
      cargando.value = false
    }
  }

  function incluir(proveedor: ProveedorDeProducto | null): void {
    if (proveedor && !extra.value.some((o) => o.value === proveedor.id)) {
      extra.value = [...extra.value, { label: proveedor.nombre, value: proveedor.id }]
    }
  }

  return { opciones, cargando, hayMas, cargar, incluir }
}
