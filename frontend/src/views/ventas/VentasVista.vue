<script setup lang="ts">
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import { computed, ref, watch } from 'vue'
import { listarVentas } from '@/api/ventas'
import EtiquetaEstadoVenta from '@/components/EtiquetaEstadoVenta.vue'
import SelectorCliente from '@/components/SelectorCliente.vue'
import { useApiError } from '@/composables/useApiError'
import { useFormato } from '@/composables/useFormato'
import { useTablaPaginada } from '@/composables/useTablaPaginada'
import { useAuthStore } from '@/stores/auth'
import type { Cliente } from '@/types/clientes'
import type { EstadoVenta, VentaResumen } from '@/types/ventas'
import { diaDe } from '@/validaciones/ventas'

const auth = useAuthStore()
const { mostrarError } = useApiError()
const { dinero, fecha } = useFormato()

// Un VENDEDOR solo recibe sus ventas (lo filtra el backend): la columna
// vendedor solo tiene sentido para ADMIN
const esAdmin = computed(() => auth.tieneRol('ADMIN'))

const { filas, total, limit, primera, cargando, filtros, alCambiarPagina } = useTablaPaginada(
  listarVentas,
  {
    filtros: {
      desde: undefined as string | undefined,
      hasta: undefined as string | undefined,
      clienteId: undefined as number | undefined,
      estado: undefined as EstadoVenta | undefined,
    },
    alError: (error) => mostrarError(error),
  },
)

// Rango de fechas: se filtra cuando están los dos extremos (o se limpia)
const rango = ref<(Date | null)[] | null>(null)
watch(rango, (valor) => {
  const [desde, hasta] = valor ?? []
  if (desde && hasta) {
    filtros.desde = diaDe(desde)
    filtros.hasta = diaDe(hasta)
  } else if (!desde) {
    filtros.desde = undefined
    filtros.hasta = undefined
  }
})

const cliente = ref<Cliente | null>(null)
watch(cliente, (c) => {
  filtros.clienteId = c?.id
})

const ESTADOS = [
  { label: 'Completada', value: 'COMPLETADA' },
  { label: 'Anulada', value: 'ANULADA' },
]
</script>

<template>
  <section>
    <div class="encabezado">
      <h1>Ventas</h1>
      <RouterLink :to="{ name: 'venta-nueva' }" custom>
        <template #default="{ navigate, href }">
          <Button as="a" :href="href" label="Nueva venta" icon="pi pi-plus" @click="navigate" />
        </template>
      </RouterLink>
    </div>

    <div class="filtros">
      <DatePicker
        v-model="rango"
        selection-mode="range"
        date-format="dd/mm/yy"
        :manual-input="false"
        placeholder="Rango de fechas"
        show-icon
        show-button-bar
        aria-label="Rango de fechas"
        class="filtros__fechas"
      />
      <SelectorCliente v-model="cliente" input-id="ventas-cliente" class="filtros__cliente" />
      <Select
        :model-value="filtros.estado"
        :options="ESTADOS"
        option-label="label"
        option-value="value"
        placeholder="Todos los estados"
        show-clear
        aria-label="Filtrar por estado"
        @update:model-value="(v: EstadoVenta | null) => (filtros.estado = v ?? undefined)"
      />
    </div>

    <DataTable
      :value="filas"
      lazy
      paginator
      :total-records="total"
      :rows="limit"
      :first="primera"
      :rows-per-page-options="[10, 20, 50]"
      :loading="cargando"
      data-key="id"
      striped-rows
      @page="alCambiarPagina"
    >
      <template #empty>No hay ventas para mostrar.</template>
      <Column header="N.º">
        <template #body="{ data }">
          <RouterLink :to="{ name: 'venta', params: { id: (data as VentaResumen).id } }">
            {{ (data as VentaResumen).id }}
          </RouterLink>
        </template>
      </Column>
      <Column header="Fecha">
        <template #body="{ data }">{{ fecha((data as VentaResumen).fecha) }}</template>
      </Column>
      <Column header="Cliente">
        <template #body="{ data }">
          {{ (data as VentaResumen).cliente.nombre }}
          <small class="nit">NIT {{ (data as VentaResumen).cliente.nit }}</small>
        </template>
      </Column>
      <Column v-if="esAdmin" header="Vendedor">
        <template #body="{ data }">{{ (data as VentaResumen).usuario.nombre }}</template>
      </Column>
      <Column header="Total" class="numero">
        <template #body="{ data }">{{ dinero((data as VentaResumen).total) }}</template>
      </Column>
      <Column header="Estado">
        <template #body="{ data }">
          <EtiquetaEstadoVenta :estado="(data as VentaResumen).estado" />
        </template>
      </Column>
    </DataTable>
  </section>
</template>

<style scoped>
.encabezado {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.encabezado h1 {
  margin: 0;
}

.filtros {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 1rem 0;
}

.filtros__fechas {
  width: 16rem;
}

.filtros__cliente {
  flex: 1 1 18rem;
  max-width: 26rem;
}

.nit {
  display: block;
  color: var(--p-text-muted-color);
}

:deep(.numero) {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
