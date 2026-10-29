<script setup lang="ts">
import AutoComplete, { type AutoCompleteCompleteEvent } from 'primevue/autocomplete'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { ref, shallowRef, watch } from 'vue'
import { listarClientes } from '@/api/clientes'
import { useApiError } from '@/composables/useApiError'
import { LIMITE_MAXIMO } from '@/types/api'
import { NIT_CONSUMIDOR_FINAL, type Cliente } from '@/types/clientes'
import DialogoCliente from '@/views/clientes/DialogoCliente.vue'

// Busca clientes activos con /api/clientes?buscar= (nombre o NIT).
// conAcciones: botones "Consumidor final" y "Nuevo cliente" (en la venta).
defineProps<{ inputId: string; conAcciones?: boolean; invalid?: boolean }>()
const cliente = defineModel<Cliente | null>({ required: true })

const toast = useToast()
const { mostrarError } = useApiError()

// Mientras se escribe, el AutoComplete guarda el texto; el modelo solo
// cambia al elegir un cliente (y vuelve a null si se edita el texto)
const valor = ref<Cliente | string | null>(cliente.value)
watch(cliente, (c) => {
  // null mientras se escribe no borra el texto; null con un cliente elegido sí
  const actual = valor.value
  if (c !== null ? c !== actual : actual !== null && typeof actual === 'object') {
    valor.value = c
  }
})
watch(valor, (v) => {
  const elegido = v !== null && typeof v === 'object' ? v : null
  if (elegido !== cliente.value) {
    cliente.value = elegido
  }
})

const sugerencias = shallowRef<Cliente[]>([])
const buscandoCf = ref(false)

const etiqueta = (c: Cliente): string => `${c.nombre} (${c.nit})`

async function buscar(evento: AutoCompleteCompleteEvent): Promise<void> {
  try {
    sugerencias.value = (await listarClientes({ buscar: evento.query.trim(), limit: 10 })).data
  } catch (error) {
    sugerencias.value = []
    mostrarError(error)
  }
}

// El primer cliente activo con NIT CF (la búsqueda "CF" también trae nombres
// que contienen "cf": se filtra por el NIT exacto)
async function consumidorFinal(): Promise<void> {
  buscandoCf.value = true
  try {
    const { data } = await listarClientes({ buscar: NIT_CONSUMIDOR_FINAL, limit: LIMITE_MAXIMO })
    const cf = data.find((c) => c.nit === NIT_CONSUMIDOR_FINAL)
    if (cf) {
      cliente.value = cf
    } else {
      toast.add({
        severity: 'warn',
        summary: 'Sin consumidor final',
        detail: 'No hay un cliente activo con NIT CF. Créalo con "Nuevo cliente".',
        life: 5000,
      })
    }
  } catch (error) {
    mostrarError(error)
  } finally {
    buscandoCf.value = false
  }
}

const dialogo = ref(false)

function alCrear(nuevo: Cliente): void {
  cliente.value = nuevo
  toast.add({ severity: 'success', summary: 'Cliente creado', detail: nuevo.nombre, life: 3000 })
}
</script>

<template>
  <div class="selector">
    <AutoComplete
      v-model="valor"
      :input-id="inputId"
      :suggestions="sugerencias"
      :option-label="etiqueta"
      :delay="300"
      :invalid="invalid"
      force-selection
      placeholder="Buscar por nombre o NIT"
      empty-search-message="Ningún cliente activo coincide"
      class="selector__campo"
      fluid
      @complete="buscar"
    >
      <template #option="{ option }">
        <div class="opcion">
          <span>{{ (option as Cliente).nombre }}</span>
          <small>NIT {{ (option as Cliente).nit }}</small>
        </div>
      </template>
    </AutoComplete>
    <template v-if="conAcciones">
      <Button
        label="Consumidor final"
        severity="secondary"
        outlined
        type="button"
        :loading="buscandoCf"
        @click="consumidorFinal"
      />
      <Button
        v-tooltip.top="'Nuevo cliente'"
        icon="pi pi-user-plus"
        severity="secondary"
        outlined
        type="button"
        aria-label="Nuevo cliente"
        @click="dialogo = true"
      />
      <DialogoCliente v-model:visible="dialogo" :cliente="null" @guardado="alCrear" />
    </template>
  </div>
</template>

<style scoped>
.selector {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.selector__campo {
  flex: 1 1 16rem;
}

.opcion {
  display: flex;
  flex-direction: column;
}

.opcion small {
  color: var(--p-text-muted-color);
}
</style>
