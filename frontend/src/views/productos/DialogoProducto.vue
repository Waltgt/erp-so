<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, reactive, ref, watch } from 'vue'
import { actualizarProducto, crearProducto } from '@/api/productos'
import CampoFormulario from '@/components/CampoFormulario.vue'
import { useApiError } from '@/composables/useApiError'
import { useOpcionesProveedores } from '@/composables/useOpcionesProveedores'
import { NOMBRE_ENTIDAD_MAX } from '@/types/contacto'
import {
  CANTIDAD_MAXIMA,
  DESCRIPCION_MAX,
  DINERO_MAXIMO,
  SKU_MAX,
  type Producto,
} from '@/types/productos'
import { erroresDelServidor, type Errores } from '@/validaciones/comun'
import {
  cambiaPrecio,
  cambiosDeProducto,
  datosNuevoProducto,
  formularioDeProducto,
  validarProducto,
} from '@/validaciones/productos'

// Crear (producto = null) o editar. Solo ADMIN y BODEGUERO (los que ven el
// costo). El stock no está aquí: el backend no lo acepta por PATCH; se cambia
// con "Ajustar stock".
const props = defineProps<{ producto: Producto | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ guardado: [producto: Producto, creado: boolean] }>()

const { mostrarError } = useApiError()
const CAMPOS = [
  'sku',
  'nombre',
  'descripcion',
  'precioVenta',
  'costo',
  'stockMinimo',
  'proveedorId',
] as const

const proveedores = useOpcionesProveedores(mostrarError)

const creando = computed(() => props.producto === null)

const formulario = reactive(formularioDeProducto(null))
const errores = ref<Errores>({})
const guardando = ref(false)

const avisoPrecio = computed(
  () => props.producto !== null && cambiaPrecio(props.producto, formulario),
)

watch(visible, (abierto) => {
  if (!abierto) {
    return
  }
  Object.assign(formulario, formularioDeProducto(props.producto))
  errores.value = {}
  // El proveedor actual puede no estar entre los activos cargados
  proveedores.incluir(props.producto?.proveedor ?? null)
  if (proveedores.opciones.value.length === 0 || props.producto === null) {
    void proveedores.cargar()
  }
})

async function guardar(): Promise<void> {
  errores.value = validarProducto(formulario)
  if (Object.keys(errores.value).length > 0) {
    return
  }
  guardando.value = true
  try {
    if (props.producto === null) {
      emit('guardado', await crearProducto(datosNuevoProducto(formulario)), true)
    } else {
      const cambios = cambiosDeProducto(props.producto, formulario)
      if (Object.keys(cambios).length > 0) {
        emit('guardado', await actualizarProducto(props.producto.id, cambios), false)
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
    :header="creando ? 'Nuevo producto' : 'Editar producto'"
    :style="{ width: '34rem' }"
    :breakpoints="{ '575px': '95vw' }"
    :closable="!guardando"
  >
    <form id="form-producto" novalidate @submit.prevent="guardar">
      <div class="fila">
        <CampoFormulario
          etiqueta="SKU"
          para="producto-sku"
          :error="errores.sku"
          ayuda="Se guarda en mayúsculas"
        >
          <InputText
            id="producto-sku"
            v-model="formulario.sku"
            :maxlength="SKU_MAX"
            :invalid="!!errores.sku"
            autocomplete="off"
            autofocus
            fluid
          />
        </CampoFormulario>
        <CampoFormulario
          etiqueta="Stock mínimo"
          para="producto-minimo"
          :error="errores.stockMinimo"
        >
          <InputNumber
            v-model="formulario.stockMinimo"
            input-id="producto-minimo"
            :min="0"
            :max="CANTIDAD_MAXIMA"
            :invalid="!!errores.stockMinimo"
            fluid
          />
        </CampoFormulario>
      </div>

      <CampoFormulario etiqueta="Nombre" para="producto-nombre" :error="errores.nombre">
        <InputText
          id="producto-nombre"
          v-model="formulario.nombre"
          :maxlength="NOMBRE_ENTIDAD_MAX"
          :invalid="!!errores.nombre"
          fluid
        />
      </CampoFormulario>

      <CampoFormulario
        etiqueta="Descripción (opcional)"
        para="producto-descripcion"
        :error="errores.descripcion"
      >
        <Textarea
          id="producto-descripcion"
          v-model="formulario.descripcion"
          :maxlength="DESCRIPCION_MAX"
          :invalid="!!errores.descripcion"
          rows="2"
          auto-resize
          fluid
        />
      </CampoFormulario>

      <div class="fila">
        <CampoFormulario
          etiqueta="Precio de venta"
          para="producto-precio"
          :error="errores.precioVenta"
        >
          <InputNumber
            v-model="formulario.precioVenta"
            input-id="producto-precio"
            mode="currency"
            currency="GTQ"
            locale="es-GT"
            :min="0"
            :max="DINERO_MAXIMO"
            :min-fraction-digits="2"
            :max-fraction-digits="2"
            :invalid="!!errores.precioVenta"
            fluid
          />
        </CampoFormulario>
        <CampoFormulario etiqueta="Costo" para="producto-costo" :error="errores.costo">
          <InputNumber
            v-model="formulario.costo"
            input-id="producto-costo"
            mode="currency"
            currency="GTQ"
            locale="es-GT"
            :min="0"
            :max="DINERO_MAXIMO"
            :min-fraction-digits="2"
            :max-fraction-digits="2"
            :invalid="!!errores.costo"
            fluid
          />
        </CampoFormulario>
      </div>
      <Message v-if="avisoPrecio" severity="warn" size="small" class="aviso">
        El cambio no afecta ventas ya registradas.
      </Message>

      <CampoFormulario
        etiqueta="Proveedor (opcional)"
        para="producto-proveedor"
        :error="errores.proveedorId"
        :ayuda="
          proveedores.hayMas.value
            ? 'Se muestran los primeros 100 proveedores activos; escribe para filtrarlos'
            : undefined
        "
      >
        <Select
          v-model="formulario.proveedorId"
          input-id="producto-proveedor"
          :options="proveedores.opciones.value"
          option-label="label"
          option-value="value"
          :loading="proveedores.cargando.value"
          placeholder="Sin proveedor"
          filter
          filter-placeholder="Buscar proveedor"
          show-clear
          :invalid="!!errores.proveedorId"
          fluid
        />
      </CampoFormulario>

      <Message v-if="creando" severity="secondary" size="small">
        El producto empieza con stock 0. Cárgalo después con "Ajustar stock".
      </Message>
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
        form="form-producto"
        :label="creando ? 'Crear' : 'Guardar'"
        icon="pi pi-check"
        :loading="guardando"
        :disabled="guardando"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.fila {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  column-gap: 1rem;
}

.aviso {
  margin: -0.5rem 0 1rem;
}
</style>
