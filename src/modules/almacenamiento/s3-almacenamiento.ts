import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  S3Client,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';
import { VariablesEntorno } from '../../config/env.validation';
import {
  Almacenamiento,
  ObjetoNoEncontradoError,
  OpcionesUrlFirmada,
} from './almacenamiento';

// Tamaño de cada parte del multipart upload (5 MB es el mínimo de S3).
// Con queueSize 1, la RAM por subida es ~1 parte, sin importar el tamaño
// del archivo.
const TAMANO_PARTE = 5 * 1024 * 1024;

// Garage (API S3) en server-files. La clave solo tiene lectura/escritura
// sobre el bucket: aquí nunca se crean buckets ni se cambia su configuración.
//
// Dos clientes con las mismas credenciales:
// - cliente (S3_ENDPOINT, server-files): subir, borrar y HEAD.
// - firmador (S3_PUBLIC_ENDPOINT, Nginx en server-web): solo firma URLs.
//   Firmar no hace peticiones de red; calcula la firma con el host público,
//   que es el que verá Garage (Nginx reenvía el Host tal cual).
@Injectable()
export class S3Almacenamiento
  extends Almacenamiento
  implements OnModuleDestroy
{
  private readonly cliente: S3Client;
  private readonly firmador: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService<VariablesEntorno, true>) {
    super();
    this.bucket = config.get('S3_BUCKET', { infer: true });
    const comun: S3ClientConfig = {
      region: config.get('S3_REGION', { infer: true }),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY', { infer: true }),
        secretAccessKey: config.get('S3_SECRET_KEY', { infer: true }),
      },
      // Garage no usa subdominios por bucket: http://host:3900/<bucket>/<key>
      forcePathStyle: true,
      // Checksums CRC32 solo cuando la operación los exige
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    };
    this.cliente = new S3Client({
      ...comun,
      endpoint: config.get('S3_ENDPOINT', { infer: true }),
    });
    this.firmador = new S3Client({
      ...comun,
      endpoint: config.get('S3_PUBLIC_ENDPOINT', { infer: true }),
    });
  }

  async subir(
    objectKey: string,
    contenido: Readable,
    contentType: string,
  ): Promise<void> {
    // Archivos de hasta 5 MB: un PutObject. Más grandes: multipart upload;
    // si falla, leavePartsOnError=false lo aborta y Garage descarta las partes.
    const subida = new Upload({
      client: this.cliente,
      params: {
        Bucket: this.bucket,
        Key: objectKey,
        Body: contenido,
        ContentType: contentType,
      },
      partSize: TAMANO_PARTE,
      queueSize: 1,
      leavePartsOnError: false,
    });
    await subida.done();
  }

  async urlFirmada(
    objectKey: string,
    opciones: OpcionesUrlFirmada,
  ): Promise<string> {
    // Con una URL firmada de un objeto que no existe, el navegador recibiría
    // un 404 de Garage sin que nadie se entere: se comprueba antes
    try {
      await this.cliente.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
    } catch (error) {
      if (error instanceof NotFound) {
        throw new ObjetoNoEncontradoError(objectKey);
      }
      throw error;
    }

    // response-content-*: Garage responde con estas cabeceras en lugar de
    // las guardadas (van dentro de la firma: el cliente no puede cambiarlas)
    return getSignedUrl(
      this.firmador,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        ResponseContentType: opciones.contentType,
        ResponseContentDisposition: opciones.contentDisposition,
      }),
      { expiresIn: opciones.segundos },
    );
  }

  async borrar(objectKey: string): Promise<void> {
    await this.cliente.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );
  }

  onModuleDestroy(): void {
    this.cliente.destroy();
    this.firmador.destroy();
  }
}
