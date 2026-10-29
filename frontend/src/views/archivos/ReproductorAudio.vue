<script setup lang="ts">
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { ref, toRef, useTemplateRef, watch } from 'vue'
import { useApiError } from '@/composables/useApiError'
import { formatoDuracion } from '@/composables/useFormato'
import { useFuenteFirmada } from '@/composables/useFuenteFirmada'
import type { Archivo } from '@/types/archivos'

// Reproductor fijo al pie. La URL firmada solo va al `src` del <audio>.
const props = defineProps<{
  archivo: Archivo | null
  pedirUrl: (archivoId: number) => Promise<string>
}>()
const emit = defineEmits<{ cerrar: [] }>()

const toast = useToast()
const { mostrarError } = useApiError()
const archivo = toRef(props, 'archivo')
const { src, abrir, cerrar, alError } = useFuenteFirmada(props.pedirUrl)
const audio = useTemplateRef<HTMLAudioElement>('audio')

// El backend no calcula la duración: se toma de los metadatos del audio
const duracion = ref<number | null>(null)

watch(
  () => props.archivo?.id ?? null,
  async (id) => {
    duracion.value = props.archivo?.duracionSeg ?? null
    if (id === null) {
      cerrar()
      return
    }
    try {
      await abrir(id)
    } catch (error) {
      mostrarError(error)
      emit('cerrar')
    }
  },
  { immediate: true },
)

function alCargarMetadatos(): void {
  const segundos = audio.value?.duration
  if (segundos !== undefined && Number.isFinite(segundos)) {
    duracion.value = segundos
  }
}

async function alFallar(): Promise<void> {
  // Sin src (se cerró) el navegador también dispara error: se ignora
  if (!audio.value || !src.value) {
    return
  }
  if (!(await alError(audio.value))) {
    toast.add({
      severity: 'error',
      summary: 'No se pudo reproducir',
      detail: archivo.value?.nombreOriginal,
      life: 6000,
    })
  }
}
</script>

<template>
  <div v-if="archivo" class="reproductor no-imprimir" role="region" aria-label="Reproductor">
    <div class="reproductor__datos">
      <i class="pi pi-volume-up" aria-hidden="true" />
      <div>
        <div class="reproductor__titulo">{{ archivo.nombreOriginal }}</div>
        <small v-if="duracion !== null" class="reproductor__duracion">
          {{ formatoDuracion(duracion) }}
        </small>
      </div>
    </div>
    <audio
      v-if="src"
      ref="audio"
      class="reproductor__audio"
      :src="src"
      controls
      autoplay
      preload="metadata"
      @loadedmetadata="alCargarMetadatos"
      @error="alFallar"
    />
    <Button
      v-tooltip.top="'Cerrar reproductor'"
      icon="pi pi-times"
      text
      rounded
      severity="secondary"
      aria-label="Cerrar reproductor"
      @click="emit('cerrar')"
    />
  </div>
</template>

<style scoped>
.reproductor {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 900;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 1rem;
  background: var(--p-content-background);
  border-top: 1px solid var(--p-content-border-color);
  box-shadow: 0 -2px 8px rgb(0 0 0 / 0.08);
}

.reproductor__datos {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  flex: 0 1 18rem;
}

.reproductor__titulo {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reproductor__duracion {
  color: var(--p-text-muted-color);
}

.reproductor__audio {
  flex: 1;
  min-width: 0;
}

@media (max-width: 600px) {
  .reproductor {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .reproductor__datos {
    flex: 1 1 auto;
  }

  .reproductor__audio {
    order: 3;
    flex-basis: 100%;
  }
}
</style>
