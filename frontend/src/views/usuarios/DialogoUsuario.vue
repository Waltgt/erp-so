<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Select from 'primevue/select'
import { computed, reactive, ref, watch } from 'vue'
import { actualizarUsuario, crearUsuario } from '@/api/usuarios'
import CampoFormulario from '@/components/CampoFormulario.vue'
import { useApiError } from '@/composables/useApiError'
import { OPCIONES_ROL } from '@/constantes/roles'
import type { Usuario } from '@/types/auth'
import {
  EMAIL_MAX,
  NOMBRE_MAX,
  PASSWORD_MIN,
  type ActualizarUsuarioPeticion,
} from '@/types/usuarios'
import {
  erroresDelServidor,
  validarUsuario,
  type Errores,
  type FormularioUsuario,
} from '@/validaciones/usuarios'

// Crear (usuario = null) o editar. Al editar, el email no se cambia y la
// contraseña va por "Restablecer contraseña".
const props = defineProps<{
  usuario: Usuario | null
  // Es el usuario de la sesión: no puede cambiarse el rol (el backend
  // respondería 409)
  esPropio: boolean
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ guardado: [usuario: Usuario, creado: boolean] }>()

const { mostrarError } = useApiError()
const CAMPOS = ['nombre', 'email', 'password', 'rol'] as const

const creando = computed(() => props.usuario === null)

const vacio = (): FormularioUsuario => ({
  nombre: '',
  email: '',
  rol: null,
  password: '',
  confirmacion: '',
})
const formulario = reactive(vacio())
const errores = ref<Errores>({})
const guardando = ref(false)

// Cada vez que se abre: datos del usuario (o vacío) y sin errores. Al cerrar
// también se limpia, para que las contraseñas no queden en memoria.
watch(visible, (abierto) => {
  Object.assign(
    formulario,
    abierto && props.usuario
      ? {
          ...vacio(),
          nombre: props.usuario.nombre,
          email: props.usuario.email,
          rol: props.usuario.rol,
        }
      : vacio(),
  )
  errores.value = {}
})

async function guardar(): Promise<void> {
  errores.value = validarUsuario(formulario, creando.value ? 'crear' : 'editar')
  if (Object.keys(errores.value).length > 0) {
    return
  }
  guardando.value = true
  try {
    if (props.usuario === null) {
      const creado = await crearUsuario({
        nombre: formulario.nombre.trim(),
        email: formulario.email.trim(),
        password: formulario.password,
        rol: formulario.rol!,
      })
      emit('guardado', creado, true)
    } else {
      // Solo lo que cambió (el backend responde 400 a un body vacío)
      const cambios: ActualizarUsuarioPeticion = {}
      const nombre = formulario.nombre.trim()
      if (nombre !== props.usuario.nombre) {
        cambios.nombre = nombre
      }
      if (formulario.rol !== props.usuario.rol) {
        cambios.rol = formulario.rol!
      }
      if (Object.keys(cambios).length > 0) {
        emit('guardado', await actualizarUsuario(props.usuario.id, cambios), false)
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
    :header="creando ? 'Nuevo usuario' : 'Editar usuario'"
    :style="{ width: '28rem' }"
    :breakpoints="{ '575px': '95vw' }"
    :closable="!guardando"
  >
    <form id="form-usuario" novalidate @submit.prevent="guardar">
      <CampoFormulario etiqueta="Nombre" para="usuario-nombre" :error="errores.nombre">
        <InputText
          id="usuario-nombre"
          v-model="formulario.nombre"
          :maxlength="NOMBRE_MAX"
          :invalid="!!errores.nombre"
          autofocus
          fluid
        />
      </CampoFormulario>

      <CampoFormulario
        etiqueta="Email"
        para="usuario-email"
        :error="errores.email"
        :ayuda="creando ? undefined : 'El email no se puede cambiar'"
      >
        <InputText
          id="usuario-email"
          v-model="formulario.email"
          type="email"
          :maxlength="EMAIL_MAX"
          :disabled="!creando"
          :invalid="!!errores.email"
          autocomplete="off"
          fluid
        />
      </CampoFormulario>

      <CampoFormulario
        etiqueta="Rol"
        para="usuario-rol"
        :error="errores.rol"
        :ayuda="esPropio ? 'No puedes cambiar tu propio rol' : undefined"
      >
        <Select
          v-model="formulario.rol"
          input-id="usuario-rol"
          :options="OPCIONES_ROL"
          option-label="label"
          option-value="value"
          placeholder="Elige un rol"
          :disabled="esPropio"
          :invalid="!!errores.rol"
          fluid
        />
      </CampoFormulario>

      <template v-if="creando">
        <CampoFormulario
          etiqueta="Contraseña"
          para="usuario-password"
          :error="errores.password"
          :ayuda="`Mínimo ${PASSWORD_MIN} caracteres`"
        >
          <Password
            v-model="formulario.password"
            input-id="usuario-password"
            :feedback="false"
            toggle-mask
            fluid
            :invalid="!!errores.password"
            :input-props="{ autocomplete: 'new-password' }"
          />
        </CampoFormulario>
        <CampoFormulario
          etiqueta="Confirmar contraseña"
          para="usuario-confirmacion"
          :error="errores.confirmacion"
        >
          <Password
            v-model="formulario.confirmacion"
            input-id="usuario-confirmacion"
            :feedback="false"
            toggle-mask
            fluid
            :invalid="!!errores.confirmacion"
            :input-props="{ autocomplete: 'new-password' }"
          />
        </CampoFormulario>
      </template>
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
        form="form-usuario"
        :label="creando ? 'Crear' : 'Guardar'"
        icon="pi pi-check"
        :loading="guardando"
        :disabled="guardando"
      />
    </template>
  </Dialog>
</template>
