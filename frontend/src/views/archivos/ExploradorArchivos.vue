<script setup lang="ts">
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  actualizarArchivo,
  actualizarCarpeta,
  borrarArchivo,
  borrarCarpeta,
  contenidoCarpeta,
  crearCarpeta,
} from '@/api/archivos'
import { traducirError, useApiError } from '@/composables/useApiError'
import { useFormato } from '@/composables/useFormato'
import { useRutaCarpetas } from '@/composables/useRutaCarpetas'
import { DATOS_TIPO_ARCHIVO, OPCIONES_TIPO_ARCHIVO } from '@/constantes/archivos'
import {
  NOMBRE_ARCHIVO_MAX,
  NOMBRE_CARPETA_MAX,
  type Archivo,
  type Carpeta,
  type ContenidoCarpeta,
  type TipoArchivo,
} from '@/types/archivos'
import {
  filtrarNivel,
  validarNombreArchivo,
  validarNombreCarpeta,
  visorDe,
} from '@/validaciones/archivos'
import DialogoMover from './DialogoMover.vue'
import DialogoNombre from './DialogoNombre.vue'
import PanelSubida from './PanelSubida.vue'

// Las carpetas propias, de a un nivel (también para ADMIN: GET /carpetas
// devuelve siempre las del usuario). La carpeta actual va en la URL
// (?carpeta=12) para poder recargar o volver con el botón Atrás.
const emit = defineEmits<{
  abrir: [archivo: Archivo]
  descargar: [archivo: Archivo]
  borrado: [archivoId: number]
}>()

const route = useRoute()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const { mostrarError } = useApiError()
const formato = useFormato()

const rutaCarpetas = useRutaCarpetas(contenidoCarpeta)

// ─── Nivel actual ─────────────────────────────────────────────────
function idDeLaUrl(): number | null {
  const valor = route.query.carpeta
  const texto = Array.isArray(valor) ? valor[0] : valor
  return typeof texto === 'string' && /^[1-9]\d*$/.test(texto) ? Number(texto) : null
}

const carpetaId = ref<number | null>(idDeLaUrl())
const contenido = shallowRef<ContenidoCarpeta>({ carpeta: null, carpetas: [], archivos: [] })
const ruta = ref<Carpeta[]>([])
const cargando = ref(false)
let ultimaConsulta = 0

async function cargar(): Promise<void> {
  const consulta = ++ultimaConsulta
  const id = carpetaId.value
  cargando.value = true
  try {
    const respuesta = await contenidoCarpeta(id)
    if (consulta !== ultimaConsulta) {
      return
    }
    rutaCarpetas.recordar(respuesta)
    contenido.value = respuesta
    ruta.value = await rutaCarpetas.rutaHasta(respuesta.carpeta)
  } catch (error) {
    if (consulta !== ultimaConsulta) {
      return
    }
    // La carpeta de la URL ya no existe o es ajena: volver a la raíz
    if (traducirError(error).status === 404 && id !== null) {
      toast.add({
        severity: 'warn',
        summary: 'Carpeta no encontrada',
        detail: 'Se muestra la raíz.',
        life: 4000,
      })
      void router.replace({ query: {} })
    } else {
      mostrarError(error)
    }
  } finally {
    if (consulta === ultimaConsulta) {
      cargando.value = false
    }
  }
}

watch(
  () => route.query.carpeta,
  () => {
    // Al salir a otra pantalla también cambia la query: no recargar
    if (route.name !== 'archivos') {
      return
    }
    carpetaId.value = idDeLaUrl()
    void cargar()
  },
  { immediate: true },
)

function irA(id: number | null): void {
  void router.push({ query: id === null ? {} : { carpeta: String(id) } })
}

// ─── Filtros del nivel (llega completo: se filtra aquí) ────────────
const buscar = ref('')
const tipo = ref<TipoArchivo | null>(null)

