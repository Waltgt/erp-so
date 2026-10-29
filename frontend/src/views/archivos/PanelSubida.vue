<script setup lang="ts">
import Button from 'primevue/button'
import FileUpload, { type FileUploadUploaderEvent } from 'primevue/fileupload'
import ProgressBar from 'primevue/progressbar'
import { subirArchivo } from '@/api/archivos'
import { useColaSubida } from '@/composables/useColaSubida'
import { traducirError } from '@/composables/useApiError'
import { formatoTamano } from '@/composables/useFormato'
import {
  ACCEPT_ARCHIVOS,
  ARCHIVO_TAMANO_MAX_BYTES,
  ARCHIVO_TAMANO_MAX_MB,
  type Archivo,
} from '@/types/archivos'

// Subir a la carpeta que se está viendo. FileUpload solo elige los archivos
// (y descarta en el navegador los de tipo o tamaño no permitidos, con su
// aviso); la cola los sube de a uno con su barra de progreso.
const props = defineProps<{ carpetaId: number | null }>()
const emit = defineEmits<{ subido: [archivo: Archivo, carpetaId: number | null] }>()

const { subidas, activa, agregar, limpiar } = useColaSubida({
  subir: subirArchivo,
  // 413 / 415 / sin conexión: junto al archivo, sin Toast (puede haber varios)
  mensajeDeError: (error) => {
    const { titulo, mensajes } = traducirError(error)
    return mensajes.length > 0 ? `${titulo}: ${mensajes.join(' ')}` : titulo
  },
  alSubir: (archivo, carpetaId) => emit('subido', archivo, carpetaId),
})

function alElegir(evento: FileUploadUploaderEvent): void {
  const lista = Array.isArray(evento.files) ? evento.files : [evento.files]
  agregar([...lista], props.carpetaId)
  // Se vacía la lista interna de FileUpload (es el mismo arreglo): la cola es
  // la que muestra el estado. No se usa clear() porque borraría los avisos de
  // los archivos rechazados.
  if (Array.isArray(evento.files)) {
    evento.files.splice(0)
  }
}

defineExpose({ activa })
</script>

<template>
  <div class="subida">
    <FileUpload
      mode="advanced"
      name="archivo"
      multiple
      auto
      custom-upload
      :accept="ACCEPT_ARCHIVOS"
      :max-file-size="ARCHIVO_TAMANO_MAX_BYTES"
      choose-label="Elegir archivos"
      :show-upload-button="false"
      :show-cancel-button="false"
      invalid-file-type-message="{0}: tipo de archivo no permitido."
      :invalid-file-size-message="`{0}: supera el máximo de ${ARCHIVO_TAMANO_MAX_MB} MB.`"
      @uploader="alElegir"
    >
      <template #empty>
        <p class="subida__ayuda">
          <i class="pi pi-cloud-upload" aria-hidden="true" />
          Arrastra los archivos aquí o usa «Elegir archivos». Máximo {{ ARCHIVO_TAMANO_MAX_MB }}
          MB por archivo: música, documentos (PDF, Word, Excel, texto), imágenes y video.
        </p>
      </template>
    </FileUpload>

    <div v-if="subidas.length > 0" class="cola">
      <div class="cola__encabezado">
        <strong>{{ activa ? 'Subiendo…' : 'Subidas terminadas' }}</strong>
        <Button
          v-if="!activa"
          label="Limpiar lista"
          icon="pi pi-times"
          text
          size="small"
          @click="limpiar"
        />
      </div>
      <ul class="cola__lista">
        <li v-for="subida in subidas" :key="subida.clave" class="cola__fila">
          <div class="cola__datos">
            <span class="cola__nombre">{{ subida.nombre }}</span>
            <span class="cola__tamano">{{ formatoTamano(subida.tamano) }}</span>
          </div>
          <ProgressBar
            v-if="subida.estado === 'subiendo' || subida.estado === 'pendiente'"
            :value="subida.progreso"
            :show-value="subida.estado === 'subiendo'"
            class="cola__barra"
          />
          <small v-else-if="subida.estado === 'listo'" class="cola__listo">
            <i class="pi pi-check" aria-hidden="true" /> Subido
          </small>
          <small v-else class="cola__error" role="alert">
            <i class="pi pi-times-circle" aria-hidden="true" /> {{ subida.error }}
          </small>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.subida {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.subida__ayuda {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0;
  color: var(--p-text-muted-color);
}

.subida__ayuda .pi {
  font-size: 1.5rem;
}

.cola {
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  padding: 0.75rem;
}

.cola__encabezado {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.cola__lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-height: 14rem;
  overflow-y: auto;
}

.cola__datos {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.25rem;
}

.cola__nombre {
  overflow-wrap: anywhere;
}

.cola__tamano {
  color: var(--p-text-muted-color);
  white-space: nowrap;
}

.cola__barra {
  height: 0.9rem;
}

.cola__listo {
  color: var(--p-green-600);
}

.cola__error {
  color: var(--p-red-600);
}
</style>
