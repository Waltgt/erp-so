import { Readable } from 'node:stream';

export interface OpcionesUrlFirmada {
  // Vigencia de la URL
  segundos: number;
  // Cabeceras que el almacenamiento pondrá en la respuesta de esa URL
  // (parámetros response-content-type / response-content-disposition)
  contentType: string;
  contentDisposition: string;
}

// El objeto no existe en el almacenamiento (la fila sí: inconsistencia)
export class ObjetoNoEncontradoError extends Error {
  constructor(readonly objectKey: string) {
    super(`El objeto ${objectKey} no existe en el almacenamiento`);
    this.name = 'ObjetoNoEncontradoError';
  }
}

// Almacenamiento de objetos. Los servicios dependen de esta clase abstracta
// (sirve de token de inyección): en la app es S3Almacenamiento (Garage) y en
// las pruebas AlmacenamientoEnMemoria.
export abstract class Almacenamiento {
  // Sube en stream: no espera a tener el archivo completo. Si `contenido`
  // emite un error, la subida falla y no queda el objeto.
  abstract subir(
    objectKey: string,
    contenido: Readable,
    contentType: string,
  ): Promise<void>;

  // URL de lectura (GET y HEAD) firmada, para que el navegador la pida
  // directamente. ObjetoNoEncontradoError si el objeto no existe.
  abstract urlFirmada(
    objectKey: string,
    opciones: OpcionesUrlFirmada,
  ): Promise<string>;

  // Idempotente: borrar un objeto que no existe no es un error (igual que S3)
  abstract borrar(objectKey: string): Promise<void>;
}
