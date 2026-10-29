<script setup lang="ts">
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { ref } from 'vue'
import { actualizarUsuario, listarUsuarios } from '@/api/usuarios'
import EtiquetaRol from '@/components/EtiquetaRol.vue'
import { useApiError } from '@/composables/useApiError'
import { useFormato } from '@/composables/useFormato'
import { useTablaPaginada } from '@/composables/useTablaPaginada'
import { useAuthStore } from '@/stores/auth'
import type { Usuario } from '@/types/auth'
import DialogoRestablecerPassword from './DialogoRestablecerPassword.vue'
import DialogoUsuario from './DialogoUsuario.vue'

const auth = useAuthStore()
const toast = useToast()
const confirm = useConfirm()
const { mostrarError } = useApiError()
const { fecha } = useFormato()

const tabla = useTablaPaginada(listarUsuarios, {
  filtros: { incluirInactivos: false },
  alError: (error) => mostrarError(error),
})
const { filas, total, limit, primera, cargando, filtros, recargar, alCambiarPagina } = tabla

const esPropio = (usuario: Usuario | null) => usuario !== null && usuario.id === auth.usuario?.id

// Cambia una fila sin recargar la tabla
function reemplazarFila(usuario: Usuario): void {
  filas.value = filas.value.map((fila) => (fila.id === usuario.id ? usuario : fila))
}

// Crear / editar
const dialogoUsuario = ref(false)
const usuarioEditado = ref<Usuario | null>(null)

function abrirCrear(): void {
  usuarioEditado.value = null
  dialogoUsuario.value = true
}

function abrirEditar(usuario: Usuario): void {
  usuarioEditado.value = usuario
  dialogoUsuario.value = true
}

function alGuardar(usuario: Usuario, creado: boolean): void {
  toast.add({
    severity: 'success',
    summary: creado ? 'Usuario creado' : 'Usuario actualizado',
    detail: usuario.nombre,
    life: 3000,
  })
  if (creado) {
    void recargar()
  } else {
    reemplazarFila(usuario)
    // Si el ADMIN se editó a sí mismo, el nombre de la barra superior también
    auth.actualizarUsuarioActual(usuario)
  }
}

// Restablecer contraseña
const dialogoPassword = ref(false)
const usuarioPassword = ref<Usuario | null>(null)

function abrirRestablecer(usuario: Usuario): void {
  usuarioPassword.value = usuario
  dialogoPassword.value = true
}

// Activar / desactivar
const cambiandoEstado = ref<number | null>(null)

function cambiarEstado(usuario: Usuario): void {
  const activar = !usuario.activo
  confirm.require({
    header: activar ? 'Activar usuario' : 'Desactivar usuario',
    message: activar
      ? `${usuario.nombre} podrá volver a iniciar sesión.`
      : `${usuario.nombre} ya no podrá iniciar sesión. ¿Continuar?`,
    icon: activar ? 'pi pi-check-circle' : 'pi pi-exclamation-triangle',
    rejectProps: { label: 'Cancelar', severity: 'secondary', outlined: true },
    acceptProps: {
      label: activar ? 'Activar' : 'Desactivar',
      severity: activar ? 'success' : 'danger',
    },
    accept: async () => {
      cambiandoEstado.value = usuario.id
      try {
        const actualizado = await actualizarUsuario(usuario.id, { activo: activar })
        // Sin "Mostrar inactivos", el desactivado desaparece de la lista
        if (!actualizado.activo && !filtros.incluirInactivos) {
          void recargar()
        } else {
          reemplazarFila(actualizado)
        }
        toast.add({
          severity: 'success',
          summary: activar ? 'Usuario activado' : 'Usuario desactivado',
          detail: actualizado.nombre,
          life: 3000,
        })
      } catch (error) {
        // 409: último admin activo o desactivarse a sí mismo (mensaje del backend)
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
      <h1>Usuarios</h1>
      <Button label="Nuevo usuario" icon="pi pi-plus" @click="abrirCrear" />
    </div>

    <div class="filtros">
      <ToggleSwitch v-model="filtros.incluirInactivos" input-id="usuarios-inactivos" />
      <label for="usuarios-inactivos">Mostrar inactivos</label>
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
      <template #empty>No hay usuarios para mostrar.</template>
      <Column field="nombre" header="Nombre" />
      <Column field="email" header="Email" />
      <Column header="Rol">
        <template #body="{ data }">
          <EtiquetaRol :rol="(data as Usuario).rol" />
        </template>
      </Column>
      <Column header="Estado">
        <template #body="{ data }">
          <Tag
            :value="(data as Usuario).activo ? 'Activo' : 'Inactivo'"
            :severity="(data as Usuario).activo ? 'success' : 'secondary'"
          />
        </template>
      </Column>
      <Column header="Creado">
        <template #body="{ data }">{{ fecha((data as Usuario).creadoEn) }}</template>
      </Column>
      <Column header="Acciones" class="acciones">
        <template #body="{ data }">
          <Button
            v-tooltip.top="'Editar'"
            icon="pi pi-pencil"
            text
            rounded
            aria-label="Editar"
            @click="abrirEditar(data as Usuario)"
          />
          <Button
            v-tooltip.top="'Restablecer contraseña'"
            icon="pi pi-key"
            text
            rounded
            aria-label="Restablecer contraseña"
            @click="abrirRestablecer(data as Usuario)"
          />
          <!-- El span recibe el tooltip: un botón deshabilitado no dispara eventos -->
          <span
            v-tooltip.top="
              esPropio(data as Usuario)
                ? 'No puedes desactivarte a ti mismo'
                : (data as Usuario).activo
                  ? 'Desactivar'
                  : 'Activar'
            "
          >
            <Button
              :icon="(data as Usuario).activo ? 'pi pi-ban' : 'pi pi-check-circle'"
              text
              rounded
              :severity="(data as Usuario).activo ? 'danger' : 'success'"
              :aria-label="(data as Usuario).activo ? 'Desactivar' : 'Activar'"
              :disabled="esPropio(data as Usuario)"
              :loading="cambiandoEstado === (data as Usuario).id"
              @click="cambiarEstado(data as Usuario)"
            />
          </span>
        </template>
      </Column>
    </DataTable>

    <DialogoUsuario
      v-model:visible="dialogoUsuario"
      :usuario="usuarioEditado"
      :es-propio="esPropio(usuarioEditado)"
      @guardado="alGuardar"
    />
    <DialogoRestablecerPassword v-model:visible="dialogoPassword" :usuario="usuarioPassword" />
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
  gap: 0.5rem;
  margin: 1rem 0;
}

:deep(.acciones) {
  white-space: nowrap;
  width: 1%;
}
</style>
