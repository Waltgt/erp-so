import {
  BadRequestException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import busboy from 'busboy';
import type { IncomingMessage } from 'node:http';
import type { Readable } from 'node:stream';
import type { ArchivoEntrante } from './archivos.service';

export const CAMPO_ARCHIVO = 'archivo';

// Límites del parser. El tamaño del archivo NO se limita aquí (busboy lo
// truncaría en silencio): lo controla limitarTamano en el servicio (413).
const LIMITES: busboy.Limits = {
  files: 1,
  fields: 5,
  fieldSize: 1024,
  parts: 10,
  headerPairs: 20,
};

export interface SubidaMultipart {
  // Campos de texto que llegaron ANTES del archivo
  campos: Record<string, string>;
  archivo: ArchivoEntrante;
  // Se resuelve al terminar de leer la petición: false si después del
  // archivo llegó otra parte (otro archivo, un campo) o el cuerpo terminó
  // mal formado. Nunca se rechaza.
  restoValido: Promise<boolean>;
}

// Lee un multipart/form-data en stream. Se resuelve en cuanto empieza la
// parte del archivo, sin esperar a que llegue completo: el archivo se
// entrega como un Readable que se va llenando (busboy pausa la petición si
// nadie lo lee, así que la RAM no crece con el tamaño del archivo).
//
// Por eso los campos (carpetaId) deben ir antes que el archivo.
export function leerSubida(req: IncomingMessage): Promise<SubidaMultipart> {
  return new Promise((resolver, rechazar) => {
    let parser: busboy.Busboy;
    try {
      parser = busboy({
        headers: req.headers,
        limits: LIMITES,
        // Los navegadores envían el filename en UTF-8 sin codificar; el
        // valor por defecto de busboy (latin1) rompería las tildes
        defParamCharset: 'utf8',
      });
    } catch {
      // Sin Content-Type multipart/form-data (o sin boundary)
      req.resume();
      rechazar(
        new UnsupportedMediaTypeException(
          'Se espera multipart/form-data con el campo "archivo"',
        ),
      );
      return;
    }

    const campos: Record<string, string> = {};
    let archivo: Readable | null = null;
    let restoValido = true;
    let resolverResto: (valido: boolean) => void = () => undefined;
    const resto = new Promise<boolean>((r) => (resolverResto = r));

    // Antes del archivo: la petición se rechaza (400). Después: el error
    // llega al servicio por el stream del archivo y el resto no es válido.
    // En ambos casos lo que falte de la petición se lee y se tira.
    const fallar = (error: Error): void => {
      if (archivo) {
        restoValido = false;
        if (!archivo.readableEnded) {
          archivo.destroy(error);
        }
        resolverResto(false);
      } else {
        rechazar(error);
      }
      req.unpipe(parser);
      req.resume();
    };

    parser.on('field', (nombre, valor, info) => {
      if (archivo) {
        restoValido = false;
        return;
      }
      if (info.nameTruncated || info.valueTruncated) {
        fallar(
          new BadRequestException(`El campo ${nombre} es demasiado largo`),
        );
        return;
      }
      campos[nombre] = valor;
    });

    parser.on('file', (nombre, stream, info) => {
      if (nombre !== CAMPO_ARCHIVO) {
        stream.resume();
        fallar(
          new BadRequestException(
            `El archivo debe ir en el campo "${CAMPO_ARCHIVO}"`,
          ),
        );
        return;
      }
      archivo = stream;
      resolver({
        campos,
        archivo: {
          contenido: stream,
          nombre: info.filename,
          mimeType: info.mimeType,
        },
        restoValido: resto,
      });
    });

    // Un segundo archivo: busboy lo descarta solo, pero se avisa
    parser.on('filesLimit', () => (restoValido = false));
    const demasiadasPartes = (): void => {
      if (archivo) {
        restoValido = false;
      } else {
        fallar(
          new BadRequestException('El formulario tiene demasiados campos'),
        );
      }
    };
    parser.on('fieldsLimit', demasiadasPartes);
    parser.on('partsLimit', demasiadasPartes);

    parser.on('error', () =>
      fallar(new BadRequestException('Cuerpo multipart mal formado')),
    );

    // Se emite después de leer el cuerpo completo (y de que alguien haya
    // consumido el archivo hasta el final)
    parser.on('close', () => {
      if (!archivo) {
        rechazar(
          new BadRequestException(
            `Falta el archivo (campo "${CAMPO_ARCHIVO}")`,
          ),
        );
      }
      resolverResto(restoValido);
    });

    // El cliente cortó la conexión a medias: sin esto, la subida a S3 se
    // quedaría esperando datos que nunca llegan
    req.on('close', () => {
      if (!req.complete) {
        fallar(new BadRequestException('La subida se interrumpió'));
      }
    });

    req.pipe(parser);
  });
}
