<script setup lang="ts">
import Button from 'primevue/button'
import Card from 'primevue/card'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { esErrorApi } from '@/api/http'
import { anularVenta, obtenerVenta } from '@/api/ventas'
import AvisoPagina from '@/components/AvisoPagina.vue'
import CampoFormulario from '@/components/CampoFormulario.vue'
import EtiquetaEstadoVenta from '@/components/EtiquetaEstadoVenta.vue'
import { useApiError } from '@/composables/useApiError'
import { useFormato } from '@/composables/useFormato'
import { useAuthStore } from '@/stores/auth'
import {
  MOTIVO_ANULACION_MAX,
  MOTIVO_ANULACION_MIN,
  type DetalleVenta,
  type VentaDetalle,
} from '@/types/ventas'
import { erroresDelServidor, type Errores } from '@/validaciones/comun'
import { validarAnulacion } from '@/validaciones/ventas'

// La ruta solo acepta dígitos (/ventas/:id(\d+))
const props = defineProps<{ id: string }>()
const id = computed(() => Number(props.id))

const auth = useAuthStore()
const toast = useToast()
const { mostrarError } = useApiError()
const { dinero, fecha } = useFormato()

const venta = ref<VentaDetalle | null>(null)
const noEncontrada = ref(false)

async function cargar(): Promise<void> {
  noEncontrada.value = false
  try {
    venta.value = await obtenerVenta(id.value)
  } catch (error) {
    // 404 también si un VENDEDOR pide una venta ajena
    if (esErrorApi(error) && error.response?.status === 404) {
      noEncontrada.value = true
    } else {
      mostrarError(error)
    }
  }
}

watch(
  id,
  () => {
    venta.value = null
    void cargar()
  },
  { immediate: true },
)

// Solo comodidad visual: anular es solo ADMIN en el backend
const puedeAnular = computed(() => auth.tieneRol('ADMIN') && venta.value?.estado === 'COMPLETADA')

const dialogo = ref(false)
const motivo = ref('')
const errores = ref<Errores>({})
const anulando = ref(false)

function abrirAnular(): void {
  motivo.value = ''
  errores.value = {}
  dialogo.value = true
}

async function anular(): Promise<void> {
  errores.value = validarAnulacion(motivo.value)
  if (Object.keys(errores.value).length > 0 || anulando.value || !venta.value) {
    return
  }
  anulando.value = true
  try {
    venta.value = await anularVenta(venta.value.id, { motivo: motivo.value.trim() })
    dialogo.value = false
    toast.add({
      severity: 'success',
      summary: `Venta N.º ${venta.value.id} anulada`,
      detail: 'El stock de sus productos fue devuelto.',
      life: 4000,
    })
  } catch (error) {
    errores.value = erroresDelServidor(mostrarError(error, ['motivo']).campos)
    // 409: ya estaba anulada (otro usuario). Se recarga para verla así.
    if (esErrorApi(error) && error.response?.status === 409) {
      dialogo.value = false
      await cargar()
    }
  } finally {
    anulando.value = false
  }
}

function imprimir(): void {
  window.print()
}
</script>

