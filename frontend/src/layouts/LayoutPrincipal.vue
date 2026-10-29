<script setup lang="ts">
import Button from 'primevue/button'
import { useConfirm } from 'primevue/useconfirm'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EtiquetaRol from '@/components/EtiquetaRol.vue'
import { menuPara } from '@/router/menu'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const confirm = useConfirm()

const menu = computed(() => menuPara(router, auth.rol))
const tienePerfil = computed(() => router.hasRoute('perfil'))

// Pantalla angosta (tablet vertical, teléfono): el menú se superpone y se
// cierra al navegar. Ancha: el menú se colapsa a solo íconos.
const consulta = window.matchMedia('(max-width: 960px)')
const angosta = ref(consulta.matches)
const actualizarAncho = (e: MediaQueryListEvent) => (angosta.value = e.matches)
consulta.addEventListener('change', actualizarAncho)
onBeforeUnmount(() => consulta.removeEventListener('change', actualizarAncho))

const colapsado = ref(false)
const abiertoEnAngosta = ref(false)

function alternarMenu(): void {
  if (angosta.value) {
    abiertoEnAngosta.value = !abiertoEnAngosta.value
  } else {
    colapsado.value = !colapsado.value
  }
}

watch(
  () => route.fullPath,
  () => (abiertoEnAngosta.value = false),
)

function cerrarSesion(): void {
  confirm.require({
    header: 'Cerrar sesión',
    message: '¿Quieres cerrar la sesión?',
    icon: 'pi pi-sign-out',
    acceptLabel: 'Cerrar sesión',
    rejectLabel: 'Cancelar',
    rejectProps: { severity: 'secondary', outlined: true },
    accept: () => {
      auth.cerrarSesion()
      void router.replace({ name: 'login' })
    },
  })
}
</script>

<template>
  <div
    class="layout"
    :class="{
      'layout--colapsado': colapsado && !angosta,
      'layout--angosta': angosta,
      'layout--menu-abierto': angosta && abiertoEnAngosta,
    }"
  >
    <aside class="lateral" aria-label="Menú principal">
      <div class="lateral__marca">
        <i class="pi pi-briefcase" aria-hidden="true" />
        <span class="lateral__texto">ERP</span>
      </div>
      <nav>
        <RouterLink
          v-for="entrada in menu"
          :key="entrada.ruta"
          v-tooltip.right="colapsado && !angosta ? entrada.etiqueta : undefined"
          :to="{ name: entrada.ruta }"
          class="lateral__enlace"
          :exact-active-class="entrada.ruta === 'inicio' ? 'activo' : undefined"
          :active-class="entrada.ruta === 'inicio' ? '' : 'activo'"
        >
          <i :class="entrada.icono" aria-hidden="true" />
          <span class="lateral__texto">{{ entrada.etiqueta }}</span>
        </RouterLink>
      </nav>
    </aside>

    <div
      v-if="angosta && abiertoEnAngosta"
      class="fondo"
      aria-hidden="true"
      @click="abiertoEnAngosta = false"
    />

    <div class="principal">
      <header class="superior">
        <Button
          icon="pi pi-bars"
          text
          rounded
          severity="secondary"
          aria-label="Mostrar u ocultar el menú"
          @click="alternarMenu"
        />
        <div class="superior__usuario">
          <span class="superior__nombre">{{ auth.usuario?.nombre }}</span>
          <EtiquetaRol v-if="auth.rol" :rol="auth.rol" />
          <Button
            v-if="tienePerfil"
            v-tooltip.bottom="'Mi perfil'"
            icon="pi pi-user"
            text
            rounded
            severity="secondary"
            aria-label="Mi perfil"
            @click="router.push({ name: 'perfil' })"
          />
          <Button
            v-tooltip.bottom="'Cerrar sesión'"
            icon="pi pi-sign-out"
            text
            rounded
            severity="secondary"
            aria-label="Cerrar sesión"
            @click="cerrarSesion"
          />
        </div>
      </header>
      <main class="contenido">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.layout {
  --ancho-menu: 15rem;
  display: flex;
  min-height: 100vh;
}

.lateral {
  width: var(--ancho-menu);
  flex-shrink: 0;
  background: var(--p-surface-900);
  color: var(--p-surface-0);
  padding: 1rem 0.75rem;
  transition: width 0.2s ease;
  overflow: hidden;
}

.lateral__marca {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.25rem;
  font-weight: 700;
  padding: 0.5rem 0.75rem 1.25rem;
  white-space: nowrap;
}

.lateral__enlace {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0.75rem;
  border-radius: var(--p-border-radius-md);
  color: var(--p-surface-300);
  text-decoration: none;
  white-space: nowrap;
}

.lateral__enlace:hover {
  background: var(--p-surface-800);
  color: var(--p-surface-0);
}

.lateral__enlace.activo {
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
}

.layout--colapsado {
  --ancho-menu: 4.25rem;
}

.layout--colapsado .lateral__texto {
  display: none;
}

/* Angosta: el menú sale de un costado sobre el contenido */
.layout--angosta .lateral {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 1000;
  transform: translateX(-100%);
  transition: transform 0.2s ease;
}

.layout--menu-abierto .lateral {
  transform: translateX(0);
}

.fondo {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: rgb(0 0 0 / 0.4);
}

.principal {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.superior {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background: var(--p-content-background);
  border-bottom: 1px solid var(--p-content-border-color);
  position: sticky;
  top: 0;
  z-index: 10;
}

.superior__usuario {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.superior__nombre {
  font-weight: 600;
}

.contenido {
  flex: 1;
  padding: 1.5rem;
}

@media (max-width: 600px) {
  .superior__nombre {
    display: none;
  }

  .contenido {
    padding: 1rem;
  }
}
</style>
