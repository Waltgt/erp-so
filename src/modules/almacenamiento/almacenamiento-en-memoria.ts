import { Readable } from 'node:stream';
import {
  Almacenamiento,
  ObjetoNoEncontradoError,
  OpcionesUrlFirmada,
} from './almacenamiento';

// Doble para las pruebas unitarias: guarda los objetos en un Map. Consume el
// stream igual que S3 (si emite un error, no guarda nada).
export class AlmacenamientoEnMemoria extends Almacenamiento {
  readonly objetos = new Map<string, { datos: Buffer; contentType: string }>();
  // Para simular fallas de Garage
  fallarAlSubir: Error | null = null;
  fallarAlBorrar: Error | null = null;

  async subir(
    objectKey: string,
    contenido: Readable,
    contentType: string,
  ): Promise<void> {
    const partes: Buffer[] = [];
    for await (const parte of contenido) {
      partes.push(Buffer.from(parte as Uint8Array));
    }
    if (this.fallarAlSubir) {
      throw this.fallarAlSubir;
    }
    this.objetos.set(objectKey, { datos: Buffer.concat(partes), contentType });
  }

  // Sin firma real: deja a la vista lo que se firmaría
  urlFirmada(objectKey: string, opciones: OpcionesUrlFirmada): Promise<string> {
    if (!this.objetos.has(objectKey)) {
      return Promise.reject(new ObjetoNoEncontradoError(objectKey));
    }
    const parametros = new URLSearchParams({
      'X-Amz-Expires': String(opciones.segundos),
      'response-content-type': opciones.contentType,
      'response-content-disposition': opciones.contentDisposition,
    });
    return Promise.resolve(`memoria://bucket/${objectKey}?${parametros}`);
  }

  borrar(objectKey: string): Promise<void> {
    if (this.fallarAlBorrar) {
      return Promise.reject(this.fallarAlBorrar);
    }
    this.objetos.delete(objectKey);
    return Promise.resolve();
  }
}
