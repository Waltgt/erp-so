<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { ref, watch } from 'vue'
import CampoFormulario from '@/components/CampoFormulario.vue'
import { useApiError } from '@/composables/useApiError'

// Un solo campo de nombre: nueva carpeta, renombrar carpeta o archivo.
// `guardar` hace la petición; si falla, el error del campo (400 o el 409
// "Registro duplicado: nombre") se muestra debajo y el diálogo sigue abierto.
const props = defineProps<{
  titulo: string
  etiqueta: string
  inicial: string
  maximo: number
  // El campo del backend al que corresponden los errores
  campo: 'nombre' | 'nombreOriginal'
  validar: (nombre: string) => string | null
  guardar: (nombre: string) => Promise<void>
}>()
const visible = defineModel<boolean>('visible', { required: true })

const { mostrarError } = useApiError()

const nombre = ref('')
const error = ref<string | undefined>()
const guardando = ref(false)

watch(
  visible,
  (abierto) => {
    if (abierto) {
      nombre.value = props.inicial
      error.value = undefined
    }
  },
  // Se monta (v-if) ya abierto: también al crearse
  { immediate: true },
)

async function enviar(): Promise<void> {
  error.value = props.validar(nombre.value) ?? undefined
  if (error.value) {
    return
  }
  const limpio = nombre.value.trim()
  if (limpio === props.inicial) {
    visible.value = false
    return
  }
  guardando.value = true
  try {
    await props.guardar(limpio)
    visible.value = false
  } catch (e) {
    const campos = mostrarError(e, [props.campo]).campos
    const mensajes = campos[props.campo]
    if (mensajes) {
      error.value = mensajes[0]!.startsWith('Registro duplicado')
        ? 'Ya existe una carpeta con ese nombre aquí'
        : mensajes.join(' ')
    }
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="titulo"
    :style="{ width: '26rem' }"
    :breakpoints="{ '575px': '95vw' }"
    :closable="!guardando"
  >
    <form id="form-nombre" novalidate @submit.prevent="enviar">
      <CampoFormulario :etiqueta="etiqueta" para="archivos-nombre" :error="error">
        <InputText
          id="archivos-nombre"
          v-model="nombre"
          :maxlength="maximo"
          :invalid="!!error"
          autocomplete="off"
          autofocus
          fluid
        />
      </CampoFormulario>
    </form>

    <template #footer>
      <Button
        label="Cancelar"
        severity="secondary"
        outlined
        :disabled="guardando"
        @click="visible = false"
      />
      <Button
        type="submit"
        form="form-nombre"
        label="Guardar"
        icon="pi pi-check"
        :loading="guardando"
        :disabled="guardando"
      />
    </template>
  </Dialog>
</template>
