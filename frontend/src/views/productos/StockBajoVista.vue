<script setup lang="ts">
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import { listarStockBajo } from '@/api/productos'
import { useApiError } from '@/composables/useApiError'
import { useTablaPaginada } from '@/composables/useTablaPaginada'
import type { ProductoStockBajo } from '@/types/productos'

// Solo lectura (ADMIN, BODEGUERO, COMPRAS). El backend ya ordena de mayor a
// menor faltante (stockMinimo - stock) en todas las páginas.
const { mostrarError } = useApiError()

const { filas, total, limit, primera, cargando, alCambiarPagina } = useTablaPaginada(
  listarStockBajo,
  { alError: (error) => mostrarError(error) },
)
</script>

<template>
  <section>
    <RouterLink :to="{ name: 'productos' }" class="volver">
      <i class="pi pi-arrow-left" aria-hidden="true" /> Productos
    </RouterLink>
    <h1>Stock bajo</h1>
    <p class="explicacion">
      Productos activos con stock en o bajo el mínimo, del más urgente al menos urgente.
    </p>

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
      <template #empty>Ningún producto está bajo el mínimo.</template>
      <Column field="sku" header="SKU" />
      <Column field="nombre" header="Nombre" />
      <Column header="Stock" class="numero">
        <template #body="{ data }">
          <span class="stock-bajo">{{ (data as ProductoStockBajo).stock }}</span>
        </template>
      </Column>
      <Column field="stockMinimo" header="Mínimo" class="numero" />
      <Column header="Faltan" class="numero">
        <template #body="{ data }">
          <strong>{{ (data as ProductoStockBajo).faltante }}</strong>
        </template>
      </Column>
      <Column header="Proveedor">
        <template #body="{ data }">
          {{ (data as ProductoStockBajo).proveedor?.nombre ?? 'Sin proveedor' }}
        </template>
      </Column>
      <Column header="Teléfono">
        <template #body="{ data }">
          <a
            v-if="(data as ProductoStockBajo).proveedor?.telefono"
            :href="`tel:${(data as ProductoStockBajo).proveedor!.telefono}`"
          >
            {{ (data as ProductoStockBajo).proveedor!.telefono }}
          </a>
          <span v-else>—</span>
        </template>
      </Column>
    </DataTable>
  </section>
</template>

<style scoped>
.volver {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

h1 {
  margin: 0.75rem 0 0.25rem;
}

.explicacion {
  margin-top: 0;
  color: var(--p-text-muted-color);
}

.stock-bajo {
  color: var(--p-red-500);
  font-weight: 700;
}

:deep(.numero) {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
