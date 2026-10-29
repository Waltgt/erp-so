import { Entorno, validarEntorno } from './env.validation';

describe('validarEntorno', () => {
  const base = {
    DATABASE_URL: 'postgresql://erp_app:x@localhost:5432/erp_db?schema=erp',
    JWT_SECRET: 'a'.repeat(32),
    JWT_EXPIRES_IN: '8h',
    PORT: '3000',
    S3_ENDPOINT: 'http://192.168.56.13:3900',
    S3_PUBLIC_ENDPOINT: 'http://192.168.56.10:3900',
    S3_REGION: 'garage',
    S3_ACCESS_KEY: 'GK0123456789abcdef',
    S3_SECRET_KEY: 'secreto',
    S3_BUCKET: 'erp-archivos',
    ARCHIVO_TAMANO_MAX_MB: '100',
  };

  it('acepta una configuración válida y convierte PORT a número', () => {
    const env = validarEntorno(base);
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe(Entorno.Development);
  });

  it('falla indicando que falta JWT_SECRET', () => {
    const sinSecreto: Record<string, unknown> = { ...base };
    delete sinSecreto.JWT_SECRET;
    expect(() => validarEntorno(sinSecreto)).toThrow(
      /JWT_SECRET: falta la variable/,
    );
  });

  it('falla si JWT_SECRET tiene menos de 32 caracteres', () => {
    expect(() => validarEntorno({ ...base, JWT_SECRET: 'corto' })).toThrow(
      /al menos 32 caracteres/,
    );
  });

  it('falla si DATABASE_URL no es postgresql://', () => {
    expect(() =>
      validarEntorno({ ...base, DATABASE_URL: 'mysql://x' }),
    ).toThrow(/DATABASE_URL/);
  });

  it('falla con un JWT_EXPIRES_IN inválido', () => {
    expect(() =>
      validarEntorno({ ...base, JWT_EXPIRES_IN: 'ocho horas' }),
    ).toThrow(/JWT_EXPIRES_IN/);
  });

  it('falla con un PORT fuera de rango', () => {
    expect(() => validarEntorno({ ...base, PORT: '70000' })).toThrow(/PORT/);
  });

  it('convierte ARCHIVO_TAMANO_MAX_MB a número', () => {
    expect(validarEntorno(base).ARCHIVO_TAMANO_MAX_MB).toBe(100);
  });

  it('URL_FIRMADA_SEGUNDOS y TRUST_PROXY tienen valor por defecto', () => {
    const env = validarEntorno(base);
    expect(env.URL_FIRMADA_SEGUNDOS).toBe(900);
    expect(env.TRUST_PROXY).toBe(1);
    expect(
      validarEntorno({
        ...base,
        URL_FIRMADA_SEGUNDOS: '300',
        TRUST_PROXY: '0',
      }),
    ).toMatchObject({ URL_FIRMADA_SEGUNDOS: 300, TRUST_PROXY: 0 });
  });

  it.each([
    'S3_ENDPOINT',
    'S3_PUBLIC_ENDPOINT',
    'S3_ACCESS_KEY',
    'S3_SECRET_KEY',
    'S3_BUCKET',
  ])('falla indicando que falta %s', (variable) => {
    const sinVariable: Record<string, unknown> = { ...base };
    delete sinVariable[variable];
    expect(() => validarEntorno(sinVariable)).toThrow(
      new RegExp(`${variable}: falta la variable`),
    );
  });

  it.each([
    ['S3_ENDPOINT sin protocolo', { S3_ENDPOINT: '192.168.56.13:3900' }],
    ['S3_ENDPOINT con ruta', { S3_ENDPOINT: 'http://host:3900/bucket' }],
    ['S3_BUCKET con mayúsculas', { S3_BUCKET: 'ERP' }],
    [
      'S3_PUBLIC_ENDPOINT con ruta',
      { S3_PUBLIC_ENDPOINT: 'http://host:3900/s3' },
    ],
    ['URL_FIRMADA_SEGUNDOS > 7 días', { URL_FIRMADA_SEGUNDOS: '604801' }],
    ['URL_FIRMADA_SEGUNDOS < 60', { URL_FIRMADA_SEGUNDOS: '10' }],
    ['TRUST_PROXY negativo', { TRUST_PROXY: '-1' }],
    ['ARCHIVO_TAMANO_MAX_MB en 0', { ARCHIVO_TAMANO_MAX_MB: '0' }],
    // tamano_bytes es INTEGER: 2048 MB ya no cabe
    [
      'ARCHIVO_TAMANO_MAX_MB que no cabe en INTEGER',
      { ARCHIVO_TAMANO_MAX_MB: '2048' },
    ],
  ])('falla con %s', (_caso, cambio) => {
    expect(() => validarEntorno({ ...base, ...cambio })).toThrow(
      new RegExp(Object.keys(cambio)[0]),
    );
  });
});
