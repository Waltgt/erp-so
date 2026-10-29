<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Password from 'primevue/password'
import { useToast } from 'primevue/usetoast'
import { ref, watch } from 'vue'
import { restablecerPassword } from '@/api/usuarios'
import CampoFormulario from '@/components/CampoFormulario.vue'
import { useApiError } from '@/composables/useApiError'
import type { Usuario } from '@/types/auth'
import { PASSWORD_MIN } from '@/types/usuarios'
import {
  erroresDelServidor,
  validarRestablecerPassword,
  type Errores,
} from '@/validaciones/usuarios'

// El ADMIN fija una contraseña nueva a otro usuario (sin pedir la actual)
const props = defineProps<{ usuario: Usuario | null }>()
const visible = defineModel<boolean>('visible', { required: true })

const toast = useToast()
const { mostrarError } = useApiError()

const password = ref('')
const confirmacion = ref('')
const errores = ref<Errores>({})
const guardando = ref(false)

// Al abrir y al cerrar: sin contraseñas ni errores
watch(visible, () => {
  password.value = ''
  confirmacion.value = ''
  errores.value = {}
})

async function guardar(): Promise<void> {
  errores.value = validarRestablecerPassword(password.value, confirmacion.value)
  if (Object.keys(errores.value).length > 0 || !props.usuario) {
    return
  }
  guardando.value = true
  try {
    await restablecerPassword(props.usuario.id, { password: password.value })
    toast.add({
      severity: 'success',
      summary: 'Contraseña restablecida',
      detail: `Comunícale la contraseña nueva a ${props.usuario.nombre}.`,
      life: 5000,
    })
    visible.value = false
  } catch (error) {
    errores.value = erroresDelServidor(mostrarError(error, ['password']).campos)
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="Restablecer contraseña"
    :style="{ width: '26rem' }"
    :breakpoints="{ '575px': '95vw' }"
    :closable="!guardando"
  >
    <p class="para">
      Usuario: <strong>{{ usuario?.nombre }}</strong> ({{ usuario?.email }})
    </p>
    <form id="form-restablecer" novalidate @submit.prevent="guardar">
      <CampoFormulario
        etiqueta="Contraseña nueva"
        para="restablecer-password"
        :error="errores.password"
        :ayuda="`Mínimo ${PASSWORD_MIN} caracteres`"
      >
        <Password
          v-model="password"
          input-id="restablecer-password"
          :feedback="false"
          toggle-mask
          fluid
          :invalid="!!errores.password"
          :input-props="{ autocomplete: 'new-password' }"
        />
      </CampoFormulario>
      <CampoFormulario
        etiqueta="Confirmar contraseña"
        para="restablecer-confirmacion"
        :error="errores.confirmacion"
      >
        <Password
          v-model="confirmacion"
          input-id="restablecer-confirmacion"
          :feedback="false"
          toggle-mask
          fluid
          :invalid="!!errores.confirmacion"
          :input-props="{ autocomplete: 'new-password' }"
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
        form="form-restablecer"
        label="Restablecer"
        icon="pi pi-key"
        :loading="guardando"
        :disabled="guardando"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.para {
  margin-top: 0;
}
</style>