<template>
  <AvisoPagina
    v-if="noEncontrada"
    icono="pi pi-receipt"
    titulo="Venta no encontrada"
    mensaje="La venta no existe o no tienes acceso a ella."
  />

  <section v-else class="venta">
    <RouterLink :to="{ name: 'ventas' }" class="volver no-imprimir">
      <i class="pi pi-arrow-left" aria-hidden="true" /> Ventas
    </RouterLink>

    <div v-if="!venta" class="cargando">
      <ProgressSpinner style="width: 3rem; height: 3rem" aria-label="Cargando" />
    </div>

    <template v-else>
      <div class="encabezado">
        <h1>
          Venta N.º {{ venta.id }}
          <EtiquetaEstadoVenta :estado="venta.estado" />
        </h1>
        <div class="encabezado__acciones no-imprimir">
          <Button
            label="Imprimir"
            icon="pi pi-print"
            severity="secondary"
            outlined
            @click="imprimir"
          />
          <Button
            v-if="puedeAnular"
            label="Anular"
            icon="pi pi-times-circle"
            severity="danger"
            outlined
            @click="abrirAnular"
          />
        </div>
      </div>

      <Message v-if="venta.estado === 'ANULADA'" severity="error" class="anulada">
        Anulada el {{ fecha(venta.anuladaEn) }}. Motivo: {{ venta.motivoAnulacion }}
      </Message>

      <Card class="bloque">
        <template #content>
          <dl class="datos">
            <dt>Fecha</dt>
            <dd>{{ fecha(venta.fecha) }}</dd>
            <dt>Cliente</dt>
            <dd>{{ venta.cliente.nombre }} (NIT {{ venta.cliente.nit }})</dd>
            <dt>Vendedor</dt>
            <dd>{{ venta.usuario.nombre }}</dd>
          </dl>
        </template>
      </Card>

      <DataTable :value="venta.detalles" data-key="id" class="detalles">
        <Column header="SKU">
          <template #body="{ data }">{{ (data as DetalleVenta).producto.sku }}</template>
        </Column>
        <Column header="Producto">
          <template #body="{ data }">{{ (data as DetalleVenta).producto.nombre }}</template>
        </Column>
        <Column field="cantidad" header="Cantidad" class="numero" />
        <Column header="Precio unitario" class="numero">
          <template #body="{ data }">{{ dinero((data as DetalleVenta).precioUnitario) }}</template>
        </Column>
        <Column header="Subtotal" class="numero">
          <template #body="{ data }">{{ dinero((data as DetalleVenta).subtotal) }}</template>
        </Column>
      </DataTable>
      <p class="total">
        Total <strong>{{ dinero(venta.total) }}</strong>
      </p>
    </template>

    <Dialog
      v-model:visible="dialogo"
      modal
      header="Anular venta"
      :style="{ width: '28rem' }"
      :breakpoints="{ '575px': '95vw' }"
      :closable="!anulando"
    >
      <p class="advertencia">
        La venta N.º {{ venta?.id }} quedará anulada y se devolverá el stock de sus productos. Esto
        no se puede deshacer.
      </p>
      <form id="form-anular" novalidate @submit.prevent="anular">
        <CampoFormulario
          etiqueta="Motivo"
          para="anular-motivo"
          :error="errores.motivo"
          :ayuda="`De ${MOTIVO_ANULACION_MIN} a ${MOTIVO_ANULACION_MAX} caracteres`"
        >
          <Textarea
            id="anular-motivo"
            v-model="motivo"
            :maxlength="MOTIVO_ANULACION_MAX"
            :invalid="!!errores.motivo"
            rows="3"
            auto-resize
            autofocus
            fluid
          />
        </CampoFormulario>
      </form>
      <template #footer>
        <Button
          label="Cancelar"
          severity="secondary"
          outlined
          :disabled="anulando"
          @click="dialogo = false"
        />
        <Button
          type="submit"
          form="form-anular"
          label="Anular venta"
          icon="pi pi-times-circle"
          severity="danger"
          :loading="anulando"
          :disabled="anulando"
        />
      </template>
    </Dialog>
  </section>
</template>

<style scoped>
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

.encabezado {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin: 0.75rem 0 1rem;
}

.encabezado h1 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.encabezado__acciones {
  display: flex;
  gap: 0.5rem;
}

.anulada,
.bloque {
  margin-bottom: 1rem;
}

.datos {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.6rem 1.5rem;
  margin: 0;
}

.datos dt {
  font-weight: 600;
  color: var(--p-text-muted-color);
}

.datos dd {
  margin: 0;
}

.total {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  gap: 0.75rem;
  font-size: 1.25rem;
}

.advertencia {
  margin-top: 0;
}

:deep(.numero) {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

@media print {
  .venta :deep(.p-card) {
    box-shadow: none;
    border: 1px solid #ccc;
  }
}
</style>
