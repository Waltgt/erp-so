<script setup lang="ts">
import AutoComplete, {
  type AutoCompleteCompleteEvent,
  type AutoCompleteOptionSelectEvent,
} from 'primevue/autocomplete'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { computed, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { esErrorApi } from '@/api/http'
import { listarProductos, obtenerProducto } from '@/api/productos'
import { crearVenta } from '@/api/ventas'
import CampoFormulario from '@/components/CampoFormulario.vue'
import SelectorCliente from '@/components/SelectorCliente.vue'
import { useApiError } from '@/composables/useApiError'
import { useFormato } from '@/composables/useFormato'
import type { Cliente } from '@/types/clientes'
import type { Producto } from '@/types/productos'
import { ITEMS_MAXIMOS } from '@/types/ventas'
import type { Errores } from '@/validaciones/comun'
import {
  agregarProducto,
  dineroDeCentavos,
  peticionVenta,
  productoDelConflicto,
  subtotalCentavos,
  totalEstimadoCentavos,
  validarVenta,
  type LineaVenta,
} from '@/validaciones/ventas'

const router = useRouter()
const toast = useToast()
const { mostrarError, traducirError } = useApiError()
const { dinero } = useFormato()

const cliente = ref<Cliente | null>(null)
const lineas = ref<LineaVenta[]>([])
const errores = ref<Errores>({})

const lleno = computed(() => lineas.value.length >= ITEMS_MAXIMOS)
// Estimado en centavos: el total oficial lo devuelve el backend
const totalEstimado = computed(() => dineroDeCentavos(totalEstimadoCentavos(lineas.value)))
const subtotal = (linea: LineaVenta) => dineroDeCentavos(subtotalCentavos(linea))

// ─── Productos ──────────────────────────────────────────────────────
const busqueda = ref<Producto | string | null>(null)
const sugerencias = shallowRef<Producto[]>([])

async function buscarProductos(evento: AutoCompleteCompleteEvent): Promise<void> {
  try {
    // Solo activos (el backend filtra por defecto)
    sugerencias.value = (await listarProductos({ buscar: evento.query.trim(), limit: 10 })).data
  } catch (error) {
    sugerencias.value = []
    mostrarError(error)
  }
}

function alElegirProducto(evento: AutoCompleteOptionSelectEvent): void {
  const { lineas: nuevas, aviso } = agregarProducto(lineas.value, evento.value as Producto)
  lineas.value = nuevas
  if (aviso) {
    toast.add({ severity: 'warn', summary: 'No se agregó', detail: aviso, life: 4000 })
  }
  delete errores.value.lineas
  // Listo para buscar el siguiente
  busqueda.value = null
}

function cambiarCantidad(linea: LineaVenta, cantidad: number | null): void {
  linea.cantidad = cantidad ?? 1
  linea.error = null
}

function quitar(linea: LineaVenta): void {
  lineas.value = lineas.value.filter((l) => l !== linea)
}

// ─── Confirmar ──────────────────────────────────────────────────────
const resumen = ref(false)
const enviando = ref(false)

function abrirResumen(): void {
  errores.value = validarVenta(cliente.value?.id ?? null, lineas.value)
  if (Object.keys(errores.value).length === 0) {
    resumen.value = true
  }
}

async function registrar(): Promise<void> {
  // Doble clic: el botón se deshabilita, y además se corta aquí
  if (enviando.value || !cliente.value) {
    return
  }
  enviando.value = true
  try {
    const venta = await crearVenta(peticionVenta(cliente.value.id, lineas.value))
    toast.add({
      severity: 'success',
      summary: `Venta N.º ${venta.id} registrada`,
      // El total oficial es el del backend
      detail: `Total: ${dinero(venta.total)}`,
      life: 5000,
    })
    await router.push({ name: 'venta', params: { id: venta.id } })
  } catch (error) {
    resumen.value = false
    mostrarError(error)
    await marcarConflicto(error)
  } finally {
    enviando.value = false
  }
}

// 409: marca la línea del producto que falló y recarga su stock. El resto
// del formulario se conserva.
async function marcarConflicto(error: unknown): Promise<void> {
  if (!esErrorApi(error) || error.response?.status !== 409) {
    return
  }
  const mensaje = traducirError(error).mensajes[0] ?? ''
  const id = productoDelConflicto(mensaje)
  const linea = lineas.value.find((l) => l.producto.id === id)
  if (!linea) {
    return
  }
  linea.error = mensaje
  try {
    const producto = await obtenerProducto(linea.producto.id)
    linea.producto = producto
    if (!producto.activo) {
      linea.error = 'El producto ya no está activo: quítalo de la venta'
    }
  } catch (errorRecarga) {
    // 404: el producto ya no existe
    if (!esErrorApi(errorRecarga) || errorRecarga.response?.status !== 404) {
      mostrarError(errorRecarga)
    }
  }
}

const claseFila = (linea: LineaVenta) => (linea.error ? 'fila-error' : undefined)
</script>

<template>
  <section>
    <RouterLink :to="{ name: 'ventas' }" class="volver">
      <i class="pi pi-arrow-left" aria-hidden="true" /> Ventas
    </RouterLink>
    <h1>Nueva venta</h1>

    <Card class="bloque">
      <template #title>Cliente</template>
      <template #content>
        <CampoFormulario etiqueta="Cliente" para="venta-cliente" :error="errores.cliente">
          <SelectorCliente
            v-model="cliente"
            input-id="venta-cliente"
            con-acciones
            :invalid="!!errores.cliente"
          />
        </CampoFormulario>
      </template>
    </Card>

    <Card class="bloque">
      <template #title>Productos</template>
      <template #content>
        <CampoFormulario
          etiqueta="Agregar producto"
          para="venta-producto"
          :error="errores.lineas"
          :ayuda="
            lleno
              ? `Llegaste al máximo de ${ITEMS_MAXIMOS} productos por venta`
              : 'Si ya está en la lista, se suma 1 a su cantidad'
          "
        >
          <AutoComplete
            v-model="busqueda"
            input-id="venta-producto"
            :suggestions="sugerencias"
            option-label="nombre"
            :delay="300"
            :disabled="lleno"
            placeholder="Buscar por nombre o SKU"
            empty-search-message="Ningún producto activo coincide"
            fluid
            @complete="buscarProductos"
            @option-select="alElegirProducto"
          >
            <template #option="{ option }">
              <div class="opcion">
                <span>{{ (option as Producto).nombre }}</span>
                <small>
                  {{ (option as Producto).sku }} · {{ dinero((option as Producto).precioVenta) }} ·
                  stock {{ (option as Producto).stock }}
                </small>
              </div>
            </template>
          </AutoComplete>
        </CampoFormulario>

        <DataTable :value="lineas" data-key="producto.id" :row-class="claseFila">
          <template #empty>Aún no hay productos en la venta.</template>
          <Column header="SKU">
            <template #body="{ data }">{{ (data as LineaVenta).producto.sku }}</template>
          </Column>
          <Column header="Producto">
            <template #body="{ data }">
              {{ (data as LineaVenta).producto.nombre }}
              <small v-if="(data as LineaVenta).error" class="error-linea">
                {{ (data as LineaVenta).error }}
              </small>
            </template>
          </Column>
          <Column header="Precio" class="numero">
            <template #body="{ data }">
              {{ dinero((data as LineaVenta).producto.precioVenta) }}
            </template>
          </Column>
          <Column header="Disponible" class="numero">
            <template #body="{ data }">{{ (data as LineaVenta).producto.stock }}</template>
          </Column>
          <Column header="Cantidad">
            <template #body="{ data }">
              <InputNumber
                :model-value="(data as LineaVenta).cantidad"
                :min="1"
                :max="Math.max(1, (data as LineaVenta).producto.stock)"
                show-buttons
                button-layout="horizontal"
                :input-style="{ width: '4rem', textAlign: 'center' }"
                :aria-label="`Cantidad de ${(data as LineaVenta).producto.nombre}`"
                :invalid="
                  !!(data as LineaVenta).error ||
                  (data as LineaVenta).cantidad > (data as LineaVenta).producto.stock
                "
                @update:model-value="(v: number | null) => cambiarCantidad(data as LineaVenta, v)"
              />
            </template>
          </Column>
          <Column header="Subtotal" class="numero">
            <template #body="{ data }">{{ dinero(subtotal(data as LineaVenta)) }}</template>
          </Column>
          <Column class="acciones">
            <template #body="{ data }">
              <Button
                v-tooltip.top="'Quitar'"
                icon="pi pi-trash"
                text
                rounded
                severity="danger"
                aria-label="Quitar"
                @click="quitar(data as LineaVenta)"
              />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <div class="pie">
      <div class="total">
        <span>Total estimado</span>
        <strong>{{ dinero(totalEstimado) }}</strong>
      </div>
      <Button
        label="Confirmar venta"
        icon="pi pi-check"
        :disabled="enviando || lineas.length === 0"
        @click="abrirResumen"
      />
    </div>

    <Dialog
      v-model:visible="resumen"
      modal
      header="Confirmar venta"
      :style="{ width: '32rem' }"
      :breakpoints="{ '575px': '95vw' }"
      :closable="!enviando"
    >
      <p>
        Cliente: <strong>{{ cliente?.nombre }}</strong> (NIT {{ cliente?.nit }})
      </p>
      <ul class="resumen">
        <li v-for="linea in lineas" :key="linea.producto.id">
          <span>{{ linea.cantidad }} × {{ linea.producto.nombre }}</span>
          <span>{{ dinero(subtotal(linea)) }}</span>
        </li>
      </ul>
      <p class="resumen__total">
        Total estimado: <strong>{{ dinero(totalEstimado) }}</strong>
      </p>
      <Message severity="secondary" size="small">
        El total oficial lo calcula el sistema al registrar la venta.
      </Message>
      <template #footer>
        <Button
          label="Volver"
          severity="secondary"
          outlined
          :disabled="enviando"
          @click="resumen = false"
        />
        <Button
          label="Registrar venta"
          icon="pi pi-check"
          :loading="enviando"
          :disabled="enviando"
          @click="registrar"
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

h1 {
  margin: 0.75rem 0 1rem;
}

.bloque {
  margin-bottom: 1rem;
}

.opcion {
  display: flex;
  flex-direction: column;
}

.opcion small {
  color: var(--p-text-muted-color);
}

.error-linea {
  display: block;
  color: var(--p-red-500);
}

:deep(.fila-error) {
  background: color-mix(in srgb, var(--p-red-500) 10%, transparent) !important;
}

.pie {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.total {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  font-size: 1.25rem;
}

.total span {
  color: var(--p-text-muted-color);
  font-size: 1rem;
}

.resumen {
  list-style: none;
  padding: 0;
  margin: 0 0 1rem;
}

.resumen li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--p-content-border-color);
}

.resumen__total {
  text-align: right;
  font-size: 1.1rem;
}

:deep(.numero) {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

:deep(.acciones) {
  width: 1%;
}
</style>
