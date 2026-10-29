<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import { computed, useTemplateRef, watch } from 'vue'
import { useApiError } from '@/composables/useApiError'
import { useFuenteFirmada } from '@/composables/useFuenteFirmada'
import type { Archivo } from '@/types/archivos'
import { visorDe } from '@/validaciones/archivos'

// Video o imagen en un diálogo. La URL firmada solo va al `src`.
const props = defineProps<{
  archivo: Archivo | null
  pedirUrl: (archivoId: number) => Promise<string>
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ descargar: [archivo: Archivo] }>()

const toast = useToast()
const { mostrarError } = useApiError()
const { src, abrir, cerrar, alError } = useFuenteFirmada(props.pedirUrl)
const video = useTemplateRef<HTMLVideoElement>('video')

const esVideo = computed(() => props.archivo !== null && visorDe(props.archivo) === 'video')

watch(visible, async (abierto) => {
  if (!abierto || !props.archivo) {
    // Al cerrar se quita el src: el video deja de bajarse
    cerrar()
    return
  }
  try {
    await abrir(props.archivo.id)
  } catch (error) {
    mostrarError(error)
    visible.value = false
  }
})

function avisarFalla(): void {
  toast.add({
    severity: 'error',
    summary: esVideo.value ? 'No se pudo reproducir' : 'No se pudo mostrar',
    detail: props.archivo?.nombreOriginal,
    life: 6000,
  })
}

async function alFallarVideo(): Promise<void> {
  if (!video.value || !src.value) {
    return
  }
  if (!(await alError(video.value))) {
    avisarFalla()
  }
}

// Una imagen se baja de una vez: si falla no hay desde dónde seguir
function alFallarImagen(): void {
  if (src.value) {
    avisarFalla()
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="archivo?.nombreOriginal ?? ''"
    :style="{ width: '56rem' }"
    :breakpoints="{ '960px': '95vw' }"
    :dismissable-mask="true"
  >
    <div class="visor">
      <video
        v-if="esVideo && src"
        ref="video"
        class="visor__medio"
        :src="src"
        controls
        autoplay
        preload="metadata"
        @error="alFallarVideo"
      />
      <img
        v-else-if="src && archivo"
        class="visor__medio"
        :src="src"
        :alt="archivo.nombreOriginal"
        @error="alFallarImagen"
      />
      <i v-else class="pi pi-spin pi-spinner visor__cargando" aria-label="Cargando" />
    </div>

    <template #footer>
      <Button
        v-if="archivo"
        label="Descargar"
        icon="pi pi-download"
        severity="secondary"
        outlined
        @click="emit('descargar', archivo)"
      />
      <Button label="Cerrar" @click="visible = false" />
    </template>
  </Dialog>
</template>

<style scoped>
.visor {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 12rem;
}

.visor__medio {
  display: block;
  max-width: 100%;
  max-height: 70vh;
}

.visor__cargando {
  font-size: 2rem;
  color: var(--p-text-muted-color);
}
</style>
