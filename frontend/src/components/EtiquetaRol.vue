<script setup lang="ts">
import Tag from 'primevue/tag'
import { computed } from 'vue'
import { DATOS_ROL } from '@/constantes/roles'
import type { Rol } from '@/types/auth'

const props = defineProps<{ rol: Rol }>()

const datos = computed(() => DATOS_ROL[props.rol])
</script>

<template>
  <Tag :value="datos.etiqueta" :severity="datos.color" />
</template>
