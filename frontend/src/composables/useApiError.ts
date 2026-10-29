import { isAxiosError } from 'axios'
import { useToast } from 'primevue/usetoast'
import { esErrorApi } from '@/api/http'

export interface ErrorTraducido {
  // null = no hubo respuesta del servidor (red caída, tiempo agotado)
  status: number | null
  titulo: string
  // Mensajes que no corresponden a un campo del formulario
  mensajes: string[]
  // Mensajes por campo, para mostrarlos junto a cada uno: validación (400) y
  // valor duplicado (409 "Registro duplicado: email")
  campos: Record<string, string[]>
}

const GENERICO = 'Ocurrió un error inesperado. Intenta de nuevo.'

const TITULOS: Record<number, string> = {
  400: 'Revisa los datos',
  401: 'Tu sesión terminó',
  403: 'No tienes permiso',
  404: 'No encontrado',
  409: 'No se pudo completar',
  413: 'Archivo demasiado grande',
  415: 'Tipo de archivo no permitido',
  429: 'Demasiados intentos',
}

// Mensajes fijos: aquí el texto del backend no aporta (o es técnico)
const MENSAJES_FIJOS: Record<number, string> = {
  403: 'No tienes permiso para hacer esto.',
  404: 'No encontrado.',
  429: 'Demasiados intentos, espera un momento.',
}

// Los mensajes de class-validator empiezan con el nombre de la propiedad
// ("nombre no puede quedar vacío", "items.0.cantidad must be..."). Solo se
// asocian a un campo si el formulario lo declara en `camposConocidos`: así
// "El archivo está vacío" no se toma como un campo llamado "El".
function campoDelMensaje(mensaje: string, camposConocidos: readonly string[]): string | null {
  const primera = mensaje.split(' ', 1)[0] ?? ''
  const raiz = primera.split('.', 1)[0] ?? ''
  return camposConocidos.includes(primera) || camposConocidos.includes(raiz) ? primera : null
}

// 409 de un índice único: el filtro de Prisma del backend responde
// "Registro duplicado: <campo>" (ej. "Registro duplicado: email")
const DUPLICADO = /^Registro duplicado: (\w+)$/

// Índices con mensaje propio en el backend (prisma-exception.filter.ts)
const DUPLICADOS_CON_MENSAJE: Record<string, string> = {
  'NIT ya registrado': 'nit',
  'SKU ya registrado': 'sku',
}

function campoDuplicado(mensaje: string, camposConocidos: readonly string[]): string | null {
  const campo = DUPLICADOS_CON_MENSAJE[mensaje] ?? DUPLICADO.exec(mensaje)?.[1]
  return campo && camposConocidos.includes(campo) ? campo : null
}

export function traducirError(
  error: unknown,
  camposConocidos: readonly string[] = [],
): ErrorTraducido {
  if (!esErrorApi(error) || !error.response) {
    const agotado = isAxiosError(error) && error.code === 'ECONNABORTED'
    return {
      status: null,
      titulo: 'Sin conexión',
      mensajes: [
        agotado
          ? 'El servidor tardó demasiado en responder.'
          : 'No se pudo conectar con el servidor.',
      ],
      campos: {},
    }
  }

  const { status, data } = error.response
  if (status >= 500) {
    return { status, titulo: 'Error del servidor', mensajes: [GENERICO], campos: {} }
  }

  const fijo = MENSAJES_FIJOS[status]
  const delBackend = Array.isArray(data.message) ? data.message : [data.message]
  const textos = fijo ? [fijo] : delBackend.filter((m) => typeof m === 'string' && m !== '')

  const campos: Record<string, string[]> = {}
  const mensajes: string[] = []
  for (const texto of textos) {
    const campo =
      status === 400
        ? campoDelMensaje(texto, camposConocidos)
        : status === 409
          ? campoDuplicado(texto, camposConocidos)
          : null
    if (campo) {
      ;(campos[campo] ??= []).push(texto)
    } else {
      mensajes.push(texto)
    }
  }

  return {
    status,
    titulo: TITULOS[status] ?? 'Error',
    mensajes: mensajes.length > 0 || Object.keys(campos).length > 0 ? mensajes : [GENERICO],
    campos,
  }
}

// En un componente: const { mostrarError } = useApiError()
// catch (e) { errores.value = mostrarError(e, ['nombre', 'email']).campos }
export function useApiError() {
  const toast = useToast()

  // Muestra un Toast con lo que no es de un campo y devuelve la traducción
  // (los errores por campo los pinta el formulario)
  function mostrarError(error: unknown, camposConocidos: readonly string[] = []): ErrorTraducido {
    const traducido = traducirError(error, camposConocidos)
    if (traducido.mensajes.length > 0) {
      toast.add({
        severity: traducido.status === 409 ? 'warn' : 'error',
        summary: traducido.titulo,
        detail: traducido.mensajes.join('\n'),
        life: 6000,
      })
    }
    return traducido
  }

  return { mostrarError, traducirError }
}
