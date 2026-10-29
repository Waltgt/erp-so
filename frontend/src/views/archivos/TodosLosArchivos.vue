<script setup lang="ts">
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { onMounted, ref, shallowRef } from 'vue'
import { actualizarArchivo, borrarArchivo, listarArchivos } from '@/api/archivos'
import { listarUsuarios } from '@/api/usuarios'
import { useApiError } from '@/composables/useApiError'
import { useFormato } from '@/composables/useFormato'
import { useTablaPaginada } from '@/composables/useTablaPaginada'
import { DATOS_TIPO_ARCHIVO, OPCIONES_TIPO_ARCHIVO } from '@/constantes/archivos'
import { LIMITE_MAXIMO } from '@/types/api'
import {
  NOMBRE_ARCHIVO_MAX,
  type Archivo,
  type ArchivoListado,
  type TipoArchivo,
} from '@/types/archivos'
import { validarNombreArchivo, visorDe } from '@/validaciones/archivos'
import DialogoNombre from './DialogoNombre.vue'

// Solo ADMIN: los archivos de todos (GET /archivos, paginado), con el dueño y
// la carpeta. Sin "mover": las carpetas destino serían las del dueño, que el
// ADMIN no puede listar. El backend responde 403 a ?usuarioId= de otro rol.
const emit = defineEmits<{
  abrir: [archivo: Archivo]
  descargar: [archivo: Archivo]
  borrado: [archivoId: number]
}>()

const toast = useToast()
const confirm = useConfirm()
const { mostrarError } = useApiError()
const formato = useFormato()

const { filas, total, limit, primera, cargando, buscar, filtros, recargar, alCambiarPagina } =
  useTablaPaginada(listarArchivos, {
    filtros: {
      tipo: undefined as TipoArchivo | undefined,
      usuarioId: undefined as number | undefined,
    },
    alError: (error) => mostrarError(error),
  })

// Filtro por dueño: los primeros 100 usuarios (incluye inactivos, que
// pueden tener archivos)
const usuarios = shallowRef<{ label: string; value: number }[]>([])
const hayMasUsuarios = ref(false)

onMounted(async () => {
  try {
    const respuesta = await listarUsuarios({
      page: 1,
      limit: LIMITE_MAXIMO,
      incluirInactivos: true,
    })
    usuarios.value = respuesta.data.map((u) => ({ label: u.nombre, value: u.id }))
    hayMasUsuarios.value = respuesta.total > respuesta.data.length
  } catch (error) {
    mostrarError(error)
  }
})

// Renombrar
const dialogoNombre = ref(false)
const renombrado = shallowRef<ArchivoListado | null>(null)

function renombrar(archivo: ArchivoListado): void {
  renombrado.value = archivo
  dialogoNombre.value = true
}

async function guardarNombre(nombreOriginal: string): Promise<void> {
  const archivo = renombrado.value
  if (!archivo) {
    return
  }
  const actualizado = await actualizarArchivo(archivo.id, { nombreOriginal })
  // PATCH no trae dueño ni carpeta: se conservan los de la fila
  filas.value = filas.value.map((f) => (f.id === actualizado.id ? { ...f, ...actualizado } : f))
  toast.add({
    severity: 'success',
    summary: 'Archivo renombrado',
    detail: actualizado.nombreOriginal,
    life: 3000,
  })
}

// Borrar
const borrando = ref<number | null>(null)

function borrar(archivo: ArchivoListado): void {
  confirm.require({
    header: 'Borrar archivo',
    message: `Se borrará «${archivo.nombreOriginal}» de ${archivo.usuario.nombre} definitivamente. ¿Continuar?`,
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: 'Cancelar', severity: 'secondary', outlined: true },
    acceptProps: { label: 'Borrar', severity: 'danger' },
    accept: async () => {
      borrando.value = archivo.id
      try {
        await borrarArchivo(archivo.id)
        emit('borrado', archivo.id)
        toast.add({
          severity: 'success',
          summary: 'Borrado',
          detail: archivo.nombreOriginal,
          life: 3000,
        })
        void recargar()
      } catch (error) {
        mostrarError(error)
      } finally {
        borrando.value = null
      }
    },
  })
}
</script>