// Al cambiar de carpeta, se limpian
watch(carpetaId, () => {
  buscar.value = ''
  tipo.value = null
})

// Primero carpetas, luego archivos. Una fila tiene carpeta o archivo.
interface Fila {
  clave: string
  nombre: string
  icono: string
  tipo: string
  creadoEn: string
  carpeta: Carpeta | null
  archivo: Archivo | null
}

const filas = computed<Fila[]>(() => {
  const nivel = filtrarNivel(contenido.value, buscar.value, tipo.value)
  return [
    ...nivel.carpetas.map((carpeta) => ({
      clave: `c${carpeta.id}`,
      nombre: carpeta.nombre,
      icono: 'pi pi-folder',
      tipo: 'Carpeta',
      creadoEn: carpeta.creadoEn,
      carpeta,
      archivo: null,
    })),
    ...nivel.archivos.map((archivo) => ({
      clave: `a${archivo.id}`,
      nombre: archivo.nombreOriginal,
      icono: DATOS_TIPO_ARCHIVO[archivo.tipo].icono,
      tipo: DATOS_TIPO_ARCHIVO[archivo.tipo].etiqueta,
      creadoEn: archivo.creadoEn,
      carpeta: null,
      archivo,
    })),
  ]
})

const hayFiltros = computed(() => buscar.value.trim() !== '' || tipo.value !== null)

// ─── Subir ─────────────────────────────────────────────────────────
const mostrarSubida = ref(false)

// Si mientras subía se cambió de carpeta, el archivo no se agrega a la vista
function alSubir(archivo: Archivo, destino: number | null): void {
  if (destino === carpetaId.value) {
    contenido.value = { ...contenido.value, archivos: [...contenido.value.archivos, archivo] }
  }
}

// ─── Nombre: nueva carpeta y renombrar ─────────────────────────────
interface EdicionNombre {
  titulo: string
  etiqueta: string
  inicial: string
  maximo: number
  campo: 'nombre' | 'nombreOriginal'
  validar: (nombre: string) => string | null
  guardar: (nombre: string) => Promise<void>
}

const dialogoNombre = ref(false)
const edicion = shallowRef<EdicionNombre | null>(null)

function abrirNombre(datos: EdicionNombre): void {
  edicion.value = datos
  dialogoNombre.value = true
}

function nuevaCarpeta(): void {
  abrirNombre({
    titulo: 'Nueva carpeta',
    etiqueta: 'Nombre',
    inicial: '',
    maximo: NOMBRE_CARPETA_MAX,
    campo: 'nombre',
    validar: validarNombreCarpeta,
    guardar: async (nombre) => {
      const destino = carpetaId.value
      const creada = await crearCarpeta({ nombre, parentId: destino })
      toast.add({
        severity: 'success',
        summary: 'Carpeta creada',
        detail: creada.nombre,
        life: 3000,
      })
      if (destino === carpetaId.value) {
        contenido.value = { ...contenido.value, carpetas: [...contenido.value.carpetas, creada] }
        rutaCarpetas.recordar({ carpeta: null, carpetas: [creada], archivos: [] })
      }
    },
  })
}

function reemplazarCarpeta(carpeta: Carpeta): void {
  contenido.value = {
    ...contenido.value,
    carpetas: contenido.value.carpetas.map((c) => (c.id === carpeta.id ? carpeta : c)),
  }
}

function reemplazarArchivo(archivo: Archivo): void {
  contenido.value = {
    ...contenido.value,
    archivos: contenido.value.archivos.map((a) => (a.id === archivo.id ? archivo : a)),
  }
}

