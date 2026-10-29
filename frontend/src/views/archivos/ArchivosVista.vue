<script setup lang="ts">
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import Tabs from 'primevue/tabs'
import { useToast } from 'primevue/usetoast'
import { computed, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { urlArchivo } from '@/api/archivos'
import { useApiError } from '@/composables/useApiError'
import { useAuthStore } from '@/stores/auth'
import type { Archivo } from '@/types/archivos'
import { visorDe } from '@/validaciones/archivos'
import ExploradorArchivos from './ExploradorArchivos.vue'
import ReproductorAudio from './ReproductorAudio.vue'
import TodosLosArchivos from './TodosLosArchivos.vue'
import VisorArchivo from './VisorArchivo.vue'

// Todos los roles: cada uno ve lo suyo. ADMIN tiene además la pestaña
// "Todos los archivos" (?vista=todos), con el dueño de cada uno. Es solo
// comodidad visual: el backend es el que filtra por dueño.
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { mostrarError } = useApiError()

const esAdmin = computed(() => auth.tieneRol('ADMIN'))

const vista = computed(() => (esAdmin.value && route.query.vista === 'todos' ? 'todos' : 'mios'))

function cambiarVista(valor: string | number): void {
  void router.push({ query: valor === 'todos' ? { vista: 'todos' } : {} })
}

// ─── Abrir y descargar (URL firmada) ──────────────────────────────
// Las URLs solo se usan al momento: nunca se guardan ni se muestran.
async function pedirUrlVer(id: number): Promise<string> {
  return (await urlArchivo(id, 'ver')).url
}

const enReproduccion = shallowRef<Archivo | null>(null)
const enVisor = shallowRef<Archivo | null>(null)
const visorVisible = ref(false)

function abrir(archivo: Archivo): void {
  switch (visorDe(archivo)) {
    case 'audio':
      enReproduccion.value = archivo
      break
    case 'video':
    case 'imagen':
      enVisor.value = archivo
      visorVisible.value = true
      break
    case 'pdf':
      void abrirPdf(archivo)
      break
    case 'descargar':
      void descargar(archivo)
  }
}

// La pestaña se abre ya (en el clic): si se abriera después de esperar la
// URL, el navegador la bloquearía como ventana emergente
async function abrirPdf(archivo: Archivo): Promise<void> {
  const ventana = window.open('', '_blank')
  try {
    const url = await pedirUrlVer(archivo.id)
    if (ventana) {
      ventana.opener = null
      ventana.location.href = url
    } else {
      toast.add({
        severity: 'warn',
        summary: 'Ventana bloqueada',
        detail: 'Permite las ventanas emergentes para ver el PDF.',
        life: 6000,
      })
    }
  } catch (error) {
    ventana?.close()
    mostrarError(error)
  }
}

// Un <a> con la URL en modo descarga (el backend la firma como attachment
// con el nombre original). Sin fetch: no hace falta CORS en el almacenamiento.
async function descargar(archivo: Archivo): Promise<void> {
  try {
    const { url } = await urlArchivo(archivo.id, 'descargar')
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.rel = 'noopener'
    document.body.appendChild(enlace)
    enlace.click()
    enlace.remove()
  } catch (error) {
    mostrarError(error)
  }
}

// Si se borra lo que se está viendo o escuchando, se cierra
function alBorrar(archivoId: number): void {
  if (enReproduccion.value?.id === archivoId) {
    enReproduccion.value = null
  }
  if (enVisor.value?.id === archivoId) {
    visorVisible.value = false
  }
}
</script>

<template>
  <section :class="{ 'con-reproductor': enReproduccion }">
    <h1>Archivos</h1>

    <Tabs v-if="esAdmin" :value="vista" @update:value="cambiarVista">
      <TabList>
        <Tab value="mios">Mis archivos</Tab>
        <Tab value="todos">Todos los archivos</Tab>
      </TabList>
    </Tabs>

    <TodosLosArchivos
      v-if="vista === 'todos'"
      @abrir="abrir"
      @descargar="descargar"
      @borrado="alBorrar"
    />
    <ExploradorArchivos v-else @abrir="abrir" @descargar="descargar" @borrado="alBorrar" />

    <VisorArchivo
      v-model:visible="visorVisible"
      :archivo="enVisor"
      :pedir-url="pedirUrlVer"
      @descargar="descargar"
    />
    <ReproductorAudio
      :archivo="enReproduccion"
      :pedir-url="pedirUrlVer"
      @cerrar="enReproduccion = null"
    />
  </section>
</template>

<style scoped>
h1 {
  margin: 0 0 0.5rem;
}

/* Que el reproductor fijo no tape las últimas filas */
.con-reproductor {
  padding-bottom: 5.5rem;
}
</style>
