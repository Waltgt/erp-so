<script setup lang="ts">
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { actualizarProveedor, desactivarProveedor, listarProveedores } from '@/api/proveedores'
import { useApiError } from '@/composables/useApiError'
import { useTablaPaginada } from '@/composables/useTablaPaginada'
import { useAuthStore } from '@/stores/auth'
import { BUSCAR_MAX } from '@/types/contacto'
import type { Proveedor, ProveedorConProductos } from '@/types/proveedores'
import DialogoProveedor from './DialogoProveedor.vue'

const auth = useAuthStore()
const toast = useToast()
const confirm = useConfirm()
const { mostrarError } = useApiError()

// ADMIN y COMPRAS escriben y ven inactivos; BODEGUERO solo lee. Es solo
// comodidad visual: el backend responde 403 a una escritura del BODEGUERO.
const puedeEscribir = computed(() => auth.tieneRol('ADMIN', 'COMPRAS'))

const { filas, total, limit, primera, cargando, buscar, filtros, recargar, alCambiarPagina } =
  useTablaPaginada(listarProveedores, {
    filtros: { incluirInactivos: false },
    alError: (error) => mostrarError(error),
  })

// PATCH no devuelve productosActivos: se conserva el de la fila
function actualizarFila(proveedor: Proveedor | ProveedorConProductos): void {
  filas.value = filas.value.map((fila) =>
    fila.id === proveedor.id ? { ...fila, ...proveedor } : fila,
  )
}

// Crear / editar
const dialogo = ref(false)
const proveedorEditado = ref<Proveedor | null>(null)

function abrir(proveedor: Proveedor | null): void {
  proveedorEditado.value = proveedor
  dialogo.value = true
}

function alGuardar(proveedor: Proveedor, creado: boolean): void {
  toast.add({
    severity: 'success',
    summary: creado ? 'Proveedor creado' : 'Proveedor actualizado',
    detail: proveedor.nombre,
    life: 3000,
  })
  if (creado) {
    void recargar()
  } else {
    actualizarFila(proveedor)
  }
}

// Desactivar (DELETE) / reactivar (PATCH activo: true)
const cambiandoEstado = ref<number | null>(null)

function avisoDesactivado(proveedor: ProveedorConProductos): void {
  const n = proveedor.productosActivos
  if (n > 0) {
    toast.add({
      severity: 'warn',
      summary: 'Proveedor desactivado',
      detail: `El proveedor quedó inactivo pero tiene ${n} ${n === 1 ? 'producto activo' : 'productos activos'}.`,
      life: 8000,
    })
  } else {
    toast.add({
      severity: 'success',
      summary: 'Proveedor desactivado',
      detail: proveedor.nombre,
      life: 3000,
    })
  }
}

function cambiarEstado(proveedor: ProveedorConProductos): void {
  const activar = !proveedor.activo
  confirm.require({
    header: activar ? 'Activar proveedor' : 'Desactivar proveedor',
    message: activar
      ? `${proveedor.nombre} volverá a aparecer en los listados.`
      : `${proveedor.nombre} ya no aparecerá en los listados. Sus productos no cambian. ¿Continuar?`,
    icon: activar ? 'pi pi-check-circle' : 'pi pi-exclamation-triangle',
    rejectProps: { label: 'Cancelar', severity: 'secondary', outlined: true },
    acceptProps: {
      label: activar ? 'Activar' : 'Desactivar',
      severity: activar ? 'success' : 'danger',
    },
    accept: async () => {
      cambiandoEstado.value = proveedor.id
      try {
        if (activar) {
          const actualizado = await actualizarProveedor(proveedor.id, { activo: true })
          actualizarFila(actualizado)
          toast.add({
            severity: 'success',
            summary: 'Proveedor activado',
            detail: actualizado.nombre,
            life: 3000,
          })
        } else {
          const desactivado = await desactivarProveedor(proveedor.id)
          if (filtros.incluirInactivos) {
            actualizarFila(desactivado)
          } else {
            void recargar()
          }
          avisoDesactivado(desactivado)
        }
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
      <h1>Proveedores</h1>
      <Button v-if="puedeEscribir" label="Nuevo proveedor" icon="pi pi-plus" @click="abrir(null)" />
    </div>

    <div class="filtros">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText
          v-model="buscar"
          placeholder="Buscar por nombre o NIT"
          :maxlength="BUSCAR_MAX"
          aria-label="Buscar por nombre o NIT"
        />
      </IconField>
      <div v-if="puedeEscribir" class="filtros__inactivos">
        <ToggleSwitch v-model="filtros.incluirInactivos" input-id="proveedores-inactivos" />
        <label for="proveedores-inactivos">Mostrar inactivos</label>
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
      <template #empty>No hay proveedores para mostrar.</template>
      <Column field="nit" header="NIT" />
      <Column field="nombre" header="Nombre" />
      <Column header="Contacto">
        <template #body="{ data }">{{ (data as Proveedor).contacto ?? '—' }}</template>
      </Column>
      <Column header="Teléfono">
        <template #body="{ data }">{{ (data as Proveedor).telefono ?? '—' }}</template>
      </Column>
      <Column header="Email">
        <template #body="{ data }">{{ (data as Proveedor).email ?? '—' }}</template>
      </Column>
      <Column field="productosActivos" header="Productos activos" class="numero" />
      <Column header="Estado">
        <template #body="{ data }">
          <Tag
            :value="(data as Proveedor).activo ? 'Activo' : 'Inactivo'"
            :severity="(data as Proveedor).activo ? 'success' : 'secondary'"
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
            @click="abrir(data as Proveedor)"
          />
          <Button
            v-tooltip.top="(data as Proveedor).activo ? 'Desactivar' : 'Activar'"
            :icon="(data as Proveedor).activo ? 'pi pi-ban' : 'pi pi-check-circle'"
            text
            rounded
            :severity="(data as Proveedor).activo ? 'danger' : 'success'"
            :aria-label="(data as Proveedor).activo ? 'Desactivar' : 'Activar'"
            :loading="cambiandoEstado === (data as Proveedor).id"
            @click="cambiarEstado(data as ProveedorConProductos)"
          />
        </template>
      </Column>
    </DataTable>

    <DialogoProveedor
      v-if="puedeEscribir"
      v-model:visible="dialogo"
      :proveedor="proveedorEditado"
      @guardado="alGuardar"
    />
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
  gap: 1rem 1.5rem;
  margin: 1rem 0;
}

.filtros__inactivos {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

:deep(.numero) {
  text-align: right;
}

:deep(.acciones) {
  white-space: nowrap;
  width: 1%;
}
</style>
