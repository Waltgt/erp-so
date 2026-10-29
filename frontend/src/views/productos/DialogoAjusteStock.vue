<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, reactive, ref, watch } from 'vue'
import { ajustarStock, obtenerProducto } from '@/api/productos'
import { esErrorApi } from '@/api/http'
import CampoFormulario from '@/components/CampoFormulario.vue'
import { useApiError } from '@/composables/useApiError'
import { CANTIDAD_MAXIMA, MOTIVO_MAX, MOTIVO_MIN, type Producto } from '@/types/productos'
import { erroresDelServidor, type Errores } from '@/validaciones/comun'
import {
  cantidadFirmada,
  stockResultante,
  validarAjuste,
  type FormularioAjuste,
} from '@/validaciones/productos'

const props = defineProps<{ producto: Producto | null }>()
const visible = defineModel<boolean>('visible', { required: true })
// El producto con el stock real: tras el ajuste, o recargado después de un 409
const emit = defineEmits<{ actualizado: [producto: Producto] }>()

const toast = useToast()
const { mostrarError } = useApiError()

const TIPOS = [
  { label: 'Entrada', value: 'entrada' },
  { label: 'Salida', value: 'salida' },
]

const vacio = (): FormularioAjuste => ({ tipo: 'entrada', cantidad: null, motivo: '' })
const formulario = reactive(vacio())
const errores = ref<Errores>({})
const guardando = ref(false)

const actual = computed(() => props.producto?.stock ?? 0)
const resultante = computed(() => stockResultante(actual.value, formulario))

watch(visible, (abierto) => {
  if (abierto) {
    Object.assign(formulario, vacio())
    errores.value = {}
  }
})

async function guardar(): Promise<void> {
  errores.value = validarAjuste(formulario)
  if (Object.keys(errores.value).length > 0 || !props.producto) {
    return
  }
  const { id } = props.producto
  guardando.value = true
  try {
    const producto = await ajustarStock(id, {
      cantidad: cantidadFirmada(formulario),
      motivo: formulario.motivo.trim(),
    })
    emit('actualizado', producto)
    toast.add({
      severity: 'success',
      summary: 'Stock ajustado',
      detail: `${producto.nombre}: stock ${producto.stock}`,
      life: 3000,
    })
    visible.value = false
  } catch (error) {
    errores.value = erroresDelServidor(mostrarError(error, ['cantidad', 'motivo']).campos)
    // 409 "Stock insuficiente": otro usuario pudo haber cambiado el stock.
    // Se recarga el producto y el diálogo sigue abierto con el valor real.
    if (esErrorApi(error) && error.response?.status === 409) {
      try {
        emit('actualizado', await obtenerProducto(id))
      } catch (errorRecarga) {
        mostrarError(errorRecarga)
      }
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
    header="Ajustar stock"
    :style="{ width: '28rem' }"
    :breakpoints="{ '575px': '95vw' }"
    :closable="!guardando"
  >
    <p class="producto">
      <strong>{{ producto?.nombre }}</strong> ({{ producto?.sku }})
    </p>

    <form id="form-ajuste" novalidate @submit.prevent="guardar">
      <CampoFormulario etiqueta="Tipo" para="ajuste-tipo">
        <SelectButton
          id="ajuste-tipo"
          v-model="formulario.tipo"
          :options="TIPOS"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
      </CampoFormulario>

      <CampoFormulario etiqueta="Cantidad" para="ajuste-cantidad" :error="errores.cantidad">
        <InputNumber
          v-model="formulario.cantidad"
          input-id="ajuste-cantidad"
          :min="1"
          :max="CANTIDAD_MAXIMA"
          :invalid="!!errores.cantidad"
          autofocus
          fluid
        />
      </CampoFormulario>

      <CampoFormulario
        etiqueta="Motivo"
        para="ajuste-motivo"
        :error="errores.motivo"
        :ayuda="`De ${MOTIVO_MIN} a ${MOTIVO_MAX} caracteres`"
      >
        <Textarea
          id="ajuste-motivo"
          v-model="formulario.motivo"
          :maxlength="MOTIVO_MAX"
          :invalid="!!errores.motivo"
          rows="2"
          auto-resize
          fluid
        />
      </CampoFormulario>

      <dl class="resumen">
        <dt>Stock actual</dt>
        <dd>{{ actual }}</dd>
        <dt>Stock resultante</dt>
        <dd :class="{ negativo: resultante < 0 }">{{ resultante }}</dd>
      </dl>
      <p v-if="resultante < 0" class="negativo nota">
        La salida es mayor al stock actual: el servidor la rechazará.
      </p>
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
        form="form-ajuste"
        label="Confirmar ajuste"
        icon="pi pi-check"
        :loading="guardando"
        :disabled="guardando"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.producto {
  margin-top: 0;
}

.resumen {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.4rem 1.5rem;
  margin: 0;
}

.resumen dt {
  font-weight: 600;
  color: var(--p-text-muted-color);
}

.resumen dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.negativo {
  color: var(--p-red-500);
  font-weight: 600;
}

.nota {
  margin: 0.75rem 0 0;
  font-size: 0.875rem;
}
</style>
