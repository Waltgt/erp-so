<script setup lang="ts">
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'
import { actualizarProducto, desactivarProducto, listarProductos } from '@/api/productos'
import { useApiError } from '@/composables/useApiError'
import { useFormato } from '@/composables/useFormato'
import { useOpcionesProveedores } from '@/composables/useOpcionesProveedores'
import { useTablaPaginada } from '@/composables/useTablaPaginada'
import { useAuthStore } from '@/stores/auth'
import { BUSCAR_MAX } from '@/types/contacto'
import type { Producto } from '@/types/productos'
import { esStockBajo } from '@/validaciones/productos'
import DialogoAjusteStock from './DialogoAjusteStock.vue'
import DialogoProducto from './DialogoProducto.vue'

const auth = useAuthStore()
const toast = useToast()
const confirm = useConfirm()
const { mostrarError } = useApiError()
const { dinero } = useFormato()

// Solo comodidad visual: la autorización la hace el backend.
// ADMIN y BODEGUERO escriben, ajustan stock y ven inactivos.
const puedeEscribir = computed(() => auth.tieneRol('ADMIN', 'BODEGUERO'))
// /api/proveedores (para el filtro) no es legible para el VENDEDOR
const puedeFiltrarProveedor = computed(() => auth.tieneRol('ADMIN', 'BODEGUERO', 'COMPRAS'))
const veStockBajo = computed(() => auth.tieneRol('ADMIN', 'BODEGUERO', 'COMPRAS'))

const { filas, total, limit, primera, cargando, buscar, filtros, recargar, alCambiarPagina } =
  useTablaPaginada(listarProductos, {
    filtros: { incluirInactivos: false, proveedorId: undefined as number | undefined },
    alError: (error) => mostrarError(error),
  })

// El backend no envía `costo` al VENDEDOR: la columna aparece solo si los
// datos lo traen, sin suponer nada por el rol
const hayCosto = computed(() => filas.value.some((fila) => fila.costo !== undefined))

const proveedores = useOpcionesProveedores(mostrarError)
onMounted(() => {
  if (puedeFiltrarProveedor.value) {
    void proveedores.cargar()
  }
})

function reemplazarFila(producto: Producto): void {
  filas.value = filas.value.map((fila) => (fila.id === producto.id ? producto : fila))
}

// Crear / editar
const dialogoProducto = ref(false)
const productoEditado = ref<Producto | null>(null)

function abrirProducto(producto: Producto | null): void {
  productoEditado.value = producto
  dialogoProducto.value = true
}

function alGuardar(producto: Producto, creado: boolean): void {
  toast.add({
    severity: 'success',
    summary: creado ? 'Producto creado' : 'Producto actualizado',
    detail: producto.nombre,
    life: 3000,
  })
  if (creado) {
    void recargar()
  } else {
    reemplazarFila(producto)
  }
}

// Ajuste de stock
const dialogoAjuste = ref(false)
const productoAjuste = ref<Producto | null>(null)

function abrirAjuste(producto: Producto): void {
  productoAjuste.value = producto
  dialogoAjuste.value = true
}

// Tras el ajuste, o tras un 409 (la fila queda con el stock real)
function alAjustar(producto: Producto): void {
  reemplazarFila(producto)
  productoAjuste.value = producto
}

// Desactivar (DELETE) / reactivar (PATCH activo: true)
const cambiandoEstado = ref<number | null>(null)

function cambiarEstado(producto: Producto): void {
  const activar = !producto.activo
  confirm.require({
    header: activar ? 'Activar producto' : 'Desactivar producto',
    message: activar
      ? `${producto.nombre} volverá a estar disponible para la venta.`
      : `${producto.nombre} ya no se podrá vender. Su historial de ventas se conserva. ¿Continuar?`,
    icon: activar ? 'pi pi-check-circle' : 'pi pi-exclamation-triangle',
    rejectProps: { label: 'Cancelar', severity: 'secondary', outlined: true },
    acceptProps: {
      label: activar ? 'Activar' : 'Desactivar',
      severity: activar ? 'success' : 'danger',
    },
    accept: async () => {
      cambiandoEstado.value = producto.id
      try {
        const actualizado = activar
          ? await actualizarProducto(producto.id, { activo: true })
          : await desactivarProducto(producto.id)
        if (!actualizado.activo && !filtros.incluirInactivos) {
          void recargar()
        } else {
          reemplazarFila(actualizado)
        }
        toast.add({
          severity: 'success',
          summary: activar ? 'Producto activado' : 'Producto desactivado',
          detail: actualizado.nombre,
          life: 3000,
        })
      } catch (error) {
        mostrarError(error)
      } finally {
        cambiandoEstado.value = null
      }
    },
  })
}
</script>

