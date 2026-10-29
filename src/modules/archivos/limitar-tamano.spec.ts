import { PassThrough, Readable } from 'node:stream';
import {
  ArchivoDemasiadoGrandeError,
  descartar,
  limitarTamano,
} from './limitar-tamano';

async function leerTodo(stream: Readable): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const parte of stream) {
    partes.push(parte as Buffer);
  }
  return Buffer.concat(partes);
}

describe('limitarTamano', () => {
  it('deja pasar el contenido completo y cuenta los bytes', async () => {
    const origen = Readable.from([Buffer.from('hola '), Buffer.from('mundo')]);
    const contador = limitarTamano(origen, 10);
    expect((await leerTodo(contador)).toString()).toBe('hola mundo');
    expect(contador.bytes).toBe(10);
  });

  it('justo el máximo pasa; un byte más falla', async () => {
    const exacto = limitarTamano(Readable.from([Buffer.alloc(8)]), 8);
    await expect(leerTodo(exacto)).resolves.toHaveLength(8);

    const pasado = limitarTamano(Readable.from([Buffer.alloc(9)]), 8);
    await expect(leerTodo(pasado)).rejects.toBeInstanceOf(
      ArchivoDemasiadoGrandeError,
    );
  });

  it('falla en cuanto se pasa, sin esperar el resto del archivo', async () => {
    const origen = new PassThrough();
    const contador = limitarTamano(origen, 4);
    const lectura = leerTodo(contador);
    origen.write(Buffer.alloc(5));
    // El origen nunca termina: si el contador esperara el final, la prueba
    // se quedaría colgada
    await expect(lectura).rejects.toBeInstanceOf(ArchivoDemasiadoGrandeError);
  });

  it('al pasarse, descarta el resto del origen (la petición puede terminar)', async () => {
    const origen = new PassThrough();
    const contador = limitarTamano(origen, 4);
    const lectura = leerTodo(contador).catch(() => undefined);
    origen.write(Buffer.alloc(5));
    await lectura;

    // Lo que siga llegando se lee y se tira: el origen termina
    const fin = new Promise((resolver) => origen.once('end', resolver));
    origen.end(Buffer.alloc(100));
    await expect(fin).resolves.toBeUndefined();
  });

  it('un error del origen llega al contador', async () => {
    const origen = new PassThrough();
    const contador = limitarTamano(origen, 100);
    const lectura = leerTodo(contador);
    origen.destroy(new Error('conexión cortada'));
    await expect(lectura).rejects.toThrow('conexión cortada');
  });
});

describe('descartar', () => {
  it('consume un stream que nadie lee hasta el final', async () => {
    const origen = new PassThrough();
    origen.pause();
    const fin = new Promise((resolver) => origen.once('end', resolver));
    descartar(origen);
    origen.end(Buffer.alloc(1024));
    await expect(fin).resolves.toBeUndefined();
  });
});
