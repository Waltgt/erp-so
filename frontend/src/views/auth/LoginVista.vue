<script setup lang="ts">
import Button from 'primevue/button'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Password from 'primevue/password'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import CampoFormulario from '@/components/CampoFormulario.vue'
import { useFormularioLogin } from '@/composables/useFormularioLogin'
import { MOTIVO_SESION_TERMINADA } from '@/sesion'

// Si ya hay sesión, el guard del router lleva al inicio antes de llegar aquí
const route = useRoute()
const { ingresar, enviando, error, bloqueado, restantes } = useFormularioLogin()

const email = ref('')
const password = ref('')

const sesionTerminada = computed(() => route.query.motivo === MOTIVO_SESION_TERMINADA)
const completo = computed(() => email.value.trim() !== '' && password.value !== '')
const textoBoton = computed(() => (bloqueado.value ? `Espera ${restantes.value} s` : 'Ingresar'))

function enviar(): void {
  if (completo.value) {
    void ingresar(email.value, password.value)
  }
}
</script>

<template>
  <main class="login">
    <Card class="login__tarjeta">
      <template #title>
        <div class="login__marca">
          <i class="pi pi-briefcase" aria-hidden="true" />
          ERP
        </div>
      </template>
      <template #subtitle>Inicia sesión para continuar</template>
      <template #content>
        <Message v-if="sesionTerminada && !error" severity="warn" :closable="false" class="aviso">
          Tu sesión terminó. Vuelve a iniciar sesión.
        </Message>
        <Message v-if="error" severity="error" :closable="false" class="aviso">
          {{ error }}
        </Message>

        <form novalidate @submit.prevent="enviar">
          <CampoFormulario etiqueta="Email" para="login-email">
            <InputText
              id="login-email"
              v-model="email"
              type="email"
              autocomplete="username"
              autofocus
              fluid
            />
          </CampoFormulario>
          <CampoFormulario etiqueta="Contraseña" para="login-password">
            <Password
              v-model="password"
              input-id="login-password"
              :feedback="false"
              toggle-mask
              fluid
              :input-props="{ autocomplete: 'current-password' }"
            />
          </CampoFormulario>
          <Button
            type="submit"
            :label="textoBoton"
            icon="pi pi-sign-in"
            :loading="enviando"
            :disabled="!completo || enviando || bloqueado"
            fluid
          />
        </form>
      </template>
    </Card>
  </main>
</template>

<style scoped>
.login {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1rem;
}

.login__tarjeta {
  width: 100%;
  max-width: 24rem;
}

.login__marca {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.5rem;
}

.aviso {
  margin-bottom: 1rem;
}
</style>