function renombrarCarpeta(carpeta: Carpeta): void {
  abrirNombre({
    titulo: 'Renombrar carpeta',
    etiqueta: 'Nombre',
    inicial: carpeta.nombre,
    maximo: NOMBRE_CARPETA_MAX,
    campo: 'nombre',
    validar: validarNombreCarpeta,
    guardar: async (nombre) => {
      const actualizada = await actualizarCarpeta(carpeta.id, { nombre })
      rutaCarpetas.recordar({ carpeta: actualizada, carpetas: [], archivos: [] })
      reemplazarCarpeta(actualizada)
      toast.add({
        severity: 'success',
        summary: 'Carpeta renombrada',
        detail: actualizada.nombre,
        life: 3000,
      })
    },
  })
}

function renombrarArchivo(archivo: Archivo): void {
  abrirNombre({
    titulo: 'Renombrar archivo',
    etiqueta: 'Nombre',
    inicial: archivo.nombreOriginal,
    maximo: NOMBRE_ARCHIVO_MAX,
    campo: 'nombreOriginal',
    validar: validarNombreArchivo,
    guardar: async (nombreOriginal) => {
      const actualizado = await actualizarArchivo(archivo.id, { nombreOriginal })
      reemplazarArchivo(actualizado)
      toast.add({
        severity: 'success',
        summary: 'Archivo renombrado',
        detail: actualizado.nombreOriginal,
        life: 3000,
      })
    },
  })
}

// ─── Mover ─────────────────────────────────────────────────────────
interface Movimiento {
  nombre: string
  carpetaMovida: number | null
  origen: number | null
  mover: (destino: number | null) => Promise<void>
}

const dialogoMover = ref(false)
const movimiento = shallowRef<Movimiento | null>(null)

function moverCarpeta(carpeta: Carpeta): void {
  movimiento.value = {
    nombre: carpeta.nombre,
    carpetaMovida: carpeta.id,
    origen: carpeta.parentId,
    mover: async (destino) => {
      const movida = await actualizarCarpeta(carpeta.id, { parentId: destino })
      rutaCarpetas.recordar({ carpeta: movida, carpetas: [], archivos: [] })
      quitarDeLaVista(`c${carpeta.id}`)
      toast.add({
        severity: 'success',
        summary: 'Carpeta movida',
        detail: movida.nombre,
        life: 3000,
      })
    },
  }
  dialogoMover.value = true
}

function moverArchivo(archivo: Archivo): void {
  movimiento.value = {
    nombre: archivo.nombreOriginal,
    carpetaMovida: null,
    origen: archivo.carpetaId,
    mover: async (destino) => {
      const movido = await actualizarArchivo(archivo.id, { carpetaId: destino })
      quitarDeLaVista(`a${archivo.id}`)
      toast.add({
        severity: 'success',
        summary: 'Archivo movido',
        detail: movido.nombreOriginal,
        life: 3000,
      })
    },
  }
  dialogoMover.value = true
}

function quitarDeLaVista(clave: string): void {
  contenido.value = {
    ...contenido.value,
    carpetas: contenido.value.carpetas.filter((c) => `c${c.id}` !== clave),
    archivos: contenido.value.archivos.filter((a) => `a${a.id}` !== clave),
  }
}

// ─── Borrar ────────────────────────────────────────────────────────
const borrando = ref<string | null>(null)

function borrar(fila: Fila): void {
  const { carpeta, archivo, nombre } = fila
  confirm.require({
    header: carpeta ? 'Borrar carpeta' : 'Borrar archivo',
    message: carpeta
      ? `Se borrará la carpeta «${nombre}». Debe estar vacía. ¿Continuar?`
      : `Se borrará «${nombre}» definitivamente. ¿Continuar?`,
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: 'Cancelar', severity: 'secondary', outlined: true },
    acceptProps: { label: 'Borrar', severity: 'danger' },
    accept: async () => {
      borrando.value = fila.clave
      try {
        if (carpeta) {
          await borrarCarpeta(carpeta.id)
          rutaCarpetas.olvidar(carpeta.id)
        } else if (archivo) {
          await borrarArchivo(archivo.id)
          emit('borrado', archivo.id)
        }
        quitarDeLaVista(fila.clave)
        toast.add({ severity: 'success', summary: 'Borrado', detail: nombre, life: 3000 })
      } catch (error) {
        // 409: la carpeta tiene contenido (se muestra el mensaje del backend)
        mostrarError(error)
      } finally {
        borrando.value = null
      }
    },
  })
}

