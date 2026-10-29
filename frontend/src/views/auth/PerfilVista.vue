<script setup lang="ts">
import Button from 'primevue/button'
import Card from 'primevue/card'
import Password from 'primevue/password'
import { useToast } from 'primevue/usetoast'
import { reactive, ref } from 'vue'
import { cambiarPassword } from '@/api/auth'
import CampoFormulario from '@/components/CampoFormulario.vue'
import EtiquetaRol from '@/components/EtiquetaRol.vue'
import { useApiError } from '@/composables/useApiError'
import { useFormato } from '@/composables/useFormato'
import { useAuthStore } from '@/stores/auth'
import { PASSWORD_MIN } from '@/types/usuarios'
import {
  erroresDelServidor,
  validarCambioPassword,
  type Errores,
  type FormularioCambioPassword,
} from '@/validaciones/usuarios'

const auth = useAuthStore()
const toast = useToast()
const { mostrarError, traducirError } = useApiError()
const CAMPOS = ['passwordActual', 'passwordNueva'] as const
const { fecha } = useFormato()

const vacio = (): FormularioCambioPassword => ({
  passwordActual: '',
  passwordNueva: '',
  confirmacion: '',
})
const formulario = reactive(vacio())
const errores = ref<Errores>({})
const guardando = ref(false)

// Mensajes de texto del backend (400) que corresponden a un campo
const CAMPO_DEL_MENSAJE: Record<string, keyof FormularioCambioPassword> = {
  'La contraseña actual es incorrecta': 'passwordActual',
  'La contraseña nueva debe ser distinta de la actual': 'passwordNueva',
}

async function guardar(): Promise<void> {
  errores.value = validarCambioPassword(formulario)
  if (Object.keys(errores.value).length > 0) {
    return
  }
  guardando.value = true
  try {
    await cambiarPassword({
      passwordActual: formulario.passwordActual,
      passwordNueva: formulario.passwordNueva,
    })
    Object.assign(formulario, vacio())
    toast.add({
      severity: 'success',
      summary: 'Contraseña cambiada',
      detail: 'Úsala la próxima vez que inicies sesión.',
      life: 4000,
    })
  } catch (error) {
    const { status, mensajes } = traducirError(error, CAMPOS)
    const mensaje = mensajes[0]
    const campo = status === 400 && mensaje ? CAMPO_DEL_MENSAJE[mensaje] : undefined
    errores.value = campo
      ? { [campo]: mensaje! }
      : erroresDelServidor(mostrarError(error, CAMPOS).campos)
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <section class="perfil">
    <h1>Mi perfil</h1>
    <div class="perfil__columnas">
      <Card>
        <template #title>Mis datos</template>
        <template #content>
          <dl class="datos">
            <dt>Nombre</dt>
            <dd>{{ auth.usuario?.nombre }}</dd>
            <dt>Email</dt>
            <dd>{{ auth.usuario?.email }}</dd>
            <dt>Rol</dt>
            <dd><EtiquetaRol v-if="auth.rol" :rol="auth.rol" /></dd>
            <dt>Cuenta creada</dt>
            <dd>{{ fecha(auth.usuario?.creadoEn) }}</dd>
          </dl>
        </template>
      </Card>

      <Card>
        <template #title>Cambiar contraseña</template>
        <template #content>
          <form novalidate @submit.prevent="guardar">
            <CampoFormulario
              etiqueta="Contraseña actual"
              para="perfil-actual"
              :error="errores.passwordActual"
            >
              <Password
                v-model="formulario.passwordActual"
                input-id="perfil-actual"
                :feedback="false"
                toggle-mask
                fluid
                :invalid="!!errores.passwordActual"
                :input-props="{ autocomplete: 'current-password' }"
              />
            </CampoFormulario>
            <CampoFormulario
              etiqueta="Contraseña nueva"
              para="perfil-nueva"
              :error="errores.passwordNueva"
              :ayuda="`Mínimo ${PASSWORD_MIN} caracteres`"
            >
              <Password
                v-model="formulario.passwordNueva"
                input-id="perfil-nueva"
                :feedback="false"
                toggle-mask
                fluid
                :invalid="!!errores.passwordNueva"
                :input-props="{ autocomplete: 'new-password' }"
              />
            </CampoFormulario>
            <CampoFormulario
              etiqueta="Confirmar contraseña nueva"
              para="perfil-confirmacion"
              :error="errores.confirmacion"
            >
              <Password
                v-model="formulario.confirmacion"
                input-id="perfil-confirmacion"
                :feedback="false"
                toggle-mask
                fluid
                :invalid="!!errores.confirmacion"
                :input-props="{ autocomplete: 'new-password' }"
              />
            </CampoFormulario>
            <Button
              type="submit"
              label="Cambiar contraseña"
              icon="pi pi-key"
              :loading="guardando"
              :disabled="guardando"
            />
          </form>
        </template>
      </Card>
    </div>
  </section>
</template>

<style scoped>
.perfil h1 {
  margin-top: 0;
}

.perfil__columnas {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
  gap: 1rem;
  align-items: start;
}

.datos {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.75rem 1.5rem;
  margin: 0;
}

.datos dt {
  font-weight: 600;
  color: var(--p-text-muted-color);
}

.datos dd {
  margin: 0;
}
</style>
