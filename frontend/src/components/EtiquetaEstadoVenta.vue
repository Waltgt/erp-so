<script setup lang="ts">
import Tag from 'primevue/tag'
import type { EstadoVenta } from '@/types/ventas'

defineProps<{ estado: EstadoVenta }>()
</script>

<template>
  <Tag
    :value="estado === 'COMPLETADA' ? 'Completada' : 'Anulada'"
    :severity="estado === 'COMPLETADA' ? 'success' : 'danger'"
  />
</template>
