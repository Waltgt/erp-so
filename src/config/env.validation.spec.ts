import { Entorno, validarEntorno } from './env.validation';

describe('validarEntorno', () => {
  const base = {
    DATABASE_URL: 'postgresql://erp_app:x@localhost:5432/erp_db?schema=erp',
    JWT_SECRET: 'a'.repeat(32),
    JWT_EXPIRES_IN: '8h',
    PORT: '3000',
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
});
