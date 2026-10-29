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
import { actualizarCliente, desactivarCliente, listarClientes } from '@/api/clientes'
import { useApiError } from '@/composables/useApiError'
import { useTablaPaginada } from '@/composables/useTablaPaginada'
import { useAuthStore } from '@/stores/auth'
import type { Cliente } from '@/types/clientes'
import { BUSCAR_MAX } from '@/types/contacto'
import DialogoCliente from './DialogoCliente.vue'

const auth = useAuthStore()
const toast = useToast()
const confirm = useConfirm()
const { mostrarError } = useApiError()

// Solo comodidad visual: el backend responde 403 a un VENDEDOR que desactive
// o pida inactivos
const esAdmin = computed(() => auth.tieneRol('ADMIN'))

const { filas, total, limit, primera, cargando, buscar, filtros, recargar, alCambiarPagina } =
  useTablaPaginada(listarClientes, {
    filtros: { incluirInactivos: false },
    alError: (error) => mostrarError(error),
  })

function reemplazarFila(cliente: Cliente): void {
  filas.value = filas.value.map((fila) => (fila.id === cliente.id ? cliente : fila))
}

// Crear / editar
const dialogo = ref(false)
const clienteEditado = ref<Cliente | null>(null)

function abrir(cliente: Cliente | null): void {
  clienteEditado.value = cliente
  dialogo.value = true
}

function alGuardar(cliente: Cliente, creado: boolean): void {
  toast.add({
    severity: 'success',
    summary: creado ? 'Cliente creado' : 'Cliente actualizado',
    detail: cliente.nombre,
    life: 3000,
  })
  if (creado) {
    void recargar()
  } else {
    reemplazarFila(cliente)
  }
}

// Desactivar (DELETE) / reactivar (PATCH activo: true), solo ADMIN
const cambiandoEstado = ref<number | null>(null)

function cambiarEstado(cliente: Cliente): void {
  const activar = !cliente.activo
  confirm.require({
    header: activar ? 'Activar cliente' : 'Desactivar cliente',
    message: activar
      ? `${cliente.nombre} volverá a aparecer en los listados y en las ventas.`
      : `${cliente.nombre} ya no aparecerá en los listados ni se le podrá vender. Sus ventas se conservan. ¿Continuar?`,
    icon: activar ? 'pi pi-check-circle' : 'pi pi-exclamation-triangle',
    rejectProps: { label: 'Cancelar', severity: 'secondary', outlined: true },
    acceptProps: {
      label: activar ? 'Activar' : 'Desactivar',
      severity: activar ? 'success' : 'danger',
    },
    accept: async () => {
      cambiandoEstado.value = cliente.id
      try {
        const actualizado = activar
          ? await actualizarCliente(cliente.id, { activo: true })
          : await desactivarCliente(cliente.id)
        if (!actualizado.activo && !filtros.incluirInactivos) {
          void recargar()
        } else {
          reemplazarFila(actualizado)
        }
        toast.add({
          severity: 'success',
          summary: activar ? 'Cliente activado' : 'Cliente desactivado',
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
      <h1>Clientes</h1>
      <Button label="Nuevo cliente" icon="pi pi-plus" @click="abrir(null)" />
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
      <div v-if="esAdmin" class="filtros__inactivos">
        <ToggleSwitch v-model="filtros.incluirInactivos" input-id="clientes-inactivos" />
        <label for="clientes-inactivos">Mostrar inactivos</label>
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
      <template #empty>No hay clientes para mostrar.</template>
      <Column field="nit" header="NIT" />
      <Column header="Nombre">
        <template #body="{ data }">
          <RouterLink :to="{ name: 'cliente', params: { id: (data as Cliente).id } }">
            {{ (data as Cliente).nombre }}
          </RouterLink>
        </template>
      </Column>
      <Column header="Teléfono">
        <template #body="{ data }">{{ (data as Cliente).telefono ?? '—' }}</template>
      </Column>
      <Column header="Email">
        <template #body="{ data }">{{ (data as Cliente).email ?? '—' }}</template>
      </Column>
      <Column header="Estado">
        <template #body="{ data }">
          <Tag
            :value="(data as Cliente).activo ? 'Activo' : 'Inactivo'"
            :severity="(data as Cliente).activo ? 'success' : 'secondary'"
          />
        </template>
      </Column>
      <Column header="Acciones" class="acciones">
        <template #body="{ data }">
          <Button
            v-tooltip.top="'Editar'"
            icon="pi pi-pencil"
            text
            rounded
            aria-label="Editar"
            @click="abrir(data as Cliente)"
          />
          <Button
            v-if="esAdmin"
            v-tooltip.top="(data as Cliente).activo ? 'Desactivar' : 'Activar'"
            :icon="(data as Cliente).activo ? 'pi pi-ban' : 'pi pi-check-circle'"
            text
            rounded
            :severity="(data as Cliente).activo ? 'danger' : 'success'"
            :aria-label="(data as Cliente).activo ? 'Desactivar' : 'Activar'"
            :loading="cambiandoEstado === (data as Cliente).id"
            @click="cambiarEstado(data as Cliente)"
          />
        </template>
      </Column>
    </DataTable>

    <DialogoCliente v-model:visible="dialogo" :cliente="clienteEditado" @guardado="alGuardar" />
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

:deep(.acciones) {
  white-space: nowrap;
  width: 1%;
}
</style>
