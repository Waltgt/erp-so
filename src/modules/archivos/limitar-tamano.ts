import { Readable, Transform, TransformCallback } from 'node:stream';

export class ArchivoDemasiadoGrandeError extends Error {
  constructor(readonly maximoBytes: number) {
    super(`El archivo supera el máximo de ${maximoBytes} bytes`);
    this.name = 'ArchivoDemasiadoGrandeError';
  }
}

// Deja pasar los bytes contándolos. Al pasarse del máximo emite
// ArchivoDemasiadoGrandeError: quien lo consume (la subida a S3) falla y el
// objeto no se completa. Nunca guarda el archivo: solo cuenta.
export class ContadorBytes extends Transform {
  bytes = 0;

  constructor(private readonly maximoBytes: number) {
    super();
  }

  override _transform(
    parte: Buffer,
    _codificacion: BufferEncoding,
    listo: TransformCallback,
  ): void {
    this.bytes += parte.length;
    if (this.bytes > this.maximoBytes) {
      listo(new ArchivoDemasiadoGrandeError(this.maximoBytes));
      return;
    }
    listo(null, parte);
  }
}

// origen → contador. Si algo falla, el resto del origen se descarta (ver
// descartar) para que el parser del multipart termine de leer la petición.
export function limitarTamano(
  origen: Readable,
  maximoBytes: number,
): ContadorBytes {
  const contador = new ContadorBytes(maximoBytes);
  origen.once('error', (error) => contador.destroy(error));
  contador.once('error', () => descartar(origen));
  origen.pipe(contador);
  return contador;
}

// Lee y tira lo que quede del stream. Si nadie lo lee, el stream se queda en
// pausa y la petición HTTP nunca termina.
export function descartar(origen: Readable): void {
  origen.unpipe();
  origen.resume();
}
