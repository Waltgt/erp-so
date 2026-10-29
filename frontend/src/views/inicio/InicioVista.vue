<script setup lang="ts">
import Card from 'primevue/card'
import Skeleton from 'primevue/skeleton'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { contarStockBajo } from '@/api/productos'
import EtiquetaRol from '@/components/EtiquetaRol.vue'
import { useApiError } from '@/composables/useApiError'
import { menuPara } from '@/router/menu'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const { mostrarError } = useApiError()

// Accesos directos: lo mismo que el menú del rol, menos el propio inicio
const accesos = computed(() => menuPara(router, auth.rol).filter((e) => e.ruta !== 'inicio'))

// Los mismos roles que GET /api/productos/stock-bajo en el backend
const puedeVerStockBajo = computed(() => auth.tieneRol('ADMIN', 'BODEGUERO', 'COMPRAS'))
const stockBajo = ref<number | null>(null)
const tieneVistaStockBajo = computed(() => router.hasRoute('stock-bajo'))

onMounted(async () => {
  if (!puedeVerStockBajo.value) {
    return
  }
  try {
    stockBajo.value = await contarStockBajo()
  } catch (error) {
    mostrarError(error)
  }
})
</script>

<template>
  <section class="inicio">
    <header class="saludo">
      <h1>Hola, {{ auth.usuario?.nombre }}</h1>
      <EtiquetaRol v-if="auth.rol" :rol="auth.rol" />
    </header>

    <div class="tarjetas">
      <Card v-if="puedeVerStockBajo" class="tarjeta tarjeta--alerta">
        <template #title>
          <i class="pi pi-exclamation-triangle" aria-hidden="true" /> Stock bajo
        </template>
        <template #content>
          <Skeleton v-if="stockBajo === null" width="4rem" height="2.5rem" />
          <template v-else>
            <p class="cifra">{{ stockBajo }}</p>
            <p>{{ stockBajo === 1 ? 'producto' : 'productos' }} con stock en o bajo el mínimo</p>
            <RouterLink v-if="tieneVistaStockBajo" :to="{ name: 'stock-bajo' }">
              Ver productos
            </RouterLink>
          </template>
        </template>
      </Card>

      <RouterLink
        v-for="acceso in accesos"
        :key="acceso.ruta"
        :to="{ name: acceso.ruta }"
        class="acceso"
      >
        <Card class="tarjeta">
          <template #title>
            <i :class="acceso.icono" aria-hidden="true" /> {{ acceso.etiqueta }}
          </template>
        </Card>
      </RouterLink>
    </div>

    <p v-if="accesos.length === 0 && !puedeVerStockBajo" class="vacio">
      Todavía no hay pantallas disponibles para tu rol.
    </p>
  </section>
</template>

<style scoped>
.saludo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.saludo h1 {
  margin: 0;
  font-size: 1.75rem;
}

.tarjetas {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 1rem;
}

.acceso {
  text-decoration: none;
  color: inherit;
}

.acceso .tarjeta:hover {
  outline: 2px solid var(--p-primary-color);
}

.tarjeta--alerta :deep(.p-card-title) {
  color: var(--p-orange-600);
}

.cifra {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0;
}

.vacio {
  color: var(--p-text-muted-color);
}
</style>
