import type { TipoArchivo } from '@/types/archivos'

export const DATOS_TIPO_ARCHIVO: Record<TipoArchivo, { etiqueta: string; icono: string }> = {
  MUSICA: { etiqueta: 'Música', icono: 'pi pi-volume-up' },
  DOCUMENTO: { etiqueta: 'Documento', icono: 'pi pi-file' },
  IMAGEN: { etiqueta: 'Imagen', icono: 'pi pi-image' },
  VIDEO: { etiqueta: 'Video', icono: 'pi pi-video' },
  OTRO: { etiqueta: 'Otro', icono: 'pi pi-paperclip' },
}

// Para un Select de tipo
export const OPCIONES_TIPO_ARCHIVO = (Object.keys(DATOS_TIPO_ARCHIVO) as TipoArchivo[]).map(
  (tipo) => ({ label: DATOS_TIPO_ARCHIVO[tipo].etiqueta, value: tipo }),
)
