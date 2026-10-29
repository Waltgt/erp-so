<script setup lang="ts">
import ConfirmDialog from 'primevue/confirmdialog'
import Toast from 'primevue/toast'
</script>

<template>
  <!-- Una sola instancia para toda la app: useApiError y las confirmaciones
       de acciones destructivas las usan desde cualquier vista -->
  <Toast position="top-right" />
  <ConfirmDialog />
  <RouterView />
</template>