<template>
  <section>
    <div class="encabezado">
      <h1>Productos</h1>
      <div class="encabezado__acciones">
        <RouterLink v-if="veStockBajo" :to="{ name: 'stock-bajo' }" custom>
          <template #default="{ navigate, href }">
            <Button
              as="a"
              :href="href"
              label="Stock bajo"
              icon="pi pi-exclamation-triangle"
              severity="warn"
              outlined
              @click="navigate"
            />
          </template>
        </RouterLink>
        <Button
          v-if="puedeEscribir"
          label="Nuevo producto"
          icon="pi pi-plus"
          @click="abrirProducto(null)"
        />
      </div>
    </div>

    <div class="filtros">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText
          v-model="buscar"
          placeholder="Buscar por nombre o SKU"
          :maxlength="BUSCAR_MAX"
          aria-label="Buscar por nombre o SKU"
        />
      </IconField>
      <Select
        v-if="puedeFiltrarProveedor"
        :model-value="filtros.proveedorId"
        :options="proveedores.opciones.value"
        option-label="label"
        option-value="value"
        :loading="proveedores.cargando.value"
        placeholder="Todos los proveedores"
        filter
        filter-placeholder="Buscar proveedor"
        show-clear
        aria-label="Filtrar por proveedor"
        class="filtros__proveedor"
        @update:model-value="(id: number | null) => (filtros.proveedorId = id ?? undefined)"
      />
      <div v-if="puedeEscribir" class="filtros__inactivos">
        <ToggleSwitch v-model="filtros.incluirInactivos" input-id="productos-inactivos" />
        <label for="productos-inactivos">Mostrar inactivos</label>
      </div>
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
      <template #empty>No hay productos para mostrar.</template>
      <Column field="sku" header="SKU" />
      <Column field="nombre" header="Nombre" />
      <Column header="Proveedor">
        <template #body="{ data }">{{ (data as Producto).proveedor?.nombre ?? '—' }}</template>
      </Column>
      <Column header="Precio" class="numero">
        <template #body="{ data }">{{ dinero((data as Producto).precioVenta) }}</template>
      </Column>
      <Column v-if="hayCosto" header="Costo" class="numero">
        <template #body="{ data }">{{ dinero((data as Producto).costo) }}</template>
      </Column>
      <Column header="Stock" class="numero">
        <template #body="{ data }">
          <span
            :class="{ 'stock-bajo': esStockBajo(data as Producto) }"
            :title="esStockBajo(data as Producto) ? 'En o bajo el stock mínimo' : undefined"
          >
            {{ (data as Producto).stock }}
          </span>
        </template>
      </Column>
      <Column field="stockMinimo" header="Mínimo" class="numero" />
      <Column header="Estado">
        <template #body="{ data }">
          <Tag
            :value="(data as Producto).activo ? 'Activo' : 'Inactivo'"
            :severity="(data as Producto).activo ? 'success' : 'secondary'"
          />
        </template>
      </Column>
      <Column v-if="puedeEscribir" header="Acciones" class="acciones">
        <template #body="{ data }">
          <Button
            v-tooltip.top="'Editar'"
            icon="pi pi-pencil"
            text
            rounded
            aria-label="Editar"
            @click="abrirProducto(data as Producto)"
          />
          <Button
            v-tooltip.top="'Ajustar stock'"
            icon="pi pi-sort-alt"
            text
            rounded
            aria-label="Ajustar stock"
            @click="abrirAjuste(data as Producto)"
          />
          <Button
            v-tooltip.top="(data as Producto).activo ? 'Desactivar' : 'Activar'"
            :icon="(data as Producto).activo ? 'pi pi-ban' : 'pi pi-check-circle'"
            text
            rounded
            :severity="(data as Producto).activo ? 'danger' : 'success'"
            :aria-label="(data as Producto).activo ? 'Desactivar' : 'Activar'"
            :loading="cambiandoEstado === (data as Producto).id"
            @click="cambiarEstado(data as Producto)"
          />
        </template>
      </Column>
    </DataTable>

    <template v-if="puedeEscribir">
      <DialogoProducto
        v-model:visible="dialogoProducto"
        :producto="productoEditado"
        @guardado="alGuardar"
      />
      <DialogoAjusteStock
        v-model:visible="dialogoAjuste"
        :producto="productoAjuste"
        @actualizado="alAjustar"
      />
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
}

.encabezado h1 {
  margin: 0;
}

.encabezado__acciones {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filtros {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
  margin: 1rem 0;
}

.filtros__proveedor {
  min-width: 14rem;
}

.filtros__inactivos {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.stock-bajo {
  color: var(--p-red-500);
  font-weight: 700;
}

:deep(.numero) {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

:deep(.acciones) {
  white-space: nowrap;
  width: 1%;
}
</style>
