<script setup lang="ts">
import Button from 'primevue/button'
import { useRouter } from 'vue-router'

defineProps<{ icono: string; titulo: string; mensaje: string }>()

const router = useRouter()
</script>

<template>
  <section class="aviso">
    <i :class="icono" class="aviso__icono" aria-hidden="true" />
    <h1>{{ titulo }}</h1>
    <p>{{ mensaje }}</p>
    <Button label="Volver al inicio" icon="pi pi-home" @click="router.push({ name: 'inicio' })" />
  </section>
</template>

<style scoped>
.aviso {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 4rem 1rem;
}

.aviso__icono {
  font-size: 3rem;
  color: var(--p-text-muted-color);
}

.aviso p {
  color: var(--p-text-muted-color);
  margin-bottom: 1.5rem;
}
</style>
