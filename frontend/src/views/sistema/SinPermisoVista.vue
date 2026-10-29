<script setup lang="ts">
import AvisoPagina from '@/components/AvisoPagina.vue'
</script>

<template>
  <!-- Solo se llega aquí por el guard del router (comodidad visual). Si
       alguien fuerza la llamada, el backend responde 403 de todos modos. -->
  <AvisoPagina
    icono="pi pi-lock"
    titulo="No tienes permiso"
    mensaje="Tu rol no puede usar esta pantalla."
  />
</template>
