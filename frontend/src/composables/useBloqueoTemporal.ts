import { computed, onScopeDispose, ref } from 'vue'

// Cuenta regresiva para deshabilitar algo durante unos segundos (ej. el botón
// Ingresar después de un 429). Solo es una ayuda visual: el límite real lo
// aplican el backend y Nginx.
export function useBloqueoTemporal() {
  const restantes = ref(0)
  const bloqueado = computed(() => restantes.value > 0)
  let intervalo: ReturnType<typeof setInterval> | undefined

  function detener(): void {
    clearInterval(intervalo)
    intervalo = undefined
  }

  function bloquear(segundos: number): void {
    detener()
    restantes.value = segundos
    intervalo = setInterval(() => {
      restantes.value = Math.max(0, restantes.value - 1)
      if (restantes.value === 0) {
        detener()
      }
    }, 1000)
  }

  onScopeDispose(detener)

  return { bloqueado, restantes, bloquear }
}
