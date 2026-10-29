<script setup lang="ts">
import Button from 'primevue/button'
import Card from 'primevue/card'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import ProgressSpinner from 'primevue/progressspinner'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { obtenerCliente } from '@/api/clientes'
import { listarVentas } from '@/api/ventas'
import AvisoPagina from '@/components/AvisoPagina.vue'
import { esErrorApi } from '@/api/http'
import { useApiError } from '@/composables/useApiError'
import { useFormato } from '@/composables/useFormato'
import { useTablaPaginada } from '@/composables/useTablaPaginada'
import type { Cliente } from '@/types/clientes'
import type { VentaResumen } from '@/types/ventas'
import DialogoCliente from './DialogoCliente.vue'

// La ruta solo acepta dígitos (/clientes/:id(\d+))
const props = defineProps<{ id: string }>()
const id = computed(() => Number(props.id))

const toast = useToast()
const { mostrarError } = useApiError()
const { dinero, fecha } = useFormato()

const cliente = ref<Cliente | null>(null)
const noEncontrado = ref(false)

async function cargarCliente(): Promise<void> {
  cliente.value = null
  noEncontrado.value = false
  try {
    cliente.value = await obtenerCliente(id.value)
  } catch (error) {
    if (esErrorApi(error) && error.response?.status === 404) {
      noEncontrado.value = true
    } else {
      mostrarError(error)
    }
  }
}

// Últimas ventas del cliente. Un VENDEDOR recibe solo las suyas: lo filtra el
// backend, aquí no se hace nada especial.
const ventas = useTablaPaginada(listarVentas, {
  filtros: { clienteId: id.value },
  limit: 10,
  alError: (error) => mostrarError(error),
})

// Si se navega de un cliente a otro, Vue reutiliza el componente
watch(
  id,
  (nuevo) => {
    void cargarCliente()
    ventas.filtros.clienteId = nuevo
  },
  { immediate: true },
)

const dialogo = ref(false)

function alGuardar(actualizado: Cliente): void {
  cliente.value = actualizado
  toast.add({
    severity: 'success',
    summary: 'Cliente actualizado',
    detail: actualizado.nombre,
    life: 3000,
  })
}
</script>

<template>
  <AvisoPagina
    v-if="noEncontrado"
    icono="pi pi-user-minus"
    titulo="Cliente no encontrado"
    mensaje="El cliente no existe o fue eliminado."
  />

  <section v-else>
    <div class="encabezado">
      <RouterLink :to="{ name: 'clientes' }" class="volver">
        <i class="pi pi-arrow-left" aria-hidden="true" /> Clientes
      </RouterLink>
    </div>

    <div v-if="!cliente" class="cargando">
      <ProgressSpinner style="width: 3rem; height: 3rem" aria-label="Cargando" />
    </div>

    <template v-else>
      <div class="encabezado">
        <h1>
          {{ cliente.nombre }}
          <Tag v-if="!cliente.activo" value="Inactivo" severity="secondary" />
        </h1>
        <Button label="Editar" icon="pi pi-pencil" outlined @click="dialogo = true" />
      </div>

      <Card>
        <template #content>
          <dl class="datos">
            <dt>NIT</dt>
            <dd>{{ cliente.nit }}</dd>
            <dt>Email</dt>
            <dd>{{ cliente.email ?? '—' }}</dd>
            <dt>Teléfono</dt>
            <dd>{{ cliente.telefono ?? '—' }}</dd>
            <dt>Dirección</dt>
            <dd>{{ cliente.direccion ?? '—' }}</dd>
            <dt>Cliente desde</dt>
            <dd>{{ fecha(cliente.creadoEn) }}</dd>
          </dl>
        </template>
      </Card>

      <h2>Últimas ventas</h2>
      <DataTable
        :value="ventas.filas.value"
        lazy
        paginator
        :total-records="ventas.total.value"
        :rows="ventas.limit.value"
        :first="ventas.primera.value"
        :loading="ventas.cargando.value"
        data-key="id"
        striped-rows
        @page="ventas.alCambiarPagina"
      >
        <template #empty>Este cliente no tiene ventas.</template>
        <Column field="id" header="N.º" />
        <Column header="Fecha">
          <template #body="{ data }">{{ fecha((data as VentaResumen).fecha) }}</template>
        </Column>
        <Column header="Vendedor">
          <template #body="{ data }">{{ (data as VentaResumen).usuario.nombre }}</template>
        </Column>
        <Column header="Total" class="numero">
          <template #body="{ data }">{{ dinero((data as VentaResumen).total) }}</template>
        </Column>
        <Column header="Estado">
          <template #body="{ data }">
            <Tag
              :value="(data as VentaResumen).estado === 'COMPLETADA' ? 'Completada' : 'Anulada'"
              :severity="(data as VentaResumen).estado === 'COMPLETADA' ? 'success' : 'danger'"
            />
          </template>
        </Column>
      </DataTable>

      <DialogoCliente v-model:visible="dialogo" :cliente="cliente" @guardado="alGuardar" />
    </template>
  </section>
</template>

<style scoped>
.encabezado {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.encabezado h1 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.volver {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.cargando {
  display: flex;
  justify-content: center;
  padding: 3rem;
}

.datos {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.75rem 1.5rem;
  margin: 0;
}

.datos dt {
  font-weight: 600;
  color: var(--p-text-muted-color);
}

.datos dd {
  margin: 0;
  overflow-wrap: anywhere;
}

h2 {
  margin-top: 2rem;
}

:deep(.numero) {
  text-align: right;
}
</style>
