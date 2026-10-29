<script setup lang="ts">
// Etiqueta + control + mensaje de error debajo. El control va en el slot y
// debe usar el mismo id que `para` (inputId en los componentes de PrimeVue).
defineProps<{
  etiqueta: string
  para: string
  error?: string
  ayuda?: string
}>()
</script>

<template>
  <div class="campo">
    <label :for="para">{{ etiqueta }}</label>
    <slot />
    <small v-if="error" :id="`${para}-error`" class="campo__error" role="alert">{{ error }}</small>
    <small v-else-if="ayuda" class="campo__ayuda">{{ ayuda }}</small>
  </div>
</template>

<style scoped>
.campo {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 1rem;
}

.campo label {
  font-weight: 600;
}

.campo__error {
  color: var(--p-red-600);
}

.campo__ayuda {
  color: var(--p-text-muted-color);
}
</style>
