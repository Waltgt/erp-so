<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { computed, reactive, ref, watch } from 'vue'
import { actualizarProveedor, crearProveedor } from '@/api/proveedores'
import CampoFormulario from '@/components/CampoFormulario.vue'
import { useApiError } from '@/composables/useApiError'
import {
  DIRECCION_MAX,
  EMAIL_CONTACTO_MAX,
  NIT_MAX,
  NOMBRE_ENTIDAD_MAX,
  TELEFONO_MAX,
} from '@/types/contacto'
import { CONTACTO_MAX, type Proveedor } from '@/types/proveedores'
import { erroresDelServidor, type Errores } from '@/validaciones/comun'
import {
  cambiosDeProveedor,
  datosNuevoProveedor,
  formularioDeProveedor,
  validarProveedor,
} from '@/validaciones/proveedores'

// Crear (proveedor = null) o editar. Sin botón "Consumidor final": los
// proveedores no admiten CF (si se escribe, el backend responde 400).
const props = defineProps<{ proveedor: Proveedor | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ guardado: [proveedor: Proveedor, creado: boolean] }>()

const { mostrarError } = useApiError()
const CAMPOS = ['nit', 'nombre', 'contacto', 'telefono', 'email', 'direccion'] as const

const creando = computed(() => props.proveedor === null)

const formulario = reactive(formularioDeProveedor(null))
const errores = ref<Errores>({})
const guardando = ref(false)

// Cada vez que se abre: datos del proveedor (o vacío) y sin errores
watch(visible, (abierto) => {
  if (abierto) {
    Object.assign(formulario, formularioDeProveedor(props.proveedor))
    errores.value = {}
  }
})

async function guardar(): Promise<void> {
  errores.value = validarProveedor(formulario)
  if (Object.keys(errores.value).length > 0) {
    return
  }
  guardando.value = true
  try {
    if (props.proveedor === null) {
      emit('guardado', await crearProveedor(datosNuevoProveedor(formulario)), true)
    } else {
      const cambios = cambiosDeProveedor(props.proveedor, formulario)
      if (Object.keys(cambios).length > 0) {
        emit('guardado', await actualizarProveedor(props.proveedor.id, cambios), false)
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
    :header="creando ? 'Nuevo proveedor' : 'Editar proveedor'"
    :style="{ width: '30rem' }"
    :breakpoints="{ '575px': '95vw' }"
    :closable="!guardando"
  >
    <form id="form-proveedor" novalidate @submit.prevent="guardar">
      <CampoFormulario etiqueta="NIT" para="proveedor-nit" :error="errores.nit">
        <InputText
          id="proveedor-nit"
          v-model="formulario.nit"
          :maxlength="NIT_MAX"
          :invalid="!!errores.nit"
          autocomplete="off"
          autofocus
          fluid
        />
      </CampoFormulario>

      <CampoFormulario
        etiqueta="Nombre o razón social"
        para="proveedor-nombre"
        :error="errores.nombre"
      >
        <InputText
          id="proveedor-nombre"
          v-model="formulario.nombre"
          :maxlength="NOMBRE_ENTIDAD_MAX"
          :invalid="!!errores.nombre"
          fluid
        />
      </CampoFormulario>

      <CampoFormulario
        etiqueta="Persona de contacto (opcional)"
        para="proveedor-contacto"
        :error="errores.contacto"
      >
        <InputText
          id="proveedor-contacto"
          v-model="formulario.contacto"
          :maxlength="CONTACTO_MAX"
          :invalid="!!errores.contacto"
          autocomplete="off"
          fluid
        />
      </CampoFormulario>

      <CampoFormulario
        etiqueta="Teléfono (opcional)"
        para="proveedor-telefono"
        :error="errores.telefono"
      >
        <InputText
          id="proveedor-telefono"
          v-model="formulario.telefono"
          type="tel"
          :maxlength="TELEFONO_MAX"
          :invalid="!!errores.telefono"
          autocomplete="off"
          fluid
        />
      </CampoFormulario>

      <CampoFormulario etiqueta="Email (opcional)" para="proveedor-email" :error="errores.email">
        <InputText
          id="proveedor-email"
          v-model="formulario.email"
          type="email"
          :maxlength="EMAIL_CONTACTO_MAX"
          :invalid="!!errores.email"
          autocomplete="off"
          fluid
        />
      </CampoFormulario>

      <CampoFormulario
        etiqueta="Dirección (opcional)"
        para="proveedor-direccion"
        :error="errores.direccion"
      >
        <Textarea
          id="proveedor-direccion"
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
        form="form-proveedor"
        :label="creando ? 'Crear' : 'Guardar'"
        icon="pi pi-check"
        :loading="guardando"
        :disabled="guardando"
      />
    </template>
  </Dialog>
</template>
