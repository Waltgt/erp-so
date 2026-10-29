<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { computed, ref, watch } from 'vue'
import { contenidoCarpeta } from '@/api/archivos'
import { useApiError } from '@/composables/useApiError'
import type { Carpeta } from '@/types/archivos'

// Elegir la carpeta destino navegando de a un nivel (como el explorador).
// Al mover una carpeta, ella no aparece como opción: así tampoco se puede
// entrar a sus descendientes. Si el backend igual responde 400, se muestra.
const props = defineProps<{
  // Lo que se mueve
  nombre: string
  // La carpeta que se mueve (null si es un archivo)
  carpetaMovida: number | null
  // Donde está ahora (null = raíz)
  origen: number | null
  mover: (destino: number | null) => Promise<void>
}>()
const visible = defineModel<boolean>('visible', { required: true })

const { mostrarError } = useApiError()

// Nivel que se está viendo: es el destino si se confirma
const actual = ref<Carpeta | null>(null)
const ruta = ref<Carpeta[]>([])
const carpetas = ref<Carpeta[]>([])
const cargando = ref(false)
const moviendo = ref(false)

const destino = computed(() => actual.value?.id ?? null)
const nombreDestino = computed(() => actual.value?.nombre ?? 'Mis archivos')

async function ir(carpeta: Carpeta | null): Promise<void> {
  cargando.value = true
  try {
    const contenido = await contenidoCarpeta(carpeta?.id ?? null)
    carpetas.value = contenido.carpetas.filter((c) => c.id !== props.carpetaMovida)
    if (carpeta === null) {
      ruta.value = []
    } else {
      const i = ruta.value.findIndex((c) => c.id === carpeta.id)
      ruta.value = i >= 0 ? ruta.value.slice(0, i + 1) : [...ruta.value, carpeta]
    }
    actual.value = carpeta
  } catch (error) {
    mostrarError(error)
  } finally {
    cargando.value = false
  }
}

// Siempre empieza en la raíz
watch(
  visible,
  (abierto) => {
    if (abierto) {
      actual.value = null
      ruta.value = []
      carpetas.value = []
      void ir(null)
    }
  },
  { immediate: true },
)

async function confirmar(): Promise<void> {
  moviendo.value = true
  try {
    await props.mover(destino.value)
    visible.value = false
  } catch (error) {
    mostrarError(error)
  } finally {
    moviendo.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="`Mover «${nombre}»`"
    :style="{ width: '30rem' }"
    :breakpoints="{ '575px': '95vw' }"
    :closable="!moviendo"
  >
    <nav class="ruta" aria-label="Carpeta destino">
      <button type="button" class="ruta__paso" :disabled="cargando" @click="ir(null)">
        <i class="pi pi-home" aria-hidden="true" /> Mis archivos
      </button>
      <template v-for="carpeta in ruta" :key="carpeta.id">
        <i class="pi pi-angle-right ruta__separador" aria-hidden="true" />
        <button type="button" class="ruta__paso" :disabled="cargando" @click="ir(carpeta)">
          {{ carpeta.nombre }}
        </button>
      </template>
    </nav>

    <ul class="lista" :aria-busy="cargando">
      <li v-for="carpeta in carpetas" :key="carpeta.id">
        <button type="button" class="lista__carpeta" :disabled="cargando" @click="ir(carpeta)">
          <i class="pi pi-folder" aria-hidden="true" />
          <span>{{ carpeta.nombre }}</span>
          <i class="pi pi-angle-right" aria-hidden="true" />
        </button>
      </li>
      <li v-if="!cargando && carpetas.length === 0" class="lista__vacia">Sin subcarpetas.</li>
    </ul>

    <p class="destino">
      Destino: <strong>{{ nombreDestino }}</strong>
      <span v-if="destino === origen"> (ya está aquí)</span>
    </p>

    <template #footer>
      <Button
        label="Cancelar"
        severity="secondary"
        outlined
        :disabled="moviendo"
        @click="visible = false"
      />
      <Button
        label="Mover aquí"
        icon="pi pi-check"
        :loading="moviendo"
        :disabled="moviendo || cargando || destino === origen"
        @click="confirmar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.ruta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

.ruta__paso {
  background: none;
  border: none;
  padding: 0.2rem 0.3rem;
  border-radius: 4px;
  color: var(--p-primary-color);
  cursor: pointer;
  font: inherit;
}

.ruta__paso:disabled {
  cursor: wait;
}

.ruta__separador {
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}

.lista {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 16rem;
  overflow-y: auto;
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
}

.lista__carpeta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.6rem 0.75rem;
  background: none;
  border: none;
  border-bottom: 1px solid var(--p-content-border-color);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.lista__carpeta span {
  flex: 1;
  overflow-wrap: anywhere;
}

.lista__carpeta:hover {
  background: var(--p-content-hover-background);
}

.lista__vacia {
  padding: 0.75rem;
  color: var(--p-text-muted-color);
}

.destino {
  margin: 0.75rem 0 0;
}
</style>