<template>
  <div>
    <div class="filtros">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText
          v-model="buscar"
          placeholder="Buscar por nombre"
          :maxlength="NOMBRE_ARCHIVO_MAX"
          aria-label="Buscar por nombre"
        />
      </IconField>
      <Select
        :model-value="filtros.tipo"
        :options="OPCIONES_TIPO_ARCHIVO"
        option-label="label"
        option-value="value"
        placeholder="Todos los tipos"
        show-clear
        aria-label="Tipo de archivo"
        @update:model-value="(t: TipoArchivo | null) => (filtros.tipo = t ?? undefined)"
      />
      <Select
        :model-value="filtros.usuarioId"
        :options="usuarios"
        option-label="label"
        option-value="value"
        placeholder="Todos los usuarios"
        filter
        show-clear
        aria-label="Dueño"
        class="filtros__usuario"
        @update:model-value="(id: number | null) => (filtros.usuarioId = id ?? undefined)"
      />
      <small v-if="hayMasUsuarios" class="filtros__aviso">
        El filtro muestra los primeros {{ LIMITE_MAXIMO }} usuarios.
      </small>
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
      <template #empty>No hay archivos para mostrar.</template>
      <Column header="" class="icono">
        <template #body="{ data }">
          <i :class="DATOS_TIPO_ARCHIVO[(data as ArchivoListado).tipo].icono" aria-hidden="true" />
        </template>
      </Column>
      <Column header="Nombre">
        <template #body="{ data }">
          <button type="button" class="nombre" @click="emit('abrir', data as ArchivoListado)">
            {{ (data as ArchivoListado).nombreOriginal }}
          </button>
        </template>
      </Column>
      <Column header="Dueño">
        <template #body="{ data }">{{ (data as ArchivoListado).usuario.nombre }}</template>
      </Column>
      <Column header="Carpeta">
        <template #body="{ data }">
          {{ (data as ArchivoListado).carpeta?.nombre ?? 'Raíz' }}
        </template>
      </Column>
      <Column header="Tipo">
        <template #body="{ data }">
          {{ DATOS_TIPO_ARCHIVO[(data as ArchivoListado).tipo].etiqueta }}
        </template>
      </Column>
      <Column header="Tamaño" class="numero">
        <template #body="{ data }">
          {{ formato.tamano((data as ArchivoListado).tamanoBytes) }}
        </template>
      </Column>
      <Column header="Duración" class="numero">
        <template #body="{ data }">
          {{ formato.duracion((data as ArchivoListado).duracionSeg) || '—' }}
        </template>
      </Column>
      <Column header="Fecha">
        <template #body="{ data }">{{ formato.fecha((data as ArchivoListado).creadoEn) }}</template>
      </Column>
      <Column header="Acciones" class="acciones">
        <template #body="{ data }">
          <Button
            v-if="visorDe(data as ArchivoListado) !== 'descargar'"
            v-tooltip.top="'Abrir'"
            icon="pi pi-eye"
            text
            rounded
            aria-label="Abrir"
            @click="emit('abrir', data as ArchivoListado)"
          />
          <Button
            v-tooltip.top="'Descargar'"
            icon="pi pi-download"
            text
            rounded
            aria-label="Descargar"
            @click="emit('descargar', data as ArchivoListado)"
          />
          <Button
            v-tooltip.top="'Renombrar'"
            icon="pi pi-pencil"
            text
            rounded
            aria-label="Renombrar"
            @click="renombrar(data as ArchivoListado)"
          />
          <Button
            v-tooltip.top="'Borrar'"
            icon="pi pi-trash"
            text
            rounded
            severity="danger"
            aria-label="Borrar"
            :loading="borrando === (data as ArchivoListado).id"
            @click="borrar(data as ArchivoListado)"
          />
        </template>
      </Column>
    </DataTable>

    <DialogoNombre
      v-model:visible="dialogoNombre"
      titulo="Renombrar archivo"
      etiqueta="Nombre"
      :inicial="renombrado?.nombreOriginal ?? ''"
      :maximo="NOMBRE_ARCHIVO_MAX"
      campo="nombreOriginal"
      :validar="validarNombreArchivo"
      :guardar="guardarNombre"
    />
  </div>
</template>

<style scoped>
.filtros {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
  margin: 1rem 0;
}

.filtros__usuario {
  min-width: 14rem;
}

.filtros__aviso {
  color: var(--p-text-muted-color);
}

.nombre {
  background: none;
  border: none;
  padding: 0;
  color: var(--p-primary-color);
  cursor: pointer;
  font: inherit;
  text-align: left;
  overflow-wrap: anywhere;
}

.nombre:hover {
  text-decoration: underline;
}

:deep(.icono) {
  width: 1%;
}

:deep(.numero) {
  text-align: right;
  white-space: nowrap;
}

:deep(.acciones) {
  white-space: nowrap;
  width: 1%;
}
</style>
