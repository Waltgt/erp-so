<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { computed, reactive, ref, watch } from 'vue'
import { actualizarCliente, crearCliente } from '@/api/clientes'
import CampoFormulario from '@/components/CampoFormulario.vue'
import { useApiError } from '@/composables/useApiError'
import {
  DIRECCION_MAX,
  EMAIL_CLIENTE_MAX,
  NIT_CONSUMIDOR_FINAL,
  NIT_MAX,
  NOMBRE_CLIENTE_MAX,
  TELEFONO_MAX,
  type Cliente,
} from '@/types/clientes'
import {
  cambiosDeCliente,
  datosNuevoCliente,
  formularioDeCliente,
  validarCliente,
} from '@/validaciones/clientes'
import { erroresDelServidor, type Errores } from '@/validaciones/comun'

// Crear (cliente = null) o editar
const props = defineProps<{ cliente: Cliente | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ guardado: [cliente: Cliente, creado: boolean] }>()

const { mostrarError } = useApiError()
const CAMPOS = ['nit', 'nombre', 'email', 'telefono', 'direccion'] as const

const creando = computed(() => props.cliente === null)

const formulario = reactive(formularioDeCliente(null))
const errores = ref<Errores>({})
const guardando = ref(false)

// Cada vez que se abre: datos del cliente (o vacío) y sin errores
watch(visible, (abierto) => {
  if (abierto) {
    Object.assign(formulario, formularioDeCliente(props.cliente))
    errores.value = {}
  }
})

function consumidorFinal(): void {
  formulario.nit = NIT_CONSUMIDOR_FINAL
  delete errores.value.nit
}

async function guardar(): Promise<void> {
  errores.value = validarCliente(formulario)
  if (Object.keys(errores.value).length > 0) {
    return
  }
  guardando.value = true
  try {
    if (props.cliente === null) {
      emit('guardado', await crearCliente(datosNuevoCliente(formulario)), true)
    } else {
      const cambios = cambiosDeCliente(props.cliente, formulario)
      if (Object.keys(cambios).length > 0) {
        emit('guardado', await actualizarCliente(props.cliente.id, cambios), false)
      }
    }
    visible.value = false
  } catch (error) {
    errores.value = erroresDelServidor(mostrarError(error, CAMPOS).campos)
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="creando ? 'Nuevo cliente' : 'Editar cliente'"
    :style="{ width: '30rem' }"
    :breakpoints="{ '575px': '95vw' }"
    :closable="!guardando"
  >
    <form id="form-cliente" novalidate @submit.prevent="guardar">
      <CampoFormulario etiqueta="NIT" para="cliente-nit" :error="errores.nit">
        <div class="nit">
          <InputText
            id="cliente-nit"
            v-model="formulario.nit"
            :maxlength="NIT_MAX"
            :invalid="!!errores.nit"
            autocomplete="off"
            autofocus
            fluid
          />
          <Button
            label="Consumidor final"
            severity="secondary"
            outlined
            type="button"
            @click="consumidorFinal"
          />
        </div>
      </CampoFormulario>

      <CampoFormulario etiqueta="Nombre" para="cliente-nombre" :error="errores.nombre">
        <InputText
          id="cliente-nombre"
          v-model="formulario.nombre"
          :maxlength="NOMBRE_CLIENTE_MAX"
          :invalid="!!errores.nombre"
          fluid
        />
      </CampoFormulario>

      <CampoFormulario etiqueta="Email (opcional)" para="cliente-email" :error="errores.email">
        <InputText
          id="cliente-email"
          v-model="formulario.email"
          type="email"
          :maxlength="EMAIL_CLIENTE_MAX"
          :invalid="!!errores.email"
          autocomplete="off"
          fluid
        />
      </CampoFormulario>

      <CampoFormulario
        etiqueta="Teléfono (opcional)"
        para="cliente-telefono"
        :error="errores.telefono"
      >
        <InputText
          id="cliente-telefono"
          v-model="formulario.telefono"
          type="tel"
          :maxlength="TELEFONO_MAX"
          :invalid="!!errores.telefono"
          autocomplete="off"
          fluid
        />
      </CampoFormulario>

      <CampoFormulario
        etiqueta="Dirección (opcional)"
        para="cliente-direccion"
        :error="errores.direccion"
      >
        <Textarea
          id="cliente-direccion"
          v-model="formulario.direccion"
          :maxlength="DIRECCION_MAX"
          :invalid="!!errores.direccion"
          rows="2"
          auto-resize
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
        form="form-cliente"
        :label="creando ? 'Crear' : 'Guardar'"
        icon="pi pi-check"
        :loading="guardando"
        :disabled="guardando"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.nit {
  display: flex;
  gap: 0.5rem;
}

.nit :deep(.p-button) {
  flex-shrink: 0;
}
</style>