// ─── Abrir ─────────────────────────────────────────────────────────
const ICONOS_VISOR = {
  audio: 'pi pi-play',
  video: 'pi pi-play',
  imagen: 'pi pi-eye',
  pdf: 'pi pi-external-link',
  descargar: 'pi pi-download',
} as const

function abrirFila(fila: Fila): void {
  if (fila.carpeta) {
    irA(fila.carpeta.id)
  } else if (fila.archivo) {
    emit('abrir', fila.archivo)
  }
}
</script>

<template>
  <div>
    <nav class="ruta" aria-label="Ubicación">
      <button v-if="ruta.length > 0" type="button" class="ruta__paso" @click="irA(null)">
        <i class="pi pi-home" aria-hidden="true" /> Mis archivos
      </button>
      <span v-else class="ruta__actual">
        <i class="pi pi-home" aria-hidden="true" /> Mis archivos
      </span>
      <template v-for="(carpeta, i) in ruta" :key="carpeta.id">
        <i class="pi pi-angle-right ruta__separador" aria-hidden="true" />
        <button
          v-if="i < ruta.length - 1"
          type="button"
          class="ruta__paso"
          @click="irA(carpeta.id)"
        >
          {{ carpeta.nombre }}
        </button>
        <span v-else class="ruta__actual" aria-current="page">{{ carpeta.nombre }}</span>
      </template>
    </nav>

    <div class="barra">
      <div class="barra__filtros">
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText
            v-model="buscar"
            placeholder="Buscar en esta carpeta"
            :maxlength="NOMBRE_ARCHIVO_MAX"
            aria-label="Buscar en esta carpeta"
          />
        </IconField>
        <Select
          v-model="tipo"
          :options="OPCIONES_TIPO_ARCHIVO"
          option-label="label"
          option-value="value"
          placeholder="Todos los tipos"
          show-clear
          aria-label="Tipo de archivo"
        />
      </div>
      <div class="barra__acciones">
        <Button
          label="Nueva carpeta"
          icon="pi pi-folder-plus"
          severity="secondary"
          outlined
          @click="nuevaCarpeta"
        />
        <Button
          :label="mostrarSubida ? 'Ocultar subida' : 'Subir archivos'"
          icon="pi pi-upload"
          @click="mostrarSubida = !mostrarSubida"
        />
      </div>
    </div>

    <!-- v-show: si se oculta mientras sube, la cola sigue trabajando -->
    <PanelSubida v-show="mostrarSubida" :carpeta-id="carpetaId" @subido="alSubir" />

    <DataTable
      :value="filas"
      :loading="cargando"
      data-key="clave"
      striped-rows
      :paginator="filas.length > 50"
      :rows="50"
    >
      <template #empty>
        {{ hayFiltros ? 'Nada coincide con los filtros.' : 'Esta carpeta está vacía.' }}
      </template>
      <Column header="" class="icono">
        <template #body="{ data }">
          <i :class="(data as Fila).icono" aria-hidden="true" />
        </template>
      </Column>
      <Column header="Nombre">
        <template #body="{ data }">
          <button type="button" class="nombre" @click="abrirFila(data as Fila)">
            {{ (data as Fila).nombre }}
          </button>
        </template>
      </Column>
      <Column field="tipo" header="Tipo" />
      <Column header="Tamaño" class="numero">
        <template #body="{ data }">
          <template v-if="(data as Fila).archivo">
            {{ formato.tamano((data as Fila).archivo!.tamanoBytes) }}
          </template>
        </template>
      </Column>
      <Column header="Duración" class="numero">
        <template #body="{ data }">
          <template v-if="(data as Fila).archivo">
            {{ formato.duracion((data as Fila).archivo!.duracionSeg) || '—' }}
          </template>
        </template>
      </Column>
      <Column header="Fecha">
        <template #body="{ data }">{{ formato.fecha((data as Fila).creadoEn) }}</template>
      </Column>
      <Column header="Acciones" class="acciones">
        <template #body="{ data }">
          <template v-if="(data as Fila).carpeta">
            <Button
              v-tooltip.top="'Renombrar'"
              icon="pi pi-pencil"
              text
              rounded
              aria-label="Renombrar"
              @click="renombrarCarpeta((data as Fila).carpeta!)"
            />
            <Button
              v-tooltip.top="'Mover'"
              icon="pi pi-arrow-right-arrow-left"
              text
              rounded
              aria-label="Mover"
              @click="moverCarpeta((data as Fila).carpeta!)"
            />
          </template>
          <template v-else-if="(data as Fila).archivo">
            <Button
              v-if="visorDe((data as Fila).archivo!) !== 'descargar'"
              v-tooltip.top="'Abrir'"
              :icon="ICONOS_VISOR[visorDe((data as Fila).archivo!)]"
              text
              rounded
              aria-label="Abrir"
              @click="emit('abrir', (data as Fila).archivo!)"
            />
            <Button
              v-tooltip.top="'Descargar'"
              icon="pi pi-download"
              text
              rounded
              aria-label="Descargar"
              @click="emit('descargar', (data as Fila).archivo!)"
            />
            <Button
              v-tooltip.top="'Renombrar'"
              icon="pi pi-pencil"
              text
              rounded
              aria-label="Renombrar"
              @click="renombrarArchivo((data as Fila).archivo!)"
            />
            <Button
              v-tooltip.top="'Mover'"
              icon="pi pi-arrow-right-arrow-left"
              text
              rounded
              aria-label="Mover"
              @click="moverArchivo((data as Fila).archivo!)"
            />
          </template>
          <Button
            v-tooltip.top="'Borrar'"
            icon="pi pi-trash"
            text
            rounded
            severity="danger"
            aria-label="Borrar"
            :loading="borrando === (data as Fila).clave"
            @click="borrar(data as Fila)"
          />
        </template>
      </Column>
    </DataTable>

    <DialogoNombre
      v-if="edicion"
      v-model:visible="dialogoNombre"
      :titulo="edicion.titulo"
      :etiqueta="edicion.etiqueta"
      :inicial="edicion.inicial"
      :maximo="edicion.maximo"
      :campo="edicion.campo"
      :validar="edicion.validar"
      :guardar="edicion.guardar"
    />
    <DialogoMover
      v-if="movimiento"
      v-model:visible="dialogoMover"
      :nombre="movimiento.nombre"
      :carpeta-movida="movimiento.carpetaMovida"
      :origen="movimiento.origen"
      :mover="movimiento.mover"
    />
  </div>
</template>

<style scoped>
.ruta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin: 0.75rem 0;
}

.ruta__paso {
  background: none;
  border: none;
  padding: 0.2rem 0.3rem;
  border-radius: 4px;
  color: var(--p-primary-color);
  cursor: pointer;
  font: inherit;
}

.ruta__paso:hover {
  text-decoration: underline;
}

.ruta__actual {
  padding: 0.2rem 0.3rem;
  font-weight: 600;
}

.ruta__separador {
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}

.barra {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}

.barra__filtros,
.barra__acciones {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.nombre {
  background: none;
  border: none;
  padding: 0;
  color: var(--p-primary-color);
  cursor: pointer;
  font: inherit;
  text-align: left;
  overflow-wrap: anywhere;
}

.nombre:hover {
  text-decoration: underline;
}

:deep(.icono) {
  width: 1%;
}

:deep(.numero) {
  text-align: right;
  white-space: nowrap;
}

:deep(.acciones) {
  white-space: nowrap;
  width: 1%;
}
</style>
